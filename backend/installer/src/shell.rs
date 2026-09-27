//! Windows shell pieces: known folders, shortcuts, message boxes, the
//! one-setup-at-a-time lock and starting the installed app.

use std::ffi::OsString;
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::path::{Path, PathBuf};

use windows_sys::Win32::Foundation::{CloseHandle, ERROR_ALREADY_EXISTS, GetLastError, HANDLE};
use windows_sys::Win32::System::Com::CoTaskMemFree;
use windows_sys::Win32::System::Threading::CreateMutexW;
use windows_sys::Win32::UI::Shell::{
    FOLDERID_Desktop, FOLDERID_LocalAppData, FOLDERID_Programs, FOLDERID_RoamingAppData,
    FOLDERID_Startup, KF_FLAG_DEFAULT, SHGetKnownFolderPath,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    IDYES, MB_ICONERROR, MB_ICONWARNING, MB_OK, MB_YESNO, MessageBoxW,
};
use windows_sys::core::GUID;

use crate::product;

pub fn wide(text: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
    text.as_ref().encode_wide().chain(Some(0)).collect()
}

fn known_folder(id: &GUID) -> Option<PathBuf> {
    let mut raw = std::ptr::null_mut();
    // SAFETY: `raw` receives a CoTaskMemAlloc'd string, freed below.
    let result =
        unsafe { SHGetKnownFolderPath(id, KF_FLAG_DEFAULT as u32, std::ptr::null_mut(), &mut raw) };
    if raw.is_null() {
        return None;
    }
    let path = (result >= 0).then(|| {
        // SAFETY: a successful call returns a NUL-terminated string.
        let length = (0..).take_while(|&i| unsafe { *raw.add(i) } != 0).count();
        let units = unsafe { std::slice::from_raw_parts(raw, length) };
        PathBuf::from(OsString::from_wide(units))
    });
    // SAFETY: allocated by SHGetKnownFolderPath.
    unsafe { CoTaskMemFree(raw as *const _) };
    path
}

/// `%LOCALAPPDATA%`, where per-user apps live.
pub fn local_app_data() -> Option<PathBuf> {
    known_folder(&FOLDERID_LocalAppData)
}

/// `%APPDATA%`.
pub fn roaming_app_data() -> Option<PathBuf> {
    known_folder(&FOLDERID_RoamingAppData)
}

/// The three shortcuts the setup offers, by where they go.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Shortcut {
    Desktop,
    StartMenu,
    /// Starts the app minimized when the user signs in.
    Startup,
}

impl Shortcut {
    pub const ALL: [Shortcut; 3] = [Shortcut::Desktop, Shortcut::StartMenu, Shortcut::Startup];

    /// `<folder>\Make Your Life Easier.lnk`. The desktop follows OneDrive
    /// or any other redirection, which `%USERPROFILE%\Desktop` would miss.
    pub fn path(self) -> Option<PathBuf> {
        let folder = match self {
            Shortcut::Desktop => known_folder(&FOLDERID_Desktop),
            Shortcut::StartMenu => known_folder(&FOLDERID_Programs),
            Shortcut::Startup => known_folder(&FOLDERID_Startup),
        }?;
        Some(folder.join(format!("{}.lnk", product::NAME)))
    }

    fn fallback_path(self) -> Option<PathBuf> {
        let primary = self.path()?;
        Some(primary.with_file_name(format!("{} - {}.lnk", product::NAME, product::PUBLISHER)))
    }

    fn paths(self) -> Vec<PathBuf> {
        self.path()
            .into_iter()
            .chain(self.fallback_path())
            .collect()
    }

    fn arguments(self) -> &'static str {
        match self {
            // The app minimizes itself when it sees this (backend/src/lib.rs).
            Shortcut::Startup => "--autostart",
            _ => "",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Shortcut::Desktop => "Desktop",
            Shortcut::StartMenu => "Start Menu",
            Shortcut::Startup => "Startup",
        }
    }
}

