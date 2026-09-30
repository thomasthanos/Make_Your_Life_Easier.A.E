use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use super::models::{GAME_SAVES_SETTINGS_VERSION, GameSavesSettings, RootSource};
use super::{atomic, detection};

const SETTINGS_FILE: &str = "settings.json";
pub(crate) fn config_root(app: &AppHandle) -> Result<PathBuf, String> {
    let _ = app;
    crate::storage::roaming_dir().map(|path| path.join("game-saves"))
}

pub(crate) fn engine_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(config_root(app)?.join("ludusavi"))
}

pub(crate) fn safety_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(config_root(app)?.join("safety"))
}

pub(crate) fn headless_config_root() -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("MYLE_GAME_SAVES_CONFIG")
        && !path.trim().is_empty()
    {
        return Ok(PathBuf::from(path));
    }
    crate::storage::roaming_dir().map(|path| path.join("game-saves"))
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(config_root(app)?.join(SETTINGS_FILE))
}

pub(crate) fn load(app: &AppHandle) -> Result<GameSavesSettings, String> {
    load_from_path(&settings_path(app)?)
}

pub(crate) fn load_from_root(root: &Path) -> Result<GameSavesSettings, String> {
    load_from_path(&root.join(SETTINGS_FILE))
}

fn load_from_path(path: &Path) -> Result<GameSavesSettings, String> {
    let mut settings = match fs::read_to_string(path) {
        // A byte-order mark, as Notepad and PowerShell 5 save UTF-8, is not
        // a reason to lose every setting.
        Ok(text) => serde_json::from_str::<GameSavesSettings>(text.strip_prefix('\u{feff}').unwrap_or(&text))
            .map_err(|e| format!("Game Saves settings are invalid: {e}"))?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => GameSavesSettings::default(),
        Err(e) => return Err(e.to_string()),
    };

    if settings.version > GAME_SAVES_SETTINGS_VERSION {
        return Err(format!(
            "Game Saves settings version {} is newer than this app supports ({}).",
            settings.version, GAME_SAVES_SETTINGS_VERSION
        ));
    }
    // Version 0 was used by early development builds with the same serialized
    // fields. Normalization below performs its only required migration.
    settings.version = GAME_SAVES_SETTINGS_VERSION;
    normalize(&mut settings);
    Ok(settings)
}

pub(crate) fn initialize(app: &AppHandle) -> Result<GameSavesSettings, String> {
    let mut settings = load(app)?;
    let mut changed = false;

    if settings.backup_folder.is_none() {
        let base = app
            .path()
            .document_dir()
            .unwrap_or(crate::storage::roaming_dir()?);
        settings.backup_folder = Some(
            base.join("Make Your Life Easier")
                .join("Game Saves Backups")
                .to_string_lossy()
                .into_owned(),
        );
        changed = true;
    }

    if settings.roots.is_empty() {
        settings.roots = detection::detect_roots();
        changed = !settings.roots.is_empty() || changed;
    }

    if changed {
        save(app, &settings)?;
    }
    Ok(settings)
}

pub(crate) fn save(app: &AppHandle, settings: &GameSavesSettings) -> Result<(), String> {
    save_to_path(&settings_path(app)?, settings)
}

pub(crate) fn save_to_root(root: &Path, settings: &GameSavesSettings) -> Result<(), String> {
    save_to_path(&root.join(SETTINGS_FILE), settings)
}

fn save_to_path(path: &Path, settings: &GameSavesSettings) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(settings).map_err(|e| e.to_string())?;
    atomic::write(path, &json)
}

fn normalize(settings: &mut GameSavesSettings) {
    settings.auto_backup_excluded_game_ids.sort();
    settings.auto_backup_excluded_game_ids.dedup();

    settings.roots.retain(|root| !root.path.trim().is_empty());
    // Older builds stored a drive-root library as `D:`, which means "the
    // current folder on D:" rather than the drive itself.
    for root in &mut settings.roots {
        if root.path.len() == 2 && root.path.ends_with(':') {
            root.path.push('\\');
        }
    }
    settings.roots.sort_by(|a, b| a.id.cmp(&b.id));
    settings.roots.dedup_by(|a, b| a.id == b.id);

    if !valid_schedule_time(&settings.schedule_time) {
        settings.schedule_time = "03:00".into();
    }

    settings
        .custom_games
        .retain(|game| !game.name.trim().is_empty() && !game.paths.is_empty());
    for game in &mut settings.custom_games {
        game.paths.retain(|path| !path.trim().is_empty());
        game.paths.sort_by_key(|path| path.to_ascii_lowercase());
        game.paths.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
        if game
            .install_path
            .as_deref()
            .is_some_and(|path| path.trim().is_empty())
        {
            game.install_path = None;
        }
    }
    settings.custom_games.sort_by(|a, b| a.id.cmp(&b.id));
    settings.custom_games.dedup_by(|a, b| a.id == b.id);

    settings.path_mappings.retain(|mapping| {
        !mapping.game_id.trim().is_empty()
            && !mapping.source.trim().is_empty()
            && !mapping.target.trim().is_empty()
    });
    settings.path_mappings.sort_by(|a, b| {
        a.game_id.cmp(&b.game_id).then(
            a.source
                .to_ascii_lowercase()
                .cmp(&b.source.to_ascii_lowercase()),
        )
    });
    settings
        .path_mappings
        .dedup_by(|a, b| a.game_id == b.game_id && a.source.eq_ignore_ascii_case(&b.source));
}

