//! Stable, user-facing application-data locations.
//!
//! Tauri normally derives these folders from the reverse-domain application
//! identifier. That identifier is correct metadata but a poor visible folder
//! name, so the app owns branded roots and migrates the legacy roots once.

use std::path::{Path, PathBuf};

use crate::download::err;

pub const FOLDER_NAME: &str = "Make Your Life Easier";
pub const LEGACY_IDENTIFIER: &str = "com.thomasthanos.makeyourlifeeasier";

pub fn roaming_dir() -> Result<PathBuf, String> {
    base("APPDATA").map(|base| base.join(FOLDER_NAME))
}

pub fn local_dir() -> Result<PathBuf, String> {
    base("LOCALAPPDATA").map(|base| base.join(FOLDER_NAME))
}

pub fn webview_dir() -> Result<PathBuf, String> {
    // Keep the same profile-root shape as Tauri's legacy identifier folder so
    // cookies and local storage survive the one-time directory migration.
    local_dir()
}

fn base(variable: &str) -> Result<PathBuf, String> {
    std::env::var_os(variable)
        .map(PathBuf::from)
        .ok_or_else(|| {
            format!("The Windows {variable} application-data folder could not be located.")
        })
}

/// Moves settings, caches and browser storage from the identifier-named
/// folders. Existing files in the branded destination always win.
pub fn prepare() -> Result<(), String> {
    for variable in ["APPDATA", "LOCALAPPDATA"] {
        let base = base(variable)?;
        migrate_dir(&base.join(LEGACY_IDENTIFIER), &base.join(FOLDER_NAME))?;
    }
    std::fs::create_dir_all(roaming_dir()?).map_err(err)?;
    std::fs::create_dir_all(local_dir()?).map_err(err)?;
    Ok(())
}

fn migrate_dir(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }
    if !destination.exists() {
        if std::fs::rename(source, destination).is_ok() {
            return Ok(());
        }
        std::fs::create_dir_all(destination).map_err(err)?;
    }

    for entry in std::fs::read_dir(source).map_err(err)? {
        let entry = entry.map_err(err)?;
        let kind = entry.file_type().map_err(err)?;
        let from = entry.path();
        let to = destination.join(entry.file_name());
        if kind.is_symlink() {
            // App-data migration never needs to follow user-created links.
            continue;
        }
        if kind.is_dir() {
            migrate_dir(&from, &to)?;
        } else if !to.exists() {
            std::fs::rename(&from, &to).map_err(err)?;
        }
    }
    let _ = std::fs::remove_dir(source); // remains when conflicts/links remain
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_keeps_newer_destination_files_and_moves_the_rest() {
        let root = std::env::temp_dir().join(format!(
            "myle-storage-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4().simple()
        ));
        let old = root.join("old");
        let new = root.join("new");
        std::fs::create_dir_all(old.join("nested")).unwrap();
        std::fs::create_dir_all(&new).unwrap();
        std::fs::write(old.join("nested").join("moved.txt"), b"moved").unwrap();
        std::fs::write(old.join("same.txt"), b"old").unwrap();
        std::fs::write(new.join("same.txt"), b"new").unwrap();

        migrate_dir(&old, &new).unwrap();

        assert_eq!(
            std::fs::read(new.join("nested").join("moved.txt")).unwrap(),
            b"moved"
        );
        assert_eq!(std::fs::read(new.join("same.txt")).unwrap(), b"new");
        assert_eq!(std::fs::read(old.join("same.txt")).unwrap(), b"old");
        let _ = std::fs::remove_dir_all(root);
    }
}
