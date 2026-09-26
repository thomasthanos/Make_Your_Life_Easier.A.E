//! What the System Cleaner is allowed to touch.
//!
//! Every path is fixed here in the code: the page sends a category id and
//! nothing else, and each file is checked against these roots before it is
//! deleted. Only the *contents* of a folder are removed, never the folder.

use std::path::{Path, PathBuf};

use crate::apps::custom::expand_env;

/// One folder to clean, with an optional file-name filter.
#[derive(Debug, Clone, Copy)]
pub struct Target {
    /// May contain `%VAR%`.
    pub dir: &'static str,
    /// Empty means everything in the folder; otherwise `name_*.ext` patterns.
    pub patterns: &'static [&'static str],
    /// Known to be readable only with administrator rights.
    pub admin: bool,
}

#[derive(Debug, Clone, Copy)]
pub enum Kind {
    Folders(&'static [Target]),
    RecycleBin,
}

#[derive(Debug, Clone, Copy)]
pub struct Category {
    pub id: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    /// Shown next to the size on the card.
    pub hint: &'static str,
    /// Icon name the page maps to a Lucide icon.
    pub icon: &'static str,
    pub kind: Kind,
}

const fn folder(dir: &'static str) -> Target {
    Target {
        dir,
        patterns: &[],
        admin: false,
    }
}

const fn admin_folder(dir: &'static str) -> Target {
    Target {
        dir,
        patterns: &[],
        admin: true,
    }
}

pub const CATEGORIES: &[Category] = &[
    Category {
        id: "temp",
        title: "Temporary Files",
        description: "Remove system and user temporary files.",
        hint: "Windows + user temp folders",
        icon: "temp",
        kind: Kind::Folders(&[folder(r"%TEMP%"), admin_folder(r"C:\Windows\Temp")]),
    },
    Category {
        id: "prefetch",
        title: "Prefetch Files",
        description: "Clear the app start-up cache. Windows rebuilds it.",
        hint: r"C:\Windows\Prefetch",
        icon: "prefetch",
        kind: Kind::Folders(&[admin_folder(r"C:\Windows\Prefetch")]),
    },
    Category {
        id: "recycle-bin",
        title: "Empty Recycle Bin",
        description: "Delete everything in the Recycle Bin for good.",
        hint: "All drives",
        icon: "recycle-bin",
        kind: Kind::RecycleBin,
    },
    Category {
        id: "windows-update",
        title: "Windows Update Cache",
        description: "Remove downloaded update files that are already installed.",
        hint: r"SoftwareDistribution\Download",
        icon: "update",
        kind: Kind::Folders(&[admin_folder(r"C:\Windows\SoftwareDistribution\Download")]),
    },
    Category {
        id: "thumbnails",
        title: "Thumbnail Cache",
        description: "Clear File Explorer's thumbnail and icon cache.",
        hint: "Explorer thumbcache",
        icon: "thumbnails",
        kind: Kind::Folders(&[Target {
            dir: r"%LOCALAPPDATA%\Microsoft\Windows\Explorer",
            patterns: &["thumbcache_*.db", "iconcache_*.db"],
            admin: false,
        }]),
    },
    Category {
        id: "errors",
        title: "Error Reports & Crash Dumps",
        description: "Delete crash dumps and Windows error reports.",
        hint: "CrashDumps, WER, Minidump",
        icon: "errors",
        kind: Kind::Folders(&[
            folder(r"%LOCALAPPDATA%\CrashDumps"),
            folder(r"%LOCALAPPDATA%\Microsoft\Windows\WER\ReportArchive"),
            folder(r"%LOCALAPPDATA%\Microsoft\Windows\WER\ReportQueue"),
            admin_folder(r"C:\Windows\Minidump"),
            admin_folder(r"%PROGRAMDATA%\Microsoft\Windows\WER\ReportArchive"),
            admin_folder(r"%PROGRAMDATA%\Microsoft\Windows\WER\ReportQueue"),
        ]),
    },
];

pub fn find(id: &str) -> Option<&'static Category> {
    CATEGORIES.iter().find(|c| c.id == id)
}

impl Category {
    pub fn targets(&self) -> &'static [Target] {
        match self.kind {
            Kind::Folders(targets) => targets,
            Kind::RecycleBin => &[],
        }
    }
}

impl Target {
    pub fn path(&self) -> PathBuf {
        PathBuf::from(expand_env(self.dir))
    }
}