pub(crate) fn valid_schedule_time(value: &str) -> bool {
    let Some((hour, minute)) = value.split_once(':') else {
        return false;
    };
    hour.len() == 2
        && minute.len() == 2
        && hour.parse::<u8>().is_ok_and(|hour| hour < 24)
        && minute.parse::<u8>().is_ok_and(|minute| minute < 60)
}

pub(crate) fn validate_backup_folder(
    app: &AppHandle,
    candidate: &Path,
    settings: &GameSavesSettings,
) -> Result<(), String> {
    let candidate = resolved_normalized(candidate)?;
    if candidate.parent().is_none() {
        return Err("Choose a folder, not the root of a drive.".into());
    }

    validate_backup_folder_for_root(&candidate, &config_root(app)?, settings)?;

    if let Ok(executable) = std::env::current_exe()
        && let Some(install) = executable.parent()
    {
        reject_overlap(
            &candidate,
            install,
            "The backup folder cannot overlap the application install folder.",
        )?;
    }
    Ok(())
}

pub(crate) fn validate_backup_folder_for_root(
    candidate: &Path,
    config_root: &Path,
    settings: &GameSavesSettings,
) -> Result<(), String> {
    let candidate = resolved_normalized(candidate)?;
    if is_drive_root(&candidate) {
        return Err("Choose a folder, not the root of a drive.".into());
    }

    let config = resolved_normalized(config_root)?;
    if overlaps(&candidate, &config) {
        return Err("The backup folder cannot contain the application's settings.".into());
    }

    if let Ok(windir) = std::env::var("WINDIR")
        && overlaps(&candidate, &resolved_normalized(Path::new(&windir))?)
    {
        return Err("The backup folder cannot be inside the Windows folder.".into());
    }

    for variable in ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"] {
        if let Some(program_files) = std::env::var_os(variable)
            && overlaps(&candidate, &resolved_normalized(Path::new(&program_files))?)
        {
            return Err("The backup folder cannot be inside Program Files.".into());
        }
    }

    // A game folder on a drive that is not connected right now (an external
    // Steam library) cannot be resolved. It also cannot overlap a folder that
    // does resolve, so it is skipped instead of blocking every backup.
    for root in &settings.roots {
        let Ok(root_path) = resolved_normalized(Path::new(&root.path)) else {
            continue;
        };
        if overlaps(&candidate, &root_path) {
            return Err(format!(
                "The backup folder cannot overlap the game folder {}.",
                root.path
            ));
        }
    }
    for game in &settings.custom_games {
        for path in &game.paths {
            let Ok(game_path) = resolved_normalized(Path::new(path)) else {
                continue;
            };
            if overlaps(&candidate, &game_path) {
                return Err(format!(
                    "The backup folder cannot overlap the save folder for {}.",
                    game.name
                ));
            }
        }
    }
    Ok(())
}

pub(crate) fn validate_restore_target(
    app: &AppHandle,
    candidate: &Path,
    settings: &GameSavesSettings,
) -> Result<(), String> {
    let candidate = resolved_normalized(candidate)?;
    if is_drive_root(&candidate) {
        return Err("Choose a folder inside a drive, not the drive root.".into());
    }
    reject_overlap(
        &candidate,
        &config_root(app)?,
        "A restore folder cannot overlap the application's settings.",
    )?;
    if let Some(backup) = settings.backup_folder.as_deref() {
        reject_overlap(
            &candidate,
            Path::new(backup),
            "A restore folder cannot overlap the backup folder.",
        )?;
    }
    if let Ok(windir) = std::env::var("WINDIR") {
        reject_overlap(
            &candidate,
            Path::new(&windir),
            "A restore folder cannot be inside the Windows folder.",
        )?;
    }
    for variable in ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"] {
        if let Some(program_files) = std::env::var_os(variable) {
            reject_overlap(
                &candidate,
                Path::new(&program_files),
                "A restore folder cannot be inside Program Files.",
            )?;
        }
    }
    if let Ok(executable) = std::env::current_exe()
        && let Some(install) = executable.parent()
    {
        reject_overlap(
            &candidate,
            install,
            "A restore folder cannot overlap the application install folder.",
        )?;
    }
    Ok(())
}

