mod account;
mod apps;
mod cleaner;
mod console;
mod download;
pub mod game_saves;
mod maintenance;
mod spotify_hub;
mod updater;
mod window_sizing;
mod windows_optimization;

/// Handles the privileged Auto-Logon helper before Tauri and the
/// single-instance plugin start. `None` means this is a normal app launch.
pub fn run_windows_auto_logon_helper() -> Option<i32> {
    windows_optimization::run_auto_logon_helper_from_args()
}

use tauri::{AppHandle, Manager, WindowEvent};

/// Called by the splash once the update check is done: sizes and shows the
/// main window (preloaded while hidden), then removes the splash.
#[tauri::command]
async fn finish_startup(app: AppHandle) -> Result<(), String> {
    show_main(&app).map_err(|e| e.to_string())
}

fn show_main(app: &AppHandle) -> tauri::Result<()> {
    let Some(main) = app.get_webview_window("main") else {
        return Ok(());
    };
    if !main.is_visible()? {
        window_sizing::fit_to_screen(&main)?;
        main.show()?;
        // Launched by the Startup shortcut: stay out of the way in the taskbar.
        if std::env::args().any(|a| a == "--autostart") {
            main.minimize()?;
        } else {
            main.set_focus()?;
        }
    }
    if let Some(splash) = app.get_webview_window("splash") {
        // destroy() skips CloseRequested, which would otherwise quit the app.
        splash.destroy()?;
    }
    Ok(())
}

pub fn run() {
    let account_state = account::AccountState::default();
    let cleanup = apps::Cleanup::default();
    let jobs = apps::Jobs::default();
    let running = maintenance::Running::default();
    let game_saves_state = game_saves::GameSavesState::default();
    let spotify_hub_state = spotify_hub::SpotifyHubState::default();
    let windows_optimization_state = windows_optimization::WindowsOptimizationState::default();
    let app = tauri::Builder::default()
        // Must be registered first. A second launch focuses the running app.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let window = ["main", "splash"]
                .into_iter()
                .filter_map(|label| app.get_webview_window(label))
                .find(|w| w.is_visible().unwrap_or(false));
            if let Some(window) = window {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(account_state)
        .manage(jobs.clone())
        .manage(cleanup.clone())
        .manage(running.clone())
        .manage(game_saves_state.clone())
        .manage(spotify_hub_state.clone())
        .manage(windows_optimization_state.clone())
        .setup({
            let cleanup = cleanup.clone();
            move |app| {
                // Sweeps anything a previous run could not delete. Off the main
                // thread: a locked file costs a retry delay.
                if let Ok(dir) = app.path().app_config_dir() {
                    std::thread::spawn(move || cleanup.init(dir.join("pending-cleanup.json")));
                }
                // The installer of the last update, if any. This runs before
                // the splash can start a new download into the same folder.
                // An installer still exiting after relaunching us stays
                // locked and goes on a later start.
                let _ = std::fs::remove_dir_all(updater::update_dir());
                // If the splash never gets to call finish_startup (a failed
                // update check, a broken page), show the window anyway.
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    loop {
                        tokio::time::sleep(std::time::Duration::from_secs(12)).await;
                        // A slow update check (feed, then GitHub) or an update
                        // download legitimately keeps the splash up.
                        if updater::is_checking() || updater::is_updating() {
                            continue;
                        }
                        let hidden = handle
                            .get_webview_window("main")
                            .is_some_and(|w| !w.is_visible().unwrap_or(false));
                        if hidden {
                            let _ = show_main(&handle);
                        }
                        return;
                    }
                });
                Ok(())
            }
        })
        .on_window_event(|window, event| {
            // Closing the splash (Alt+F4) before the main window is shown would
            // leave a hidden, running app behind, so quit instead.
            if window.label() == "splash" && matches!(event, WindowEvent::CloseRequested { .. }) {
                window.app_handle().exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![
            finish_startup,
            updater::check_for_update,
            updater::install_update,
            account::account_profile,
            account::account_sign_in,
            account::account_cancel_sign_in,
            account::account_sign_out,
            account::account_pull,
            account::account_push,
            apps::apps_installed,
            apps::apps_cancel,
            apps::winget::apps_search,
            apps::winget::apps_package_links,
            apps::winget::apps_install_winget,
            apps::winget::apps_install_ignoring_hash,
            apps::custom::apps_custom_catalog,
            apps::custom::apps_install_custom,
            apps::custom::apps_activate,
            apps::io::apps_export_list,
            apps::io::apps_import_list,
            apps::creative::creative_catalog,
            apps::creative::creative_install,
            cleaner::cleaner_categories,
            cleaner::cleaner_scan,
            cleaner::cleaner_scan_elevated,
            cleaner::cleaner_clean,
            cleaner::cleaner_clean_elevated,
            maintenance::maintenance_cards,
            maintenance::maintenance_run,
            maintenance::maintenance_cancel,
            maintenance::maintenance_running,
            spotify_hub::spotify_hub_get_state,
            spotify_hub::spotify_hub_preview_purge,
            spotify_hub::spotify_hub_run,
            spotify_hub::spotify_hub_cancel,
            windows_optimization::windows_optimization_get_state,
            windows_optimization::windows_optimization_run,
            windows_optimization::windows_optimization_cancel,
            windows_optimization::windows_optimization_set_auto_logon,
            windows_optimization::windows_optimization_restart_to_firmware,
            game_saves::commands::game_saves_get_state,
            game_saves::commands::game_saves_pick_backup_folder,
            game_saves::commands::game_saves_set_backup_folder,
            game_saves::commands::game_saves_open_backup_folder,
            game_saves::commands::game_saves_open_game_folder,
            game_saves::commands::game_saves_detect_cloud_folders,
            game_saves::commands::game_saves_refresh_roots,
            game_saves::commands::game_saves_add_root,
            game_saves::commands::game_saves_remove_root,
            game_saves::commands::game_saves_set_schedule,
            game_saves::commands::game_saves_set_game_auto_backup,
            game_saves::commands::game_saves_pick_folder,
            game_saves::commands::game_saves_upsert_custom_game,
            game_saves::commands::game_saves_remove_custom_game,
            game_saves::commands::game_saves_set_path_mapping,
            game_saves::commands::game_saves_remove_path_mapping,
            game_saves::commands::game_saves_scan,
            game_saves::commands::game_saves_update_database,
            game_saves::commands::game_saves_backup,
            game_saves::commands::game_saves_restore,
            game_saves::commands::game_saves_undo_last_restore,
            game_saves::commands::game_saves_sync_export,
            game_saves::commands::game_saves_sync_import,
            game_saves::commands::game_saves_cancel
        ])
        .build(tauri::generate_context!())
        .expect("error while building the application");

    app.run(move |_app, event| {
        // Downloaded packages are removed once the app is closed.
        if matches!(event, tauri::RunEvent::Exit) {
            // An elevated scan runs in its own process, so it has to be told
            // to stop rather than dying with the window.
            running.stop_all();
            game_saves_state.cancel();
            spotify_hub_state.cancel_all();
            windows_optimization_state.cancel_all();
            jobs.cancel_all();
            cleanup.run();
        }
    });
}
