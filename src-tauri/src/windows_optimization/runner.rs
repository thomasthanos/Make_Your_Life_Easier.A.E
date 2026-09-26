use std::path::{Path, PathBuf};
use std::time::Duration;

use tauri::ipc::Channel;
use tokio::io::AsyncReadExt;

use crate::apps::process::{self, encode_command};
use crate::console::{Line, LineSplitter};

use super::models::{WindowsOptimizationEvent, WindowsOptimizationStage};
use super::state::{Cancellation, WindowsOptimizationState};

const POLL: Duration = Duration::from_millis(180);
const FINAL_DRAINS: usize = 6;
pub const CTT_COMMAND: &str = "irm https://christitus.com/win | iex";

pub struct Reporter<'a> {
    pub job_id: &'a str,
    pub channel: &'a Channel<WindowsOptimizationEvent>,
    pub state: &'a WindowsOptimizationState,
}

impl Reporter<'_> {
    pub fn stage(&self, stage: WindowsOptimizationStage) {
        self.state.update(self.job_id, stage, None, None, None);
        let _ = self.channel.send(WindowsOptimizationEvent::Stage {
            job_id: self.job_id.to_string(),
            stage,
        });
    }

    pub fn progress(&self, downloaded: u64, total: Option<u64>) {
        let fraction = total
            .filter(|total| *total > 0)
            .map(|total| (downloaded as f64 / total as f64).clamp(0.0, 1.0));
        self.state.update(
            self.job_id,
            self.current_stage(),
            fraction,
            Some(downloaded),
            total,
        );
        let _ = self.channel.send(WindowsOptimizationEvent::Progress {
            job_id: self.job_id.to_string(),
            fraction: fraction.unwrap_or(0.0),
            downloaded: Some(downloaded),
            total,
        });
    }

    pub fn fraction(&self, fraction: f64) {
        let fraction = fraction.clamp(0.0, 1.0);
        self.state.update(
            self.job_id,
            self.current_stage(),
            Some(fraction),
            None,
            None,
        );
        let _ = self.channel.send(WindowsOptimizationEvent::Progress {
            job_id: self.job_id.to_string(),
            fraction,
            downloaded: None,
            total: None,
        });
    }

    pub fn line(&self, text: impl Into<String>) {
        self.output(text.into(), false);
    }

    fn output(&self, text: String, replace: bool) {
        if !text.trim().is_empty() {
            let _ = self.channel.send(WindowsOptimizationEvent::Line {
                job_id: self.job_id.to_string(),
                text,
                replace,
            });
        }
    }

    fn current_stage(&self) -> WindowsOptimizationStage {
        self.state
            .active()
            .filter(|active| active.job_id == self.job_id)
            .map(|active| active.stage)
            .unwrap_or(WindowsOptimizationStage::Preparing)
    }
}

struct Workspace {
    log: PathBuf,
    stop: PathBuf,
}

impl Workspace {
    fn new(job_id: &str) -> Self {
        let base = std::env::temp_dir().join(format!("myle-windows-opt-{job_id}"));
        let workspace = Self {
            log: base.with_extension("log"),
            stop: base.with_extension("stop"),
        };
        let _ = std::fs::remove_file(&workspace.log);
        let _ = std::fs::remove_file(&workspace.stop);
        workspace
    }
}

impl Drop for Workspace {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.log);
        let _ = std::fs::remove_file(&self.stop);
    }
}

pub async fn launch_ctt(
    cancellation: &Cancellation,
    reporter: &Reporter<'_>,
) -> Result<i32, String> {
    let workspace = Workspace::new(reporter.job_id);
    reporter.stage(WindowsOptimizationStage::WaitingForAdmin);
    reporter.line("Waiting for administrator approval…");
    let script = ctt_wrapper(&workspace.log, &workspace.stop);
    run_elevated_wrapper(script, &workspace, cancellation, reporter).await
}

pub async fn launch_program(
    executable: &Path,
    cancellation: &Cancellation,
    reporter: &Reporter<'_>,
) -> Result<i32, String> {
    let workspace = Workspace::new(reporter.job_id);
    reporter.stage(WindowsOptimizationStage::WaitingForAdmin);
    reporter.line("Waiting for administrator approval…");
    let script = program_wrapper(executable, &workspace.log, &workspace.stop);
    run_elevated_wrapper(script, &workspace, cancellation, reporter).await
}