/// Runs `work` with COM initialized on this thread (shortcuts need it).
fn with_com<T>(work: impl FnOnce() -> windows::core::Result<T>) -> Result<T, String> {
    use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx, CoUninitialize};
    // SAFETY: balanced below when initialization succeeded (S_OK or S_FALSE).
    let initialized = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_ok();
    let result = work().map_err(|e| e.message());
    if initialized {
        unsafe { CoUninitialize() };
    }
    result
}

/// The details Windows has saved for one shortcut.
struct ShortcutDetails {
    target: PathBuf,
    working_directory: PathBuf,
    description: String,
    icon: PathBuf,
    arguments: String,
}

fn text(buffer: &[u16]) -> String {
    let length = buffer
        .iter()
        .position(|&unit| unit == 0)
        .unwrap_or(buffer.len());
    String::from_utf16_lossy(&buffer[..length])
}

fn path(buffer: &[u16]) -> PathBuf {
    let length = buffer
        .iter()
        .position(|&unit| unit == 0)
        .unwrap_or(buffer.len());
    PathBuf::from(OsString::from_wide(&buffer[..length]))
}

fn icon_file(icon: &str) -> PathBuf {
    let path = icon
        .rsplit_once(',')
        .filter(|(_, index)| index.trim().parse::<i32>().is_ok())
        .map_or(icon, |(path, _)| path);
    PathBuf::from(path)
}

fn managed_link(link: &ShortcutDetails, exe: &Path) -> bool {
    same_file(&link.target, exe)
        || (link.description.eq_ignore_ascii_case(product::NAME)
            && exe
                .parent()
                .is_some_and(|folder| same_file(&link.working_directory, folder))
            && same_file(&link.icon, exe))
}

fn valid_link(link: &ShortcutDetails, kind: Shortcut, exe: &Path) -> bool {
    same_file(&link.target, exe) && link.arguments == kind.arguments()
}

fn details_at(link_path: &Path) -> Option<ShortcutDetails> {
    use windows::Win32::System::Com::{
        CLSCTX_INPROC_SERVER, CoCreateInstance, IPersistFile, STGM_READ,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, SLGP_RAWPATH, ShellLink};
    use windows::core::{HSTRING, Interface};

    if !link_path.is_file() {
        return None;
    }
    with_com(|| unsafe {
        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
        link.cast::<IPersistFile>()?
            .Load(&HSTRING::from(link_path.as_os_str()), STGM_READ)?;

        // On the heap: together these are 260 KB, and the silent install
        // runs on the main thread, which has a 1 MB stack.
        let mut target = vec![0u16; 32_768];
        let mut working_directory = vec![0u16; 32_768];
        let mut description = vec![0u16; 1_024];
        let mut icon = vec![0u16; 32_768];
        let mut arguments = vec![0u16; 32_768];
        let mut icon_index = 0;
        link.GetPath(&mut target, std::ptr::null_mut(), SLGP_RAWPATH.0 as u32)?;
        link.GetWorkingDirectory(&mut working_directory)?;
        link.GetDescription(&mut description)?;
        link.GetIconLocation(&mut icon, &mut icon_index)?;
        link.GetArguments(&mut arguments)?;

        Ok(ShortcutDetails {
            target: path(&target),
            working_directory: PathBuf::from(text(&working_directory)),
            description: text(&description),
            icon: icon_file(&text(&icon)),
            arguments: text(&arguments),
        })
    })
    .ok()
}