/// The folders listed above, resolved once. Every delete is checked against
/// them, so a bug elsewhere still cannot reach the rest of the disk.
pub struct Allowed(Vec<PathBuf>);

impl Allowed {
    pub fn new() -> Self {
        Self(
            CATEGORIES
                .iter()
                .flat_map(Category::targets)
                .map(|t| normalize(&t.path()))
                .collect(),
        )
    }

    /// True when `path` sits inside one of the folders.
    pub fn contains(&self, path: &Path) -> bool {
        // "..\.." would otherwise walk back out of an allowed root.
        if path
            .components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
        {
            return false;
        }
        let candidate = normalize(path);
        // A root itself is not a target: only what is inside it.
        self.0
            .iter()
            .any(|root| candidate.starts_with(root) && &candidate != root)
    }
}

/// Lower-cased, `..` resolved as far as possible, trailing separators dropped.
fn normalize(path: &Path) -> PathBuf {
    let cleaned = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let text = cleaned.to_string_lossy().to_ascii_lowercase();
    PathBuf::from(
        text.trim_end_matches(['\\', '/'])
            .trim_start_matches(r"\\?\"),
    )
}

/// `thumbcache_*.db` style matching (one `*`, case-insensitive).
pub fn matches(name: &str, patterns: &[&str]) -> bool {
    if patterns.is_empty() {
        return true;
    }
    let name = name.to_ascii_lowercase();
    patterns.iter().any(|pattern| {
        let pattern = pattern.to_ascii_lowercase();
        match pattern.split_once('*') {
            Some((prefix, suffix)) => {
                name.len() >= prefix.len() + suffix.len()
                    && name.starts_with(prefix)
                    && name.ends_with(&suffix)
            }
            None => name == pattern,
        }
    })
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct Measured {
    pub bytes: u64,
    pub files: u64,
    /// Something could not be read: administrator rights are needed.
    pub locked: bool,
}

/// Adds up what a target holds, without touching anything.
pub fn measure(target: &Target) -> Measured {
    let mut out = Measured::default();
    let dir = target.path();
    if !dir.exists() {
        return out;
    }
    walk(
        &dir,
        target.patterns,
        &mut |_path, size| {
            out.bytes += size;
            out.files += 1;
        },
        &mut out.locked,
    );
    out
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct Cleaned {
    pub bytes: u64,
    pub files: u64,
    /// In use by another program, or not ours to delete.
    pub skipped: u64,
    pub locked: bool,
}

/// Deletes the contents of a target. The folder itself stays.
pub fn clean(target: &Target) -> Cleaned {
    let mut out = Cleaned::default();
    let dir = target.path();
    if !dir.exists() {
        return out;
    }
    let allowed = Allowed::new();
    let mut files = Vec::new();
    walk(
        &dir,
        target.patterns,
        &mut |path, size| files.push((path, size)),
        &mut out.locked,
    );

    for (path, size) in files {
        if !allowed.contains(&path) {
            out.skipped += 1;
            continue;
        }
        match std::fs::remove_file(&path) {
            Ok(()) => {
                out.bytes += size;
                out.files += 1;
            }
            Err(_) => out.skipped += 1,
        }
    }

    // Then the directories that are now empty, deepest first. Only when the
    // whole folder was in scope: a filtered target leaves the structure alone.
    if target.patterns.is_empty() {
        let mut dirs = Vec::new();
        collect_dirs(&dir, &mut dirs, &mut out.locked);
        dirs.sort_by_key(|d| std::cmp::Reverse(d.components().count()));
        for path in dirs {
            if allowed.contains(&path) {
                let _ = std::fs::remove_dir(path);
            }
        }
    }
    out
}

/// Visits every matching file under `dir`. Symlinks and junctions are reported
/// as files (so they are unlinked, never followed).
fn walk(dir: &Path, patterns: &[&str], visit: &mut impl FnMut(PathBuf, u64), locked: &mut bool) {
    let mut stack = vec![dir.to_path_buf()];
    while let Some(current) = stack.pop() {
        let entries = match std::fs::read_dir(&current) {
            Ok(entries) => entries,
            Err(e) => {
                *locked |= e.kind() == std::io::ErrorKind::PermissionDenied;
                continue;
            }
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(meta) = entry.path().symlink_metadata() else {
                *locked = true;
                continue;
            };
            if meta.is_dir() && !meta.is_symlink() {
                // Filtered targets only look at the top level.
                if patterns.is_empty() {
                    stack.push(path);
                }
                continue;
            }
            let name = entry.file_name();
            if matches(&name.to_string_lossy(), patterns) {
                visit(path, meta.len());
            }
        }
    }
}

fn collect_dirs(dir: &Path, out: &mut Vec<PathBuf>, locked: &mut bool) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        *locked = true;
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if entry
            .file_type()
            .is_ok_and(|t| t.is_dir() && !t.is_symlink())
        {
            collect_dirs(&path, out, locked);
            out.push(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_category_has_usable_targets() {
        assert_eq!(CATEGORIES.len(), 6);
        for category in CATEGORIES {
            assert!(
                !category.title.is_empty()
                    && !category.description.is_empty()
                    && !category.hint.is_empty()
            );
            for target in category.targets() {
                let path = target.path();
                let text = path.to_string_lossy();
                assert!(
                    !text.contains('%'),
                    "{} still has an unexpanded variable: {text}",
                    category.id
                );
                assert!(path.is_absolute(), "{text} is not absolute");
            }
        }
        assert!(matches!(
            find("recycle-bin").unwrap().kind,
            Kind::RecycleBin
        ));
        assert!(find("nope").is_none());
    }

    #[test]
    fn only_files_inside_the_listed_folders_may_be_deleted() {
        let allowed = Allowed::new();
        let is_allowed = |path: &Path| allowed.contains(path);
        let temp = PathBuf::from(expand_env("%TEMP%"));
        assert!(is_allowed(&temp.join("some-file.tmp")));
        assert!(is_allowed(&temp.join("deep").join("nested.log")));

        // The roots themselves, and everything else, are off limits.
        assert!(!is_allowed(&temp));
        assert!(!is_allowed(Path::new(r"C:\Windows\System32\kernel32.dll")));
        assert!(!is_allowed(&PathBuf::from(expand_env(
            r"%USERPROFILE%\Documents\notes.txt"
        ))));
        assert!(!is_allowed(&PathBuf::from(expand_env(
            r"%USERPROFILE%\Downloads"
        ))));
        assert!(!is_allowed(&temp.join("..").join("..").join("Documents")));
    }

    #[test]
    fn patterns_match_like_a_file_filter() {
        assert!(matches("anything.txt", &[]));
        assert!(matches("thumbcache_256.db", &["thumbcache_*.db"]));
        assert!(matches("ICONCACHE_16.DB", &["iconcache_*.db"]));
        assert!(!matches("thumbcache_256.dbx", &["thumbcache_*.db"]));
        assert!(!matches(
            "notes.txt",
            &["thumbcache_*.db", "iconcache_*.db"]
        ));
        assert!(matches("exact.log", &["exact.log"]));
    }

    #[test]
    fn cleaning_empties_a_folder_but_keeps_it_and_skips_open_files() {
        // A folder inside %TEMP%, so it is inside an allowed root.
        let root = PathBuf::from(expand_env("%TEMP%"))
            .join(format!("myle-clean-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("sub").join("deeper")).unwrap();
        std::fs::write(root.join("a.log"), vec![b'x'; 1000]).unwrap();
        std::fs::write(root.join("sub").join("b.log"), vec![b'y'; 500]).unwrap();
        std::fs::write(root.join("sub").join("deeper").join("c.log"), b"zz").unwrap();

        use std::os::windows::fs::OpenOptionsExt;
        let open = std::fs::File::options()
            .read(true)
            .share_mode(0) // deny everything: the file cannot be deleted
            .open(root.join("a.log"))
            .unwrap();

        let target = Target {
            dir: Box::leak(root.to_string_lossy().into_owned().into_boxed_str()),
            patterns: &[],
            admin: false,
        };
        let measured = measure(&target);
        assert_eq!((measured.bytes, measured.files), (1502, 3));

        let cleaned = clean(&target);
        assert_eq!(cleaned.files, 2, "the open file is skipped");
        assert_eq!(cleaned.bytes, 502);
        assert_eq!(cleaned.skipped, 1);
        assert!(root.exists(), "the folder itself stays");
        assert!(!root.join("sub").exists(), "empty subfolders go");
        assert!(root.join("a.log").exists());

        drop(open);
        let _ = std::fs::remove_dir_all(&root);
    }
}
