//! The setup's window is a WebView2 page, like the app itself. Windows 11
//! always has the runtime; an older Windows 10 may not, so it is installed
//! first with Microsoft's own bootstrapper (as the NSIS setup did).

use std::path::PathBuf;

use winreg::RegKey;
use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};

use crate::shell;

const CLIENT: &str = r"Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
const BOOTSTRAPPER: &str = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";

pub fn installed() -> bool {
    let keys = [
        (
            HKEY_LOCAL_MACHINE,
            format!(r"SOFTWARE\WOW6432Node\{CLIENT}"),
        ),
        (HKEY_LOCAL_MACHINE, format!(r"SOFTWARE\{CLIENT}")),
        (HKEY_CURRENT_USER, format!(r"Software\{CLIENT}")),
    ];
    keys.iter().any(|(hive, path)| {
        RegKey::predef(*hive)
            .open_subkey_with_flags(path, KEY_READ)
            .and_then(|key| key.get_value::<String, _>("pv"))
            .is_ok_and(|version| !version.is_empty() && version != "0.0.0.0")
    })
}

/// Downloads and runs the bootstrapper. `quiet` hides Microsoft's window.
pub fn install(quiet: bool) -> Result<(), String> {
    let target: PathBuf = std::env::temp_dir().join("MicrosoftEdgeWebview2Setup.exe");
    let _ = std::fs::remove_file(&target);
    let target_text = target.to_string_lossy().into_owned();
    // curl ships with Windows 10 1803 and later; PowerShell covers the rest.
    let downloaded = shell::run_hidden(
        &shell::system32("curl.exe"),
        &["-fsSL", "--retry", "2", "-o", &target_text, BOOTSTRAPPER],
    ) == Some(0)
        || shell::run_hidden(
            &shell::system32(r"WindowsPowerShell\v1.0\powershell.exe"),
            &[
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                &format!(
                    "Invoke-WebRequest -UseBasicParsing -Uri '{BOOTSTRAPPER}' -OutFile '{}'",
                    target_text.replace('\'', "''")
                ),
            ],
        ) == Some(0);
    if !downloaded || !target.is_file() {
        return Err("The Microsoft Edge WebView2 Runtime could not be downloaded.".into());
    }
    let mut command = std::process::Command::new(&target);
    if quiet {
        command.args(["/silent", "/install"]);
    } else {
        command.arg("/install");
    }
    let status = command.status().map_err(|e| e.to_string());
    let _ = std::fs::remove_file(&target);
    status?;
    if installed() {
        Ok(())
    } else {
        Err("The Microsoft Edge WebView2 Runtime was not installed.".into())
    }
}