/// Writes (or rewrites) a shortcut and checks what Windows persisted.
pub fn create_shortcut(kind: Shortcut, exe: &Path) -> Result<(), String> {
    use windows::Win32::System::Com::{CLSCTX_INPROC_SERVER, CoCreateInstance, IPersistFile};
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};
    use windows::core::{HSTRING, Interface};

    let paths = kind.paths();
    if paths.is_empty() {
        return Err("the shortcut folder could not be found".into());
    }
    // Ours first, wherever it is: rewriting the fallback name when the main
    // one has since become free would leave two shortcuts.
    let link_path = paths
        .iter()
        .find(|path| details_at(path).is_some_and(|link| managed_link(&link, exe)))
        .or_else(|| paths.iter().find(|path| !path.exists()))
        .cloned()
        .ok_or_else(|| {
            format!(
                "A different shortcut already uses the {} shortcut name. Rename it and try again.",
                kind.label()
            )
        })?;
    if let Some(folder) = link_path.parent() {
        std::fs::create_dir_all(folder).map_err(|e| e.to_string())?;
    }
    let folder = exe.parent().unwrap_or(exe);
    with_com(|| unsafe {
        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
        link.SetPath(&HSTRING::from(exe.as_os_str()))?;
        link.SetWorkingDirectory(&HSTRING::from(folder.as_os_str()))?;
        link.SetArguments(&HSTRING::from(kind.arguments()))?;
        link.SetIconLocation(&HSTRING::from(exe.as_os_str()), 0)?;
        link.SetDescription(&HSTRING::from(product::NAME))?;
        link.cast::<IPersistFile>()?
            .Save(&HSTRING::from(link_path.as_os_str()), true)
    })?;

    if !shortcut_is_valid(kind, exe) {
        return Err(format!(
            "Windows saved the {} shortcut without a working target. Try the install again.",
            kind.label()
        ));
    }
    Ok(())
}

/// Whether the shortcut opens `exe` with the arguments expected for its role.
pub fn shortcut_is_valid(kind: Shortcut, exe: &Path) -> bool {
    kind.paths()
        .iter()
        .filter_map(|path| details_at(path))
        .any(|link| valid_link(&link, kind, exe))
}

/// Whether a shortcut is ours, including old broken links which still have
/// our description, icon, and working directory but no target.
pub fn shortcut_is_managed(kind: Shortcut, exe: &Path) -> bool {
    kind.paths()
        .iter()
        .filter_map(|path| details_at(path))
        .any(|link| managed_link(&link, exe))
}

pub fn remove_shortcut(kind: Shortcut, exe: &Path) {
    for path in kind.paths() {
        if details_at(&path).is_some_and(|link| managed_link(&link, exe)) {
            let _ = std::fs::remove_file(path);
        }
    }
}

/// The path with 8.3 short names expanded and links resolved, without the
/// `\\?\` prefix `canonicalize` adds; unchanged when it does not exist.
pub fn real_path(path: &Path) -> PathBuf {
    match path.canonicalize() {
        Ok(real) => {
            let text = real.to_string_lossy();
            match text.strip_prefix(r"\\?\UNC\") {
                Some(unc) => PathBuf::from(format!(r"\\{unc}")),
                None => PathBuf::from(text.strip_prefix(r"\\?\").unwrap_or(&text)),
            }
        }
        Err(_) => path.to_path_buf(),
    }
}

/// Same file, however either path is spelled (short names, case, slashes).
pub fn same_file(a: &Path, b: &Path) -> bool {
    same_path(a, b) || same_path(&real_path(a), &real_path(b))
}

pub fn same_path(a: &Path, b: &Path) -> bool {
    let normal = |p: &Path| {
        let text = p.to_string_lossy().replace('/', "\\");
        text.trim_end_matches('\\').to_lowercase()
    };
    normal(a) == normal(b)
}

/// Whether `path` is `dir` or inside it.
pub fn is_within(path: &Path, dir: &Path) -> bool {
    let normal = |p: &Path| p.to_string_lossy().replace('/', "\\").to_lowercase();
    let (path, dir) = (normal(path), normal(dir));
    let dir = dir.trim_end_matches('\\');
    path == dir || path.starts_with(&format!("{dir}\\"))
}

pub fn message(title: &str, text: &str, error: bool) {
    let style = if error { MB_ICONERROR } else { MB_ICONWARNING };
    let (title, text) = (wide(title), wide(text));
    // SAFETY: both strings are NUL-terminated and outlive the call.
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            text.as_ptr(),
            title.as_ptr(),
            MB_OK | style,
        )
    };
}

pub fn ask(title: &str, text: &str) -> bool {
    let (title, text) = (wide(title), wide(text));
    // SAFETY: as above.
    let answer = unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            text.as_ptr(),
            title.as_ptr(),
            MB_YESNO | MB_ICONWARNING,
        )
    };
    answer == IDYES
}

/// Held for the whole run: one setup or uninstaller at a time, per user.
pub struct SingleInstance(HANDLE);

