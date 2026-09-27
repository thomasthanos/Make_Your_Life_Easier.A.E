//! The setup window: one frameless WebView2 window (`installer.html`) and
//! the commands its page calls. The page decides nothing about files; it
//! passes the user's choices here and shows the progress it is sent.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::cleanup::AfterExit;
use crate::cli::Cli;
use crate::engine::{self, InstallOptions, Progress};
use crate::{payload, processes, product, registry, shell};

pub enum Mode {
    Install { payload: &'static [u8] },
    Uninstall { dir: PathBuf },
}

struct Context {
    mode: Mode,
    cli: Cli,
    /// Set while files are being changed: the window cannot be closed then.
    busy: AtomicBool,
    installed_exe: Mutex<Option<PathBuf>>,
    /// Deleted once the window has closed.
    after_exit: Arc<Mutex<AfterExit>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Installed {
    version: Option<String>,
    dir: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Shortcuts {
    desktop: bool,
    start_menu: bool,
    startup: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SetupState {
    mode: &'static str,
    product: &'static str,
    /// What this setup installs, or the installed version when uninstalling.
    version: String,
    installed: Option<Installed>,
    dir: String,
    /// Bytes on disk once installed.
    size: u64,
    shortcuts: Shortcuts,
    /// `/P`: install at once, then close by itself.
    passive: bool,
    /// Whether this setup carries the app at all (a dev build may not).
    ready: bool,
}

#[tauri::command(async)]
fn setup_state(context: State<'_, Context>) -> SetupState {
    let existing = registry::install_dir().filter(|dir| dir.join(product::exe_name()).is_file());
    let installed = existing.as_ref().map(|dir| Installed {
        version: registry::installed_version(),
        dir: dir.display().to_string(),
    });
    match &context.mode {
        Mode::Install { payload: bytes } => {
            let header = payload::open(bytes).ok().map(|(header, _)| header);
            let dir = install_dir(&context);
            // A fresh install offers every shortcut, as the old setup made
            // them all; a reinstall starts from what the user kept.
            let [desktop, start_menu, startup] = match &existing {
                Some(dir) => engine::existing_shortcuts(dir),
                None => [true; 3],
            };
            SetupState {
                mode: "install",
                product: product::NAME,
                version: header
                    .as_ref()
                    .map_or_else(|| product::VERSION.to_string(), |h| h.version.clone()),
                installed,
                dir: dir.display().to_string(),
                size: header.as_ref().map_or(0, payload::Header::total_size),
                shortcuts: Shortcuts {
                    desktop,
                    start_menu,
                    startup,
                },
                passive: context.cli.passive,
                ready: header.is_some(),
            }
        }
        Mode::Uninstall { dir } => SetupState {
            mode: "uninstall",
            product: product::NAME,
            version: registry::installed_version().unwrap_or_else(|| product::VERSION.to_string()),
            installed,
            dir: dir.display().to_string(),
            size: folder_size(dir),
            shortcuts: Shortcuts {
                desktop: false,
                start_menu: false,
                startup: false,
            },
            passive: context.cli.passive,
            ready: true,
        },
    }
}

fn folder_size(dir: &Path) -> u64 {
    std::fs::read_dir(dir)
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| match entry.file_type() {
                    Ok(kind) if kind.is_dir() => folder_size(&entry.path()),
                    Ok(_) => entry.metadata().map_or(0, |m| m.len()),
                    Err(_) => 0,
                })
                .sum()
        })
        .unwrap_or(0)
}

/// Names of the programs running from the folder, for the "close it?" prompt.
#[tauri::command(async)]
fn setup_running(dir: String) -> Vec<String> {
    let mut names: Vec<String> = processes::running_in(Path::new(&dir))
        .iter()
        .filter_map(|p| p.path.file_name().map(|n| n.to_string_lossy().into_owned()))
        .collect();
    names.sort();
    names.dedup();
    names
}

/// Rejects a folder before anything happens, with a sentence for the page.
#[tauri::command(async)]
fn setup_check_folder(dir: String) -> Result<(), String> {
    engine::check_dir(Path::new(dir.trim()))
}

/// Clears `busy` however the operation ends.
struct Busy<'a>(&'a AtomicBool);

impl<'a> Busy<'a> {
    fn start(flag: &'a AtomicBool) -> Result<Self, String> {
        if flag.swap(true, Ordering::SeqCst) {
            return Err("Setup is already working.".into());
        }
        Ok(Self(flag))
    }
}

