use std::io::Read;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use crate::download::err;

use super::models::SparkleCacheState;

const METADATA_FILE: &str = "install.json";

#[derive(Clone, Debug)]
pub struct CachedSparkle {
    pub state: SparkleCacheState,
    pub executable: Option<PathBuf>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Metadata {
    version: String,
    release_sha256: String,
    executable: String,
    executable_sha256: String,
}

pub fn root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join("windows-optimization").join("sparkle"))
        .map_err(err)
}

pub fn detect(app: &AppHandle) -> Result<CachedSparkle, String> {
    detect_root(&root(app)?)
}

fn detect_root(root: &Path) -> Result<CachedSparkle, String> {
    let invalid = || CachedSparkle {
        state: SparkleCacheState::default(),
        executable: None,
    };
    let text = match std::fs::read_to_string(root.join(METADATA_FILE)) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(invalid()),
        Err(_) => return Ok(invalid()),
    };
    let metadata: Metadata = match serde_json::from_str(&text) {
        Ok(metadata) => metadata,
        Err(_) => return Ok(invalid()),
    };
    let relative = Path::new(&metadata.executable);
    if relative.is_absolute()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_) | Component::CurDir))
        || metadata.executable_sha256.len() != 64
        || !metadata
            .executable_sha256
            .chars()
            .all(|value| value.is_ascii_hexdigit())
    {
        return Ok(invalid());
    }
    let executable = root.join(relative);
    if !executable.is_file() || has_reparse_point(root, &executable)? {
        return Ok(invalid());
    }
    if sha256_file(&executable)? != metadata.executable_sha256.to_ascii_lowercase() {
        return Ok(invalid());
    }
    Ok(CachedSparkle {
        state: SparkleCacheState {
            cached: true,
            version: Some(metadata.version),
        },
        executable: Some(executable),
    })
}

pub fn write_metadata(
    staged_root: &Path,
    executable: &Path,
    version: &str,
    release_sha256: &str,
) -> Result<PathBuf, String> {
    let relative = executable
        .strip_prefix(staged_root)
        .map_err(|_| "Sparkle.exe escaped the staged payload.".to_string())?;
    let metadata = Metadata {
        version: version.to_string(),
        release_sha256: release_sha256.to_string(),
        executable: relative.to_string_lossy().into_owned(),
        executable_sha256: sha256_file(executable)?,
    };
    let path = staged_root.join(METADATA_FILE);
    let temporary = staged_root.join(format!("{METADATA_FILE}.tmp"));
    std::fs::write(
        &temporary,
        serde_json::to_vec_pretty(&metadata).map_err(err)?,
    )
    .map_err(err)?;
    std::fs::rename(&temporary, &path).map_err(err)?;
    Ok(relative.to_path_buf())
}

pub fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = std::fs::File::open(path).map_err(err)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 128 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(err)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(crate::download::to_hex(&hasher.finalize()))
}

pub struct DirectorySwap {
    target: PathBuf,
    backup: Option<PathBuf>,
    committed: bool,
}

impl DirectorySwap {
    pub fn apply(staged: &Path, target: &Path, suffix: &str) -> Result<Self, String> {
        if !staged.is_dir() {
            return Err("The staged Sparkle directory is missing.".into());
        }
        let parent = target.parent().ok_or("Sparkle cache has no parent.")?;
        std::fs::create_dir_all(parent).map_err(err)?;
        let backup = parent.join(format!(".sparkle-backup-{suffix}"));
        if backup.exists() {
            std::fs::remove_dir_all(&backup).map_err(err)?;
        }
        let had_target = target.exists();
        if had_target {
            ensure_tree_has_no_reparse_points(target)?;
            std::fs::rename(target, &backup).map_err(err)?;
        }
        if let Err(error) = std::fs::rename(staged, target) {
            if had_target {
                let _ = std::fs::rename(&backup, target);
            }
            return Err(error.to_string());
        }
        Ok(Self {
            target: target.to_path_buf(),
            backup: had_target.then_some(backup),
            committed: false,
        })
    }

    pub fn commit(mut self) -> Option<PathBuf> {
        self.committed = true;
        self.backup
            .take()
            .filter(|path| path.exists())
            .and_then(|path| std::fs::remove_dir_all(&path).err().map(|_| path))
    }

    fn rollback(&mut self) {
        if self.committed {
            return;
        }
        if self.target.exists() {
            let _ = std::fs::remove_dir_all(&self.target);
        }
        if let Some(backup) = &self.backup {
            let _ = std::fs::rename(backup, &self.target);
        }
        self.committed = true;
    }
}

impl Drop for DirectorySwap {
    fn drop(&mut self) {
        self.rollback();
    }
}

fn has_reparse_point(root: &Path, target: &Path) -> Result<bool, String> {
    if is_reparse(&std::fs::symlink_metadata(root).map_err(err)?) {
        return Ok(true);
    }
    let relative = target
        .strip_prefix(root)
        .map_err(|_| "Cached Sparkle path escaped its root.".to_string())?;
    let mut current = root.to_path_buf();
    for component in relative.components() {
        current.push(component.as_os_str());
        if is_reparse(&std::fs::symlink_metadata(&current).map_err(err)?) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn ensure_tree_has_no_reparse_points(path: &Path) -> Result<(), String> {
    let metadata = std::fs::symlink_metadata(path).map_err(err)?;
    if is_reparse(&metadata) {
        return Err(format!(
            "Refusing a Sparkle cache containing a reparse point: {}",
            path.display()
        ));
    }
    if metadata.is_dir() {
        for entry in std::fs::read_dir(path).map_err(err)? {
            ensure_tree_has_no_reparse_points(&entry.map_err(err)?.path())?;
        }
    }
    Ok(())
}

#[cfg(windows)]
fn is_reparse(metadata: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & 0x400 != 0
}

#[cfg(not(windows))]
fn is_reparse(metadata: &std::fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("myle-sparkle-cache-{name}-{}", std::process::id()))
    }

    #[test]
    fn valid_cache_is_detected_and_tampering_invalidates_it() {
        let root = temp_dir("detect");
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("app")).unwrap();
        let executable = root.join("app").join("Sparkle.exe");
        std::fs::write(&executable, b"portable payload").unwrap();
        write_metadata(&root, &executable, "2.18.0", &"a".repeat(64)).unwrap();
        let cached = detect_root(&root).unwrap();
        assert!(cached.state.cached);
        assert_eq!(cached.state.version.as_deref(), Some("2.18.0"));

        std::fs::write(&executable, b"changed").unwrap();
        assert!(!detect_root(&root).unwrap().state.cached);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn directory_swap_rolls_back_until_committed() {
        let root = temp_dir("swap");
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("old")).unwrap();
        std::fs::write(root.join("old").join("version"), b"old").unwrap();
        std::fs::create_dir_all(root.join("new")).unwrap();
        std::fs::write(root.join("new").join("version"), b"new").unwrap();
        {
            let _swap = DirectorySwap::apply(&root.join("new"), &root.join("old"), "test").unwrap();
            assert_eq!(
                std::fs::read(root.join("old").join("version")).unwrap(),
                b"new"
            );
        }
        assert_eq!(
            std::fs::read(root.join("old").join("version")).unwrap(),
            b"old"
        );
        let _ = std::fs::remove_dir_all(root);
    }
}