async fn run_elevated_wrapper(
    script: String,
    workspace: &Workspace,
    cancellation: &Cancellation,
    reporter: &Reporter<'_>,
) -> Result<i32, String> {
    cancellation.register_stop_file(workspace.stop.clone());
    let arguments = vec![
        "-NoProfile".to_string(),
        "-NonInteractive".to_string(),
        "-ExecutionPolicy".to_string(),
        "Bypass".to_string(),
        "-EncodedCommand".to_string(),
        encode_command(&script),
    ];
    let mut launched = Box::pin(process::run_elevated("powershell.exe", &arguments, true));
    let mut tail = Tail::new(&workspace.log);
    let mut running_reported = false;
    let code = loop {
        tokio::select! {
            code = &mut launched => break code?,
            _ = tokio::time::sleep(POLL) => {
                if cancellation.is_cancelled() {
                    let _ = std::fs::write(&workspace.stop, b"");
                }
                if tail.drain(reporter).await && !running_reported {
                    running_reported = true;
                    reporter.stage(WindowsOptimizationStage::Running);
                }
            }
        }
    };
    for _ in 0..FINAL_DRAINS {
        tail.drain(reporter).await;
        tokio::time::sleep(POLL).await;
    }
    tail.finish(reporter);
    Ok(code)
}

fn ctt_payload() -> String {
    format!(
        "$ErrorActionPreference = 'Stop'\n\
         Write-Output 'Downloading and starting the official Chris Titus Utility bootstrap…'\n\
         {CTT_COMMAND}\n"
    )
}

fn ctt_wrapper(log: &Path, stop: &Path) -> String {
    let powershell = system32("WindowsPowerShell\\v1.0\\powershell.exe");
    let encoded = encode_command(&ctt_payload());
    let command = format!(
        "\"{}\" -NoProfile -ExecutionPolicy Bypass -EncodedCommand {encoded}",
        powershell.display()
    );
    monitored_wrapper(
        &system32("cmd.exe"),
        &[cmd_tail(&command, log)],
        log,
        stop,
        true,
    )
}

fn program_wrapper(executable: &Path, log: &Path, stop: &Path) -> String {
    monitored_wrapper(executable, &[], log, stop, false)
}

fn monitored_wrapper(
    executable: &Path,
    arguments: &[String],
    log: &Path,
    stop: &Path,
    no_new_window: bool,
) -> String {
    let argument_list = if arguments.is_empty() {
        String::new()
    } else {
        format!(
            " -ArgumentList {}",
            arguments
                .iter()
                .map(|argument| ps_quote(argument))
                .collect::<Vec<_>>()
                .join(",")
        )
    };
    let window = if no_new_window { " -NoNewWindow" } else { "" };
    format!(
        "$ErrorActionPreference = 'Stop'\n\
         [IO.File]::WriteAllText({}, \"Administrator approval accepted.`r`n\", [Text.UTF8Encoding]::new($false))\n\
         $p = Start-Process -FilePath {}{argument_list}{window} -PassThru\n\
         while (-not $p.HasExited) {{\n\
           if (Test-Path -LiteralPath {}) {{ & {} /PID $p.Id /T /F | Out-Null; break }}\n\
           Start-Sleep -Milliseconds 200\n\
         }}\n\
         $p.WaitForExit()\n\
         exit $p.ExitCode\n",
        ps_quote(&log.to_string_lossy()),
        ps_quote(&executable.to_string_lossy()),
        ps_quote(&stop.to_string_lossy()),
        ps_quote(&system32("taskkill.exe").to_string_lossy()),
    )
}

fn cmd_tail(command: &str, log: &Path) -> String {
    format!("/d /s /c \"{command} >> \"{}\" 2>&1\"", log.display())
}

fn system32(relative: &str) -> PathBuf {
    std::env::var_os("WINDIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Windows"))
        .join("System32")
        .join(relative)
}

fn ps_quote(text: &str) -> String {
    format!("'{}'", text.replace('\'', "''"))
}

#[derive(Default)]
struct DisplayRow {
    visible: bool,
    last_text: Option<String>,
}

