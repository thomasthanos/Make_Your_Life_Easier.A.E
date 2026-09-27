//! Make Your Life Easier's own setup and uninstaller.
//!
//! One crate, two programs sharing everything but the payload:
//! - `setup.exe` carries the app (see `payload`) and installs it per user,
//!   with a window (`ui`), a progress-only window (`/P`) or none (`/S`, which
//!   the in-app updater uses as `/S /UPDATE /R`);
//! - `uninstall.exe` is installed next to the app and removes it again.

mod cleanup;
mod cli;
mod engine;
pub mod payload;
mod processes;
mod product;
mod registry;
mod shell;
mod ui;
mod webview2;

use std::path::PathBuf;
use std::time::Duration;

use cli::Cli;

/// Exit codes of the silent modes (0 is success).
const FAILED: i32 = 1;
const DECLINED: i32 = 2;
const ALREADY_RUNNING: i32 = 3;
const STILL_RUNNING: i32 = 4;

pub fn setup_main(payload: &'static [u8]) -> i32 {
    let cli = cli::parse(std::env::args().skip(1));
    let Some(_lock) = shell::SingleInstance::acquire() else {
        if !cli.silent {
            shell::message(product::NAME, "Setup is already running.", false);
        }
        return ALREADY_RUNNING;
    };
    if payload.is_empty() {
        if !cli.silent {
            shell::message(
                product::NAME,
                "This setup was built without the app inside.",
                true,
            );
        }
        return FAILED;
    }
    if cli.silent {
        return silent_install(payload, &cli);
    }
    if !webview2::installed() {
        let ok = shell::ask(
            &format!("{} Setup", product::NAME),
            &format!(
                "{} needs the Microsoft Edge WebView2 Runtime, which is not on this PC yet.\n\n\
                 Download and install it from Microsoft now?",
                product::NAME
            ),
        );
        if !ok {
            return DECLINED;
        }
        if let Err(error) = webview2::install(false) {
            shell::message(product::NAME, &error, true);
            return FAILED;
        }
    }
    ui::run(ui::Mode::Install { payload }, cli)
}

/// `/S`: no window. The updater waits for nothing and reads no output, so
/// the exit code is the only report.
fn silent_install(payload: &'static [u8], cli: &Cli) -> i32 {
    let dir = cli
        .dir
        .clone()
        .or_else(registry::install_dir)
        .unwrap_or_else(engine::default_dir);
    // The updater quits the app right after starting us: give it time.
    let grace = if cli.update {
        Duration::from_secs(20)
    } else {
        Duration::from_secs(3)
    };
    if engine::close_running(&dir, grace).is_err() {
        return STILL_RUNNING;
    }
    if !cli.update && !webview2::installed() && webview2::install(true).is_err() {
        return FAILED;
    }
    let fresh = !cli.no_shortcuts && !cli.update;
    let options = engine::InstallOptions {
        dir,
        desktop: fresh,
        start_menu: fresh,
        startup: fresh,
        keep_shortcuts: cli.update || cli.no_shortcuts,
    };
    match engine::install(payload, &options, &mut |_| {}) {
        Ok(exe) => {
            if cli.relaunch {
                let _ = shell::launch(&exe);
            }
            0
        }
        Err(_) => FAILED,
    }
}

pub fn uninstall_main() -> i32 {
    let cli = cli::parse(std::env::args().skip(1));
    let Some(_lock) = shell::SingleInstance::acquire() else {
        if !cli.silent {
            shell::message(product::NAME, "Setup is already running.", false);
        }
        return ALREADY_RUNNING;
    };
    let Some(dir) = install_dir_to_remove() else {
        if !cli.silent {
            shell::message(
                product::NAME,
                &format!("{} is not installed.", product::NAME),
                false,
            );
        }
        return FAILED;
    };
    // Without WebView2 there is no window: ask with a plain message box.
    let windowless = !cli.silent && !webview2::installed();
    if windowless
        && !shell::ask(
            &format!("Uninstall {}", product::NAME),
            &format!("Remove {} from this PC?", product::NAME),
        )
    {
        return DECLINED;
    }
    if cli.silent || windowless {
        if engine::close_running(&dir, Duration::from_secs(3)).is_err() {
            return STILL_RUNNING;
        }
        return match engine::uninstall(&dir, cli.purge, &mut |_| {}) {
            Ok(after_exit) => {
                after_exit.spawn();
                0
            }
            Err(_) => FAILED,
        };
    }
    ui::run(ui::Mode::Uninstall { dir }, cli)
}

/// The registered install, or the folder this uninstaller sits in if the
/// app is there (an install whose registry entry is already gone).
fn install_dir_to_remove() -> Option<PathBuf> {
    let has_app = |dir: &PathBuf| dir.join(product::exe_name()).is_file();
    registry::install_dir().filter(has_app).or_else(|| {
        std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(PathBuf::from))
            .filter(has_app)
    })
}