pub(crate) fn absolute_normalized(path: &Path) -> Result<PathBuf, String> {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(path)
    };
    Ok(absolute.components().collect())
}

/// Whether the drive `path` is on is there right now. A cloud drive (Google
/// Drive's G:) or a USB disk is there only while its app runs or it is
/// plugged in.
pub(crate) fn drive_connected(path: &Path) -> bool {
    absolute_normalized(path)
        .ok()
        .and_then(|absolute| absolute.ancestors().last().map(Path::to_path_buf))
        .is_some_and(|root| root.exists())
}

/// Why a folder on a drive that is not there cannot be used.
pub(crate) fn drive_missing(path: &Path) -> String {
    format!(
        "{} cannot be reached: its drive is not connected. If it is in Google Drive, OneDrive or another cloud app, start the app and try again.",
        path.display()
    )
}

/// Resolve reparse points/junctions in the existing portion of a path before
/// comparing protected locations. This prevents a visually harmless folder
/// from redirecting backups or restores into the app, Windows, or save data.
fn resolved_normalized(path: &Path) -> Result<PathBuf, String> {
    let absolute = absolute_normalized(path)?;
    if !drive_connected(&absolute) {
        return Err(drive_missing(path));
    }
    let mut existing = absolute.as_path();
    let mut suffix = Vec::new();
    while !existing.exists() {
        let name = existing
            .file_name()
            .ok_or_else(|| format!("The folder cannot be resolved: {}", path.display()))?;
        suffix.push(name.to_os_string());
        existing = existing
            .parent()
            .ok_or_else(|| format!("The folder cannot be resolved: {}", path.display()))?;
    }
    let mut resolved = fs::canonicalize(existing).map_err(|error| {
        format!(
            "The folder cannot be resolved ({}): {error}",
            path.display()
        )
    })?;
    for component in suffix.into_iter().rev() {
        resolved.push(component);
    }
    Ok(resolved.components().collect())
}

pub(crate) fn overlaps(a: &Path, b: &Path) -> bool {
    let a = a
        .to_string_lossy()
        .trim_end_matches(['\\', '/'])
        .to_ascii_lowercase();
    let b = b
        .to_string_lossy()
        .trim_end_matches(['\\', '/'])
        .to_ascii_lowercase();
    a == b
        || a.strip_prefix(&b)
            .is_some_and(|rest| rest.starts_with(['\\', '/']))
        || b.strip_prefix(&a)
            .is_some_and(|rest| rest.starts_with(['\\', '/']))
}

pub(crate) fn paths_equal(a: &Path, b: &Path) -> bool {
    let Ok(a) = resolved_normalized(a) else {
        return false;
    };
    let Ok(b) = resolved_normalized(b) else {
        return false;
    };
    a.to_string_lossy()
        .trim_end_matches(['\\', '/'])
        .eq_ignore_ascii_case(b.to_string_lossy().trim_end_matches(['\\', '/']))
}

fn reject_overlap(candidate: &Path, protected: &Path, message: &str) -> Result<(), String> {
    let protected = resolved_normalized(protected)?;
    if overlaps(candidate, &protected) {
        Err(message.into())
    } else {
        Ok(())
    }
}

fn is_drive_root(path: &Path) -> bool {
    path.parent().is_none()
        || path
            .parent()
            .is_some_and(|parent| parent.as_os_str().is_empty())
}