struct Tail {
    path: PathBuf,
    file: Option<tokio::fs::File>,
    splitter: LineSplitter,
    display: DisplayRow,
    buffer: [u8; 8192],
}

impl Tail {
    fn new(path: &Path) -> Self {
        Self {
            path: path.to_path_buf(),
            file: None,
            splitter: LineSplitter::default(),
            display: DisplayRow::default(),
            buffer: [0; 8192],
        }
    }

    async fn drain(&mut self, reporter: &Reporter<'_>) -> bool {
        if self.file.is_none() {
            self.file = tokio::fs::File::open(&self.path).await.ok();
        }
        let Some(file) = self.file.as_mut() else {
            return false;
        };
        loop {
            match file.read(&mut self.buffer).await {
                Ok(0) | Err(_) => break,
                Ok(read) => {
                    for line in self.splitter.feed(&self.buffer[..read]) {
                        emit_clean(line, &mut self.display, reporter);
                    }
                }
            }
        }
        true
    }

    fn finish(&mut self, reporter: &Reporter<'_>) {
        if let Some(line) = self.splitter.finish() {
            emit_clean(line, &mut self.display, reporter);
        }
    }
}

fn emit_clean(line: Line, display: &mut DisplayRow, reporter: &Reporter<'_>) {
    if !line.replace {
        display.visible = false;
        display.last_text = None;
    }
    let text = strip_terminal_sequences(&line.text).trim().to_string();
    if text.is_empty() {
        return;
    }
    if line.replace && display.visible && display.last_text.as_deref() == Some(text.as_str()) {
        return;
    }
    let replace = line.replace && display.visible;
    reporter.output(text.clone(), replace);
    display.visible = true;
    display.last_text = Some(text);
}

fn strip_terminal_sequences(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(character) = chars.next() {
        match character {
            '\u{1b}' => match chars.next() {
                Some('[') => skip_csi(&mut chars),
                Some(']' | 'P' | 'X' | '^' | '_') => skip_string_escape(&mut chars),
                Some(value) => skip_short_escape(value, &mut chars),
                None => {}
            },
            '\u{009b}' => skip_csi(&mut chars),
            '\u{0008}' => {
                output.pop();
            }
            '\t' => output.push(' '),
            value if value.is_control() => {}
            value => output.push(value),
        }
    }
    output
}

fn skip_csi(chars: &mut std::iter::Peekable<std::str::Chars<'_>>) {
    for value in chars.by_ref() {
        if ('@'..='~').contains(&value) {
            break;
        }
    }
}

fn skip_string_escape(chars: &mut std::iter::Peekable<std::str::Chars<'_>>) {
    let mut escaped = false;
    for value in chars.by_ref() {
        if value == '\u{0007}' || (escaped && value == '\\') {
            break;
        }
        escaped = value == '\u{1b}';
    }
}

fn skip_short_escape(first: char, chars: &mut std::iter::Peekable<std::str::Chars<'_>>) {
    if (' '..='/').contains(&first) {
        for value in chars.by_ref() {
            if ('0'..='~').contains(&value) {
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ctt_payload_contains_only_the_fixed_official_command() {
        let payload = ctt_payload();
        assert_eq!(CTT_COMMAND, "irm https://christitus.com/win | iex");
        assert!(payload.ends_with(&format!("{CTT_COMMAND}\n")));
        assert!(!payload.contains("Invoke-Expression $"));
    }

    #[test]
    fn elevated_wrappers_are_stoppable_and_quote_paths() {
        let script = program_wrapper(
            Path::new(r"C:\Users\it's\Sparkle.exe"),
            Path::new(r"C:\Temp\out.log"),
            Path::new(r"C:\Temp\stop.flag"),
        );
        assert!(script.contains(r"'C:\Users\it''s\Sparkle.exe'"));
        assert!(script.contains(r"'C:\Temp\stop.flag'"));
        assert!(script.contains("taskkill.exe"));
        assert!(script.contains("$p.WaitForExit()"));
    }

    #[test]
    fn ansi_colours_cursor_codes_and_hyperlinks_are_removed() {
        let raw =
            "\u{1b}[90mDim\u{1b}[0m \u{1b}[2K\u{1b}]8;;https://example.com\u{7}link\u{1b}]8;;\u{7}";
        assert_eq!(strip_terminal_sequences(raw), "Dim link");
    }
}
