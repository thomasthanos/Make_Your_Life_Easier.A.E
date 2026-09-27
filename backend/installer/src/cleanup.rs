//! What can only be deleted once something else has let go of it: the
//! uninstaller in the install folder and the folder itself (see `relocate`),
//! data the app's closing web view still held, and the temporary WebView2
//! profile of the setup's own window. Deleted here, in this process, trying
//! again for a while as those processes wind down.

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use crate::shell;

/// How long a busy file is tried again before it is left behind.
const PATIENCE: Duration = Duration::from_secs(15);
const RETRY: Duration = Duration::from_millis(250);

#[derive(Debug, Default)]
pub struct AfterExit {
    /// Deleted outright (files, or folders with everything in them).
    pub remove: Vec<PathBuf>,
    /// Deleted only if empty by then, in this order.
    pub remove_if_empty: Vec<PathBuf>,
}

impl AfterExit {
    pub fn append(&mut self, other: AfterExit) {
        self.remove.extend(other.remove);
        self.remove_if_empty.extend(other.remove_if_empty);
    }

    /// Deletes everything listed, trying again while a file is still busy.
    /// This program's own file is skipped: it cannot go while it runs.
    pub fn finish(self) {
        let own = std::env::current_exe().ok();
        let mut remove: Vec<PathBuf> = self
            .remove
            .into_iter()
            .filter(|path| {
                !own.as_deref()
                    .is_some_and(|own| shell::same_file(own, path))
            })
            .collect();
        let deadline = Instant::now() + PATIENCE;
        loop {
            remove.retain(|path| !delete(path));
            for dir in &self.remove_if_empty {
                // Fails, as it should, while anything is left inside.
                let _ = std::fs::remove_dir(dir);
            }
            if remove.is_empty() || Instant::now() >= deadline {
                break;
            }
            std::thread::sleep(RETRY);
        }
    }
}

/// Whether `path` is gone.
fn delete(path: &Path) -> bool {
    match std::fs::symlink_metadata(path) {
        Err(error) => error.kind() == std::io::ErrorKind::NotFound,
        Ok(meta) if meta.is_dir() => std::fs::remove_dir_all(path).is_ok(),
        Ok(_) => std::fs::remove_file(path).is_ok(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn listed_files_go_and_a_folder_goes_only_once_empty() {
        let root = std::env::temp_dir().join(format!("myle-cleanup-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let app = root.join("app");
        let kept = root.join("kept");
        let profile = root.join("profile");
        for dir in [&app, &kept, &profile.join("Default")] {
            std::fs::create_dir_all(dir).unwrap();
        }
        std::fs::write(app.join("uninstall.exe"), b"").unwrap();
        std::fs::write(kept.join("uninstall.exe"), b"").unwrap();
        std::fs::write(kept.join("mine.txt"), b"").unwrap();
        std::fs::write(profile.join("Default").join("Cookies"), b"").unwrap();

        AfterExit {
            remove: vec![
                app.join("uninstall.exe"),
                kept.join("uninstall.exe"),
                profile.clone(),
                root.join("already-gone"),
            ],
            remove_if_empty: vec![app.clone(), kept.clone()],
        }
        .finish();

        assert!(!app.exists(), "emptied, so removed");
        assert!(!profile.exists());
        assert!(kept.join("mine.txt").exists(), "never touched");
        assert!(!kept.join("uninstall.exe").exists());
        let _ = std::fs::remove_dir_all(&root);
    }
}
