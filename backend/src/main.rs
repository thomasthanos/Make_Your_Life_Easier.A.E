// Prevents an extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Some(exit_code) = myle_lib::cleaner::run_elevated_helper_from_args() {
        std::process::exit(exit_code);
    }
    if let Some(exit_code) = myle_lib::run_windows_auto_logon_helper() {
        std::process::exit(exit_code);
    }
    if std::env::args().any(|argument| argument == "--game-saves-auto-backup") {
        std::process::exit(myle_lib::game_saves::run_headless_auto_backup());
    }
    myle_lib::run()
}
