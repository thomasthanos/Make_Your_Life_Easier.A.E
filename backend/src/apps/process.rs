//! Child-process helpers: hidden console processes, UAC elevation, killing.

use std::ffi::OsStr;

use base64::Engine;

/// Keeps console programs (winget, taskkill, powershell) from flashing a window.
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
/// Windows ERROR_ELEVATION_REQUIRED: the program's manifest demands admin.
pub const ERROR_ELEVATION_REQUIRED: i32 = 740;
/// Windows ERROR_CANCELLED: returned by `run_elevated` when UAC is declined.
pub const ERROR_CANCELLED: i32 = 1223;

pub fn hidden(program: impl AsRef<OsStr>) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Runs `program args` through a UAC prompt, waits for it and returns its exit
/// code, or `ERROR_CANCELLED` if the user declined the prompt.
pub async fn run_elevated(
    program: &str,
    args: &[String],
    hide_window: bool,
) -> Result<i32, String> {
    let mut script = format!(
        "$p = Start-Process -FilePath {} -Verb RunAs -Wait -PassThru",
        ps_quote(program)
    );
    if !args.is_empty() {
        let list: Vec<String> = args.iter().map(|a| ps_quote(a)).collect();
        script.push_str(&format!(" -ArgumentList {}", list.join(",")));
    }
    if hide_window {
        script.push_str(" -WindowStyle Hidden");
    }
    let script = format!("try {{ {script}; exit $p.ExitCode }} catch {{ exit {ERROR_CANCELLED} }}");
    let status = hidden("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-EncodedCommand",
        ])
        .arg(encode_command(&script))
        .status()
        .await
        .map_err(|e| e.to_string())?;
    Ok(status.code().unwrap_or(-1))
}

/// PowerShell `-EncodedCommand` payload: base64 of the UTF-16LE script.
/// Sidesteps every command-line quoting rule.
pub fn encode_command(script: &str) -> String {
    let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

/// A PowerShell single-quoted string literal.
pub(crate) fn ps_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

/// Kills a process and everything it started (e.g. winget and its installer).
pub fn kill_tree(pid: u32) {
    use std::os::windows::process::CommandExt;
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_are_escaped_for_powershell() {
        assert_eq!(ps_quote("it's"), "'it''s'");
    }

    #[test]
    fn encoded_command_is_utf16le_base64() {
        // "hi" -> 68 00 69 00
        assert_eq!(encode_command("hi"), "aABpAA==");
    }
}
