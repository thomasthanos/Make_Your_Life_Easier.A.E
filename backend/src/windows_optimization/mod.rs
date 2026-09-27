//! Launches two allowlisted Windows optimization tools: Chris Titus WinUtil
//! and the portable Sparkle release. The webview can select only an action ID;
//! commands, URLs, download targets and process arguments remain backend-owned.

mod actions;
mod autologon;
mod cache;
mod elevated;
mod firmware_restart;
mod models;
mod release;
mod runner;
mod state;

use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::apps::{Cleanup, Jobs};
use crate::download::{self, CANCELLED};

pub use models::{
    AutoLogonOutcome, FirmwareRestartOutcome, WindowsOptimizationAction, WindowsOptimizationEvent,
    WindowsOptimizationOutcome, WindowsOptimizationResult, WindowsOptimizationSnapshot,
};
pub use state::WindowsOptimizationState;

#[tauri::command]
pub async fn windows_optimization_get_state(
    app: AppHandle,
    state: State<'_, WindowsOptimizationState>,
) -> Result<WindowsOptimizationSnapshot, String> {
    let auto_app = app.clone();
    let operation = state.active_auto_logon();
    let auto_logon =
        tauri::async_runtime::spawn_blocking(move || autologon::snapshot(&auto_app, operation));
    let cached = tauri::async_runtime::spawn_blocking(move || cache::detect(&app))
        .await
        .map_err(download::err)??;
    let auto_logon = auto_logon.await.map_err(download::err)?;
    Ok(WindowsOptimizationSnapshot {
        sparkle: cached.state,
        auto_logon,
        firmware_restart: firmware_restart::snapshot(state.firmware_restart_active()),
        active_job: state.active(),
        last_outcome: state.last_outcome(),
    })
}

#[tauri::command]
pub async fn windows_optimization_restart_to_firmware(
    app: AppHandle,
    state: State<'_, WindowsOptimizationState>,
    jobs: State<'_, Jobs>,
    maintenance: State<'_, crate::maintenance::Running>,
    game_saves: State<'_, crate::game_saves::GameSavesState>,
) -> Result<FirmwareRestartOutcome, String> {
    let job_id = format!("windows-firmware-restart-{}", Uuid::new_v4().simple());
    // Keep this handle alive through capability detection, UAC and the
    // shutdown.exe result so Install Apps, Spotify Hub and other exclusive
    // maintenance actions cannot begin concurrently.
    let _exclusive = jobs.start_exclusive(&job_id)?;
    // Reserve the independent maintenance and Game Saves lanes for the full
    // UAC/process window. The Game Saves guard holds its cross-process file
    // lock, so a scheduled headless backup cannot race this restart.
    let _maintenance_reservation = maintenance.reserve_for_firmware_restart()?;
    let _game_saves_reservation = crate::game_saves::reserve_operations(&app, &game_saves)?;
    ensure_updater_idle(crate::updater::is_updating())?;
    // The guard clears the Processing state even if spawning, UAC or the
    // native process fails and this function returns early through `?`.
    let _active = state.begin_firmware_restart()?;
    firmware_restart::restart().await
}

fn ensure_updater_idle(updater_active: bool) -> Result<(), String> {
    if updater_active {
        return Err("Wait for the application update to finish first.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn windows_optimization_set_auto_logon(
    app: AppHandle,
    state: State<'_, WindowsOptimizationState>,
    jobs: State<'_, Jobs>,
    enabled: bool,
) -> Result<AutoLogonOutcome, String> {
    let job_id = format!("windows-auto-logon-{}", Uuid::new_v4().simple());
    let _exclusive = jobs.start_exclusive(&job_id)?;
    let operation = if enabled {
        models::AutoLogonOperation::Enable
    } else {
        models::AutoLogonOperation::Disable
    };
    state.begin_auto_logon(operation)?;
    let result = autologon::set_auto_logon(&app, enabled).await;
    state.finish_auto_logon();
    result
}

pub(crate) fn run_auto_logon_helper_from_args() -> Option<i32> {
    autologon::run_helper_from_args()
}

#[tauri::command]
pub async fn windows_optimization_run(
    app: AppHandle,
    state: State<'_, WindowsOptimizationState>,
    jobs: State<'_, Jobs>,
    cleanup: State<'_, Cleanup>,
    action: WindowsOptimizationAction,
    on_event: Channel<WindowsOptimizationEvent>,
) -> Result<WindowsOptimizationOutcome, String> {
    let job_id = format!("windows-optimization-{}", Uuid::new_v4().simple());
    let app_job = jobs.start_exclusive(&job_id)?;
    let cancellation = state.begin(job_id.clone(), action)?;
    let reporter = runner::Reporter {
        job_id: &job_id,
        channel: &on_event,
        state: &state,
    };
    reporter.stage(models::WindowsOptimizationStage::Preparing);

    let result = match action {
        WindowsOptimizationAction::LaunchCtt => actions::launch_ctt(&cancellation, &reporter).await,
        WindowsOptimizationAction::LaunchSparkle => {
            actions::launch_sparkle(&app, &app_job, &cancellation, &reporter, &cleanup).await
        }
    };

    match result {
        Ok(outcome) => {
            state.finish(outcome.clone());
            Ok(outcome)
        }
        Err(error) if error == CANCELLED || cancellation.is_cancelled() => {
            let outcome = WindowsOptimizationOutcome::new(
                WindowsOptimizationResult::Cancelled,
                job_id,
                action,
                None,
            );
            state.finish(outcome.clone());
            Ok(outcome)
        }
        Err(error) => {
            state.fail(&job_id);
            Err(error)
        }
    }
}

#[tauri::command(async)]
pub fn windows_optimization_cancel(
    state: State<'_, WindowsOptimizationState>,
    jobs: State<'_, Jobs>,
    job_id: String,
) {
    state.cancel(&job_id);
    jobs.cancel(&job_id);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn events_and_actions_use_camel_case() {
        let value = serde_json::to_value(WindowsOptimizationEvent::Stage {
            job_id: "job".into(),
            stage: models::WindowsOptimizationStage::WaitingForAdmin,
        })
        .unwrap();
        assert_eq!(
            value,
            serde_json::json!({
                "event": "stage",
                "data": { "jobId": "job", "stage": "waitingForAdmin" }
            })
        );
        assert_eq!(
            serde_json::to_value(WindowsOptimizationAction::LaunchSparkle).unwrap(),
            serde_json::json!("launchSparkle")
        );
    }

    #[test]
    fn firmware_restart_preflight_rejects_an_active_updater() {
        assert!(ensure_updater_idle(false).is_ok());
        assert!(ensure_updater_idle(true).is_err());
    }

    #[test]
    fn firmware_restart_ipc_contract_is_camel_case() {
        let snapshot = models::FirmwareRestartSnapshot {
            firmware_type: models::FirmwareType::LegacyBios,
            available: false,
            blocked_reason: Some("Legacy mode".into()),
            active: true,
        };
        assert_eq!(
            serde_json::to_value(snapshot).unwrap(),
            serde_json::json!({
                "firmwareType": "legacyBios",
                "available": false,
                "blockedReason": "Legacy mode",
                "active": true
            })
        );
        assert_eq!(
            serde_json::to_value(models::FirmwareRestartOutcome {
                result: models::FirmwareRestartResult::NeedsAdmin,
                note: None,
            })
            .unwrap(),
            serde_json::json!({ "result": "needsAdmin", "note": null })
        );
    }
}
