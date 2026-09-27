use std::fs;
use std::path::Path;

use super::commands;
use super::engine::Engine;
use super::models::{BackupSchedule, GameSaveStatus, OperationKind, ScheduledBackupResult};
use super::parser;
use super::settings;
use super::state::GameSavesState;

/// Entry point used by `main.rs` before Tauri creates any windows.
///
/// Exit codes: 0 success/not due, 2 another operation is running, 3 setup or
/// engine failure, 4 a backup completed with per-game failures.
pub fn run_headless_auto_backup() -> i32 {
    tauri::async_runtime::block_on(run())
}

async fn run() -> i32 {
    let root = match settings::headless_config_root() {
        Ok(root) => root,
        Err(error) => return report_error(3, &error),
    };
    let state = GameSavesState::default();
    let operation = match state.begin(&root, OperationKind::ScheduledBackup) {
        Ok(operation) => operation,
        Err(error) => return report_error(2, &error),
    };
    let mut value = match settings::load_from_root(&root) {
        Ok(value) => value,
        Err(error) => return report_error(3, &error),
    };
    if value.schedule == BackupSchedule::Off {
        return 0;
    }

    let started = parser::now();
    if !is_due(&value, started) {
        return 0;
    }
    value.last_scheduled_attempt = Some(started);
    if let Err(error) = settings::save_to_root(&root, &value) {
        return report_error(3, &error);
    }

    let result = run_due(&root, &mut value, &operation).await;
    let completed = parser::now();
    // A backup can take minutes, and the app may have changed the settings
    // meanwhile (a new custom game, another backup folder). Only the fields
    // this run owns are written onto a fresh copy, so none of that is lost.
    let database_games = value.database_games;
    if let Ok(fresh) = settings::load_from_root(&root) {
        value = fresh;
    }
    value.last_scheduled_attempt = Some(started);
    if database_games > 0 {
        value.database_games = database_games;
    }
    let exit = match result {
        Ok((processed_games, failed_games)) => {
            let success = failed_games.is_empty();
            value.last_scheduled_result = Some(ScheduledBackupResult {
                attempted_at: started,
                completed_at: completed,
                processed_games,
                failed_games: failed_games.clone(),
                error: None,
            });
            if success {
                value.last_scheduled_success = Some(completed);
                0
            } else {
                4
            }
        }
        Err(error) => {
            value.last_scheduled_result = Some(ScheduledBackupResult {
                attempted_at: started,
                completed_at: completed,
                processed_games: 0,
                failed_games: Vec::new(),
                error: Some(error.clone()),
            });
            report_error(3, &error)
        }
    };
    if let Err(error) = settings::save_to_root(&root, &value) {
        return report_error(3, &error);
    }
    exit
}

async fn run_due(
    root: &Path,
    value: &mut super::models::GameSavesSettings,
    operation: &super::state::OperationHandle,
) -> Result<(u64, Vec<String>), String> {
    let backup = value
        .backup_folder
        .as_deref()
        .filter(|path| !path.trim().is_empty())
        .ok_or("Automatic backup needs a backup folder.")?;
    settings::validate_backup_folder_for_root(Path::new(backup), root, value)?;
    fs::create_dir_all(backup).map_err(|error| error.to_string())?;

    let engine = Engine::headless(root.to_path_buf())?;
    engine.prepare(value)?;
    let (scan, metadata) = commands::scan_with_engine(&engine, value, operation, None).await?;
    if metadata.supported_games > 0 {
        value.database_games = metadata.supported_games;
    }
    let titles: Vec<String> = scan
        .on_this_pc
        .into_iter()
        .filter(|game| game.auto_backup)
        .filter(|game| {
            matches!(
                game.status,
                GameSaveStatus::NotBackedUp | GameSaveStatus::ChangedSinceBackup
            )
        })
        .map(|game| game.title)
        .collect();
    if titles.is_empty() {
        return Ok((0, Vec::new()));
    }

    let result = commands::backup_titles(&engine, backup, &titles, operation, &|_| {}).await?;
    Ok((result.processed_games, result.failed_games))
}

fn is_due(value: &super::models::GameSavesSettings, now: u64) -> bool {
    let Some(interval) = value.schedule.interval_seconds() else {
        return false;
    };
    value
        .last_scheduled_attempt
        .is_none_or(|last| now.saturating_sub(last) >= interval / 2)
}

fn report_error(code: i32, error: &str) -> i32 {
    eprintln!("Game Saves automatic backup: {error}");
    code
}

#[cfg(test)]
mod tests {
    use super::super::models::GameSavesSettings;
    use super::*;

    #[test]
    fn duplicate_scheduler_launches_are_suppressed() {
        let value = GameSavesSettings {
            schedule: BackupSchedule::Daily,
            last_scheduled_attempt: Some(1_000_000),
            ..Default::default()
        };
        assert!(!is_due(&value, 1_000_100));
        assert!(is_due(&value, 1_000_000 + 12 * 60 * 60));
    }
}
