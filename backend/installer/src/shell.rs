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

    fn arguments(self) -> &'static str {
        match self {
            // The app minimizes itself when it sees this (backend/src/lib.rs).
            Shortcut::Startup => "--autostart",
            _ => "",
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

/// Writes (or rewrites) a shortcut to `exe`.
pub fn create_shortcut(kind: Shortcut, exe: &Path) -> Result<(), String> {
    use windows::Win32::System::Com::{CLSCTX_INPROC_SERVER, CoCreateInstance, IPersistFile};
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};
    use windows::core::{HSTRING, Interface};

    let link_path = kind
        .path()
        .ok_or("the shortcut folder could not be found")?;
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
    })
}

/// Whether a shortcut exists and opens `exe` (so a same-named shortcut the
/// user made for something else is never touched).
pub fn shortcut_points_to(kind: Shortcut, exe: &Path) -> bool {
    use windows::Win32::System::Com::{
        CLSCTX_INPROC_SERVER, CoCreateInstance, IPersistFile, STGM_READ,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, SLGP_RAWPATH, ShellLink};
    use windows::core::{HSTRING, Interface};

    let Some(link_path) = kind.path().filter(|path| path.is_file()) else {
        return false;
    };
    let target = with_com(|| unsafe {
        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
        link.cast::<IPersistFile>()?
            .Load(&HSTRING::from(link_path.as_os_str()), STGM_READ)?;
        let mut buffer = [0u16; 1024];
        link.GetPath(&mut buffer, std::ptr::null_mut(), SLGP_RAWPATH.0 as u32)?;
        let length = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
        Ok(PathBuf::from(OsString::from_wide(&buffer[..length])))
    });
    target.is_ok_and(|target| same_file(&target, exe))
}

pub fn remove_shortcut(kind: Shortcut) {
    if let Some(path) = kind.path() {
        let _ = std::fs::remove_file(path);
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
