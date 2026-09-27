//! What can only be deleted once this process is gone: the uninstaller's
//! own exe, the install folder it sits in, and the temporary WebView2 profile
//! the window used. A hidden PowerShell waits for us to exit, then deletes.

use std::path::PathBuf;

use base64::Engine;

use crate::shell;

#[derive(Default)]
pub struct AfterExit {
    /// Deleted outright (files, or folders with everything in them).
    pub remove: Vec<PathBuf>,
    /// Deleted only if empty by then, in this order.
    pub remove_if_empty: Vec<PathBuf>,
}

impl AfterExit {
    pub fn is_empty(&self) -> bool {
        self.remove.is_empty() && self.remove_if_empty.is_empty()
    }

    /// Starts the helper. It outlives this process by design.
    pub fn spawn(&self) {
        if self.is_empty() {
            return;
        }
        let script = self.script(std::process::id());
        let encoded = {
            let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
            base64::engine::general_purpose::STANDARD.encode(bytes)
        };
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        let _ =
            std::process::Command::new(shell::system32(r"WindowsPowerShell\v1.0\powershell.exe"))
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-WindowStyle",
                    "Hidden",
                    "-EncodedCommand",
                    &encoded,
                ])
                .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
                .spawn();
    }

    fn script(&self, pid: u32) -> String {
        let list = |paths: &[PathBuf]| {
            let quoted: Vec<String> = paths
                .iter()
                .map(|p| format!("'{}'", p.to_string_lossy().replace('\'', "''")))
                .collect();
            format!("@({})", quoted.join(","))
        };
        // WebView2's helper processes linger a moment after the window
        // closes, so a busy file is simply tried again.
        format!(
            "$ErrorActionPreference = 'SilentlyContinue'\n\
             try {{ Wait-Process -Id {pid} -Timeout 120 }} catch {{}}\n\
             $remove = {remove}\n\
             $empty = {empty}\n\
             for ($i = 0; $i -lt 40; $i++) {{\n\
               foreach ($p in $remove) {{ if (Test-Path -LiteralPath $p) {{ Remove-Item -LiteralPath $p -Recurse -Force }} }}\n\
               foreach ($d in $empty) {{ if ((Test-Path -LiteralPath $d) -and -not (Get-ChildItem -LiteralPath $d -Force)) {{ Remove-Item -LiteralPath $d -Force }} }}\n\
               if (-not ($remove | Where-Object {{ Test-Path -LiteralPath $_ }})) {{ break }}\n\
               Start-Sleep -Milliseconds 500\n\
             }}\n",
            remove = list(&self.remove),
            empty = list(&self.remove_if_empty),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_script_waits_for_this_process_and_quotes_every_path() {
        let cleanup = AfterExit {
            remove: vec![PathBuf::from(
                r"C:\Users\O'Neil\AppData\Local\Temp\myle-setup-1",
            )],
            remove_if_empty: vec![PathBuf::from(r"C:\Apps\MYLE")],
        };
        let script = cleanup.script(4242);
        assert!(script.contains("Wait-Process -Id 4242"));
        assert!(script.contains(r"'C:\Users\O''Neil\AppData\Local\Temp\myle-setup-1'"));
        assert!(script.contains(r"$empty = @('C:\Apps\MYLE')"));
    }
}
