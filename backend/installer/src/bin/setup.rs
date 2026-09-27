// No console window in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// The app, packed by `scripts/build-setup.ps1` (empty in a plain build).
static PAYLOAD: &[u8] = include_bytes!(env!("MYLE_PAYLOAD"));

fn main() {
    std::process::exit(myle_setup::setup_main(PAYLOAD));
}
