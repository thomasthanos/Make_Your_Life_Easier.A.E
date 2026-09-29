//! Starting with Windows: the Startup shortcut the setup offers (it runs the
//! app with `--autostart`), and how the app opens then. Settings can switch
//! both; the setup reads the same registry values.

use std::path::PathBuf;

use serde::Serialize;
use winreg::RegKey;
use winreg::enums::HKEY_CURRENT_USER;

use crate::storage::{FOLDER, PUBLISHER};

/// The shortcut's name, as the setup names it (`product::NAME`), and its
/// fallback name for when another file already had that one.
const NAME: &str = "MYLE";
const LEGACY_NAME: &str = "Make Your Life Easier";

/// Shared with the setup (`backend/installer/src/registry.rs`), in the key it
/// keeps the install folder in.
const START_MINIMIZED: &str = "StartMinimized";
/// The setup's remembered state of the Startup shortcut: 0 off, 2 made
/// (`engine::state` in the installer). Kept in step here, so an update
/// neither brings back a shortcut switched off in Settings nor treats one
/// switched on here as deleted.
const STARTUP_STATE: &str = "StartupShortcut";
const STATE_OFF: u32 = 0;
const STATE_MADE: u32 = 2;

fn key() -> String {
    format!(r"Software\{PUBLISHER}\{FOLDER}")
}

pub fn launched_at_sign_in() -> bool {
    std::env::args().any(|arg| arg == "--autostart")
}

/// A yes/no setting in the app's registry key; `default` when unset.
pub(crate) fn flag(name: &str, default: bool) -> bool {
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(key())
        .and_then(|key| key.get_value::<u32, _>(name))
        .map_or(default, |value| value != 0)
}

pub(crate) fn set_flag(name: &str, value: bool) -> Result<(), String> {
    set_value(name, u32::from(value))
}

/// Unset (an install from before the switch) means minimized, as it was.
pub fn start_minimized() -> bool {
    flag(START_MINIMIZED, true)
}

fn set_value(name: &str, value: u32) -> Result<(), String> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(key())
        .map_err(|error| error.to_string())?;
    key.set_value(name, &value)
        .map_err(|error| error.to_string())
}

/// `...\Start Menu\Programs\Startup`, the folder Windows runs at sign-in.
fn startup_folder() -> Option<PathBuf> {
    let roaming = std::env::var_os("APPDATA")?;
    Some(PathBuf::from(roaming).join(r"Microsoft\Windows\Start Menu\Programs\Startup"))
}

fn startup_links() -> Vec<PathBuf> {
    let Some(folder) = startup_folder() else {
        return Vec::new();
    };
    [
        format!("{NAME}.lnk"),
        format!("{NAME} - {PUBLISHER}.lnk"),
        format!("{LEGACY_NAME}.lnk"),
        format!("{LEGACY_NAME} - {PUBLISHER}.lnk"),
    ]
        .into_iter()
        .map(|name| folder.join(name))
        .filter(|path| path.is_file())
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupSettings {
    /// A Startup shortcut is there.
    enabled: bool,
    minimized: bool,
    /// Only the installed app can add itself (a dev build would point
    /// Windows at the build folder).
    can_change: bool,
}

#[tauri::command]
pub fn startup_get() -> StartupSettings {
    StartupSettings {
        enabled: !startup_links().is_empty(),
        minimized: start_minimized(),
        can_change: crate::updater::installed_exe().is_some(),
    }
}

#[tauri::command]
pub async fn startup_set_enabled(enabled: bool) -> Result<(), String> {
    let exe = crate::updater::installed_exe()
        .ok_or("Only the installed app can start with Windows.")?;
    if enabled {
        let folder = startup_folder().ok_or("The Startup folder could not be found.")?;
        std::fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
        let link = folder.join(format!("{NAME}.lnk"));
        let dir = exe.parent().unwrap_or(&exe);
        // The same shortcut the setup writes, so the setup and uninstaller
        // recognise it as the app's.
        let script = format!(
            "$l = (New-Object -ComObject WScript.Shell).CreateShortcut({link}); \
             $l.TargetPath = {exe}; $l.Arguments = '--autostart'; \
             $l.WorkingDirectory = {dir}; $l.IconLocation = {icon}; \
             $l.Description = {name}; $l.Save()",
            link = crate::apps::process::ps_quote(&link.to_string_lossy()),
            exe = crate::apps::process::ps_quote(&exe.to_string_lossy()),
            dir = crate::apps::process::ps_quote(&dir.to_string_lossy()),
            icon = crate::apps::process::ps_quote(&format!("{},0", exe.display())),
            name = crate::apps::process::ps_quote(NAME),
        );
        let status = crate::apps::process::hidden("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .status()
            .await
            .map_err(|error| error.to_string())?;
        if !status.success() || !link.is_file() {
            return Err("Windows would not create the Startup shortcut.".into());
        }
        set_value(STARTUP_STATE, STATE_MADE)
    } else {
        for link in startup_links() {
            std::fs::remove_file(&link).map_err(|error| error.to_string())?;
        }
        set_value(STARTUP_STATE, STATE_OFF)
    }
}

#[tauri::command]
pub fn startup_set_minimized(minimized: bool) -> Result<(), String> {
    set_value(START_MINIMIZED, u32::from(minimized))
}