impl SingleInstance {
    pub fn acquire() -> Option<Self> {
        let name = wide(format!("Local\\{}.Setup", product::BINARY));
        // SAFETY: a named mutex; the handle is closed on drop.
        let handle = unsafe { CreateMutexW(std::ptr::null(), 1, name.as_ptr()) };
        if handle.is_null() {
            // Could not even ask: better to run than to refuse.
            return Some(Self(handle));
        }
        if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
            unsafe { CloseHandle(handle) };
            return None;
        }
        Some(Self(handle))
    }
}

impl Drop for SingleInstance {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { CloseHandle(self.0) };
        }
    }
}

/// Starts the installed app, detached from this process.
pub fn launch(exe: &Path) -> Result<(), String> {
    std::process::Command::new(exe)
        .current_dir(exe.parent().unwrap_or(exe))
        .spawn()
        .map(drop)
        .map_err(|e| format!("The app could not be started: {e}"))
}

/// A console program run without a window, for its exit code only.
pub fn run_hidden(program: &Path, args: &[&str]) -> Option<i32> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    std::process::Command::new(program)
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .ok()
        .and_then(|status| status.code())
}

pub fn system32(program: &str) -> PathBuf {
    let windows = std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into());
    PathBuf::from(windows).join("System32").join(program)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn link(
        target: &str,
        folder: &str,
        description: &str,
        icon: &str,
        arguments: &str,
    ) -> ShortcutDetails {
        ShortcutDetails {
            target: PathBuf::from(target),
            working_directory: PathBuf::from(folder),
            description: description.to_string(),
            icon: icon_file(icon),
            arguments: arguments.to_string(),
        }
    }

    #[test]
    fn recognizes_our_old_targetless_shortcut_for_repair() {
        let exe = Path::new(
            r"C:\Users\Thomas\AppData\Local\ThomasThanos\MakeYourLifeEasier\MakeYourLifeEasier.exe",
        );
        let folder = exe.parent().unwrap().to_string_lossy();
        let broken = link(
            "",
            &folder,
            product::NAME,
            &format!("{},0", exe.display()),
            "--autostart",
        );
        assert!(managed_link(&broken, exe));
        assert!(!valid_link(&broken, Shortcut::Startup, exe));
    }

    #[test]
    fn does_not_claim_a_different_shortcut_with_the_same_name() {
        let exe = Path::new(
            r"C:\Users\Thomas\AppData\Local\ThomasThanos\MakeYourLifeEasier\MakeYourLifeEasier.exe",
        );
        let other = link(
            r"C:\Tools\Other.exe",
            r"C:\Tools",
            "Other app",
            r"C:\Tools\Other.exe,0",
            "",
        );
        assert!(!managed_link(&other, exe));
    }

    #[test]
    fn validates_startup_arguments_and_strips_the_icon_index() {
        let exe = Path::new(r"C:\Apps\MakeYourLifeEasier.exe");
        let folder = exe.parent().unwrap().to_string_lossy();
        let startup = link(
            exe.to_str().unwrap(),
            &folder,
            product::NAME,
            &format!("{},0", exe.display()),
            "--autostart",
        );
        let start_menu = link(
            exe.to_str().unwrap(),
            &folder,
            product::NAME,
            &format!("{},0", exe.display()),
            "",
        );
        assert!(valid_link(&startup, Shortcut::Startup, exe));
        assert!(valid_link(&start_menu, Shortcut::StartMenu, exe));
        assert_eq!(icon_file(r"C:\Apps\MakeYourLifeEasier.exe,0"), exe);
    }

    #[test]
    fn paths_compare_like_windows_does() {
        assert!(same_path(
            Path::new(r"C:\Apps\X.exe"),
            Path::new(r"c:/apps/x.EXE")
        ));
        assert!(is_within(
            Path::new(r"C:\Apps\MYLE\ludusavi\l.exe"),
            Path::new(r"C:\apps\myle\")
        ));
        assert!(is_within(
            Path::new(r"C:\Apps\MYLE"),
            Path::new(r"C:\Apps\MYLE")
        ));
        assert!(!is_within(
            Path::new(r"C:\Apps\MYLE2\x.exe"),
            Path::new(r"C:\Apps\MYLE")
        ));
    }
}