pub(crate) fn merge_detected_roots(settings: &mut GameSavesSettings) {
    let manual: Vec<_> = settings
        .roots
        .iter()
        .filter(|root| root.source == RootSource::Manual)
        .cloned()
        .collect();
    settings.roots = detection::detect_roots();
    for root in manual {
        if !settings.roots.iter().any(|known| known.id == root.id) {
            settings.roots.push(root);
        }
    }
    normalize(settings);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_saved_with_a_byte_order_mark_still_load() {
        let path = std::env::temp_dir().join(format!("myle-game-saves-bom-{}.json", uuid::Uuid::new_v4()));
        let settings = GameSavesSettings {
            backup_folder: Some(r"G:\My Drive\Backups".into()),
            ..Default::default()
        };
        let text = serde_json::to_string(&settings).unwrap();
        fs::write(&path, format!("\u{feff}{text}")).unwrap();
        let loaded = load_from_path(&path);
        let _ = fs::remove_file(&path);
        assert_eq!(loaded.unwrap().backup_folder.as_deref(), Some(r"G:\My Drive\Backups"));
    }

    #[test]
    fn a_folder_on_a_drive_that_is_not_there_says_so() {
        // Google Drive's G: while Google Drive is not running.
        let Some(letter) = ('D'..='Z').rev().find(|letter| !Path::new(&format!(r"{letter}:\")).exists()) else {
            return;
        };
        let folder = PathBuf::from(format!(r"{letter}:\My Drive\Make Your Life Easier\Game Saves Backups"));
        assert!(!drive_connected(&folder));
        let error = resolved_normalized(&folder).unwrap_err();
        assert!(error.contains("not connected") && error.contains("Google Drive"), "{error}");
        assert!(drive_connected(&std::env::temp_dir().join("not-made-yet")));
    }

    #[test]
    fn overlap_is_case_insensitive_and_segment_aware() {
        assert!(overlaps(
            Path::new(r"C:\Games"),
            Path::new(r"c:\games\Steam")
        ));
        assert!(overlaps(
            Path::new(r"C:\Games\Steam"),
            Path::new(r"C:\Games")
        ));
        assert!(!overlaps(
            Path::new(r"C:\Games"),
            Path::new(r"C:\Games-old")
        ));
    }

    #[test]
    fn schedule_time_requires_twenty_four_hour_hh_mm() {
        assert!(valid_schedule_time("00:00"));
        assert!(valid_schedule_time("23:59"));
        assert!(!valid_schedule_time("3:00"));
        assert!(!valid_schedule_time("24:00"));
        assert!(!valid_schedule_time("12:60"));
    }

    #[test]
    fn legacy_settings_are_migrated_to_the_current_version() {
        let root = std::env::temp_dir().join(format!(
            "myle-game-saves-settings-migration-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join("settings.json");
        fs::write(&path, r#"{"version":0,"schedule":"off"}"#).unwrap();

        let value = load_from_path(&path).unwrap();
        assert_eq!(value.version, GAME_SAVES_SETTINGS_VERSION);
        assert_eq!(value.schedule_time, "03:00");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn settings_from_a_newer_app_are_not_silently_downgraded() {
        let root = std::env::temp_dir().join(format!(
            "myle-game-saves-settings-future-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join("settings.json");
        fs::write(&path, r#"{"version":999}"#).unwrap();

        let error = load_from_path(&path).unwrap_err();
        assert!(error.contains("newer than this app supports"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn a_disconnected_game_drive_does_not_block_the_backup_folder() {
        use super::super::models::{GameRoot, RootStore};
        let Some(missing) = ('P'..='Z')
            .map(|letter| format!(r"{letter}:\"))
            .find(|drive| !Path::new(drive).exists())
        else {
            return;
        };
        let settings = GameSavesSettings {
            roots: vec![GameRoot {
                id: "steam-x".into(),
                path: format!(r"{missing}SteamLibrary"),
                store: RootStore::Steam,
                source: RootSource::Manual,
            }],
            ..Default::default()
        };
        let base = std::env::temp_dir().join(format!("myle-gs-missing-drive-{}", std::process::id()));
        let result = validate_backup_folder_for_root(
            &base.join("Backups"),
            &base.join("config"),
            &settings,
        );
        assert_eq!(result, Ok(()));
    }

    #[test]
    fn drive_root_libraries_from_older_builds_are_repaired() {
        use super::super::models::{GameRoot, RootStore};
        let mut settings = GameSavesSettings {
            roots: vec![GameRoot {
                id: "epic-x".into(),
                path: "D:".into(),
                store: RootStore::Epic,
                source: RootSource::Automatic,
            }],
            ..Default::default()
        };
        normalize(&mut settings);
        assert_eq!(settings.roots[0].path, r"D:\");
    }

    #[test]
    fn validation_resolves_the_existing_parent_of_a_new_folder() {
        let path = std::env::temp_dir()
            .join("myle-game-saves-not-created")
            .join("nested");
        let resolved = resolved_normalized(&path).unwrap();
        assert!(resolved.ends_with(Path::new("myle-game-saves-not-created/nested")));
    }
}