impl Drop for Busy<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// Where the app goes. It is not the user's choice: always the app's own
/// folder (%LOCALAPPDATA%\ThomasThanos\MakeYourLifeEasier), or wherever an
/// earlier install already is. Only `/D=` on the command line (tests) moves it.
fn install_dir(context: &Context) -> PathBuf {
    context
        .cli
        .dir
        .clone()
        .or_else(|| registry::install_dir().filter(|dir| dir.join(product::exe_name()).is_file()))
        .unwrap_or_else(engine::default_dir)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallRequest {
    desktop: bool,
    start_menu: bool,
    startup: bool,
}

#[tauri::command]
async fn setup_install(
    context: State<'_, Context>,
    request: InstallRequest,
    on_event: Channel<Progress>,
) -> Result<String, String> {
    let Mode::Install { payload: bytes } = context.mode else {
        return Err("This is the uninstaller.".into());
    };
    let _busy = Busy::start(&context.busy)?;
    let options = InstallOptions {
        dir: install_dir(&context),
        desktop: request.desktop,
        start_menu: request.start_menu,
        startup: request.startup,
        keep_shortcuts: false,
    };
    let exe = tauri::async_runtime::spawn_blocking(move || {
        let mut report = |event: Progress| {
            let _ = on_event.send(event);
        };
        report(Progress::Stage {
            stage: engine::Stage::ClosingApp,
        });
        engine::close_running(&options.dir, Duration::ZERO)?;
        engine::install(bytes, &options, &mut report)
    })
    .await
    .map_err(|e| e.to_string())??;
    let shown = exe
        .parent()
        .map(|dir| dir.display().to_string())
        .unwrap_or_default();
    *context
        .installed_exe
        .lock()
        .unwrap_or_else(|p| p.into_inner()) = Some(exe);
    Ok(shown)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UninstallRequest {
    remove_data: bool,
}

#[tauri::command]
async fn setup_uninstall(
    context: State<'_, Context>,
    request: UninstallRequest,
    on_event: Channel<Progress>,
) -> Result<(), String> {
    let Mode::Uninstall { dir } = &context.mode else {
        return Err("This is the installer.".into());
    };
    let _busy = Busy::start(&context.busy)?;
    let dir = dir.clone();
    let after_exit = tauri::async_runtime::spawn_blocking(move || {
        let mut report = |event: Progress| {
            let _ = on_event.send(event);
        };
        report(Progress::Stage {
            stage: engine::Stage::ClosingApp,
        });
        engine::close_running(&dir, Duration::ZERO)?;
        engine::uninstall(&dir, request.remove_data, &mut report)
    })
    .await
    .map_err(|e| e.to_string())??;
    context
        .after_exit
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .append(after_exit);
    Ok(())
}

#[tauri::command(async)]
fn setup_launch(context: State<'_, Context>) -> Result<(), String> {
    let exe = context
        .installed_exe
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone()
        .ok_or("Nothing was installed yet.")?;
    shell::launch(&exe)
}

#[tauri::command]
fn setup_exit(app: tauri::AppHandle, context: State<'_, Context>) {
    if !context.busy.load(Ordering::SeqCst) {
        app.exit(0);
    }
}

/// Opens the window and runs until it closes. Returns the exit code and
/// what is left to delete now that the window is gone.
pub fn run(mode: Mode, cli: Cli) -> (i32, AfterExit) {
    // The window's own browser profile lives in %TEMP% and goes with it: the
    // setup never creates the app's profile, and the uninstaller never holds
    // files in the folders it is removing.
    let webview_dir = std::env::temp_dir().join(format!(
        "{}-setup-{}",
        product::BINARY,
        uuid::Uuid::new_v4().simple()
    ));
    let mut after_exit = AfterExit::default();
    after_exit.remove.push(webview_dir.clone());
    let after_exit = Arc::new(Mutex::new(after_exit));
    let uninstalling = matches!(mode, Mode::Uninstall { .. });
    let context = Context {
        mode,
        cli,
        busy: AtomicBool::new(false),
        installed_exe: Mutex::new(None),
        after_exit: after_exit.clone(),
    };

    let app = tauri::Builder::default()
        .manage(context)
        .setup(move |app| {
            let title = if uninstalling {
                format!("Uninstall {}", product::NAME)
            } else {
                format!("{} Setup", product::NAME)
            };
            WebviewWindowBuilder::new(app, "setup", WebviewUrl::App("installer.html".into()))
                .title(title)
                .inner_size(720.0, 480.0)
                .resizable(false)
                .maximizable(false)
                .decorations(false)
                .shadow(true)
                .center()
                .visible(false)
                .background_color(tauri::window::Color(10, 12, 18, 255))
                .data_directory(webview_dir.clone())
                .build()?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing mid-copy would leave half an app behind.
            if let WindowEvent::CloseRequested { api, .. } = event
                && window.state::<Context>().busy.load(Ordering::SeqCst)
            {
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            setup_state,
            setup_running,
            setup_check_folder,
            setup_install,
            setup_uninstall,
            setup_launch,
            setup_exit
        ])
        .build(tauri::generate_context!());
    let app = match app {
        Ok(app) => app,
        Err(error) => {
            shell::message(
                product::NAME,
                &format!("Setup could not open its window: {error}"),
                true,
            );
            return (
                1,
                std::mem::take(&mut *after_exit.lock().unwrap_or_else(|p| p.into_inner())),
            );
        }
    };
    let code = app.run_return(|_, _| {});
    let pending = std::mem::take(&mut *after_exit.lock().unwrap_or_else(|p| p.into_inner()));
    (code, pending)
}
