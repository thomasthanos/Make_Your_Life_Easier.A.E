//! Apps that are not in winget. They download straight from the vendor, and a
//! resolver finds the newest download URL (cached for 6 hours).
//!
//! The catalog is compiled into the binary (`catalog/custom-apps.json`) and the
//! page only ever sends an app id, so the webview cannot make the app download
//! or run anything that is not listed there.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::LazyLock;

use regex_lite::Regex;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::State;
use tauri::ipc::Channel;

use super::jobs::{JobHandle, Jobs};
use super::process::{ERROR_CANCELLED, ERROR_ELEVATION_REQUIRED, hidden, run_elevated};
use super::resolver::{self, Resolver};
use super::{JobEvent, JobOutcome, Stage};
use crate::download::{self, CANCELLED, err, parse_sha256_digest};

const CATALOG_JSON: &str = include_str!("../../catalog/custom-apps.json");
const USER_AGENT: &str = "MakeYourLifeEasier-Apps";
/// Written next to portable/zip installs to remember the installed version.
const VERSION_MARKER: &str = ".myle-version";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CustomApp {
    id: String,
    name: String,
    site: Option<String>,
    icon: Option<String>,
    category: Option<String>,
    /// Updates itself, so version differences never count as an update.
    #[serde(default)]
    self_updating: bool,
    /// Apps that cannot be active at the same time as this one.
    #[serde(default)]
    conflicts: Vec<String>,
    resolver: Resolver,
    install: InstallKind,
    #[serde(default)]
    detect: Detect,
    activate: Option<Activate>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum InstallKind {
    /// Runs the downloaded installer (`.exe` or `.msi`) with `args`.
    Installer {
        #[serde(default)]
        args: Vec<String>,
    },
    /// Copies the downloaded exe to `%LOCALAPPDATA%\Programs\<dir>\<exe>`.
    Portable { dir: String, exe: String },
    /// Extracts to `%LOCALAPPDATA%\Programs\<dir>`, then optionally runs `run`.
    Zip { dir: String, run: Option<String> },
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Detect {
    /// Regex on DisplayName under the Uninstall registry keys.
    display_name: Option<String>,
    /// File whose existence means "installed" (`%VAR%` expanded).
    path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Activate {
    label: String,
    action: ActivateAction,
    /// Files that exist once activation is in effect (`%VAR%` expanded, `*`
    /// picks the newest match, e.g. Discord's latest `app-*` folder).
    #[serde(default)]
    done: Vec<String>,
    /// Run the activation right after a successful install.
    #[serde(default)]
    after_install: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum ActivateAction {
    /// Start Menu shortcut to the installed exe.
    Shortcut,
    Run {
        exe: String,
        #[serde(default)]
        args: Vec<String>,
    },
}

static CATALOG: LazyLock<Vec<CustomApp>> = LazyLock::new(|| {
    serde_json::from_str(CATALOG_JSON).expect("catalog/custom-apps.json is invalid")
});

fn find(id: &str) -> Result<&'static CustomApp, String> {
    CATALOG
        .iter()
        .find(|a| a.id == id)
        .ok_or_else(|| format!("unknown custom app: {id}"))
}

// ---------------------------------------------------------------------------
// Catalog and status for the page

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomAppInfo {
    id: String,
    name: String,
    site: Option<String>,
    icon: Option<String>,
    category: Option<String>,
    self_updating: bool,
    conflicts: Vec<String>,
    activate_label: Option<String>,
    activate_after_install: bool,
}

#[tauri::command]
pub fn apps_custom_catalog() -> Vec<CustomAppInfo> {
    CATALOG
        .iter()
        .map(|a| CustomAppInfo {
            id: a.id.clone(),
            name: a.name.clone(),
            site: a.site.clone(),
            icon: a.icon.clone(),
            category: a.category.clone(),
            self_updating: a.self_updating,
            conflicts: a.conflicts.clone(),
            activate_label: a.activate.as_ref().map(|x| x.label.clone()),
            activate_after_install: a.activate.as_ref().is_some_and(|x| x.after_install),
        })
        .collect()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomStatus {
    id: String,
    installed: bool,
    version: Option<String>,
    available: Option<String>,
    activated: bool,
}

pub async fn statuses(app: &AppHandle) -> Vec<CustomStatus> {
    let mut out = Vec::new();
    for entry in CATALOG.iter() {
        let (installed, version) = detect(entry);
        // Only look for updates when we know what is installed.
        let available = match (&version, installed) {
            (Some(current), true) if !entry.self_updating => {
                resolver::resolve(app, &entry.id, &entry.resolver)
                    .await
                    .ok()
                    .and_then(|r| r.version)
                    .filter(|latest| is_newer(latest, current))
            }
            _ => None,
        };
        out.push(CustomStatus {
            id: entry.id.clone(),
            installed,
            version,
            available,
            activated: installed && is_activated(entry),
        });
    }
    out
}

fn detect(entry: &CustomApp) -> (bool, Option<String>) {
    let pattern = entry
        .detect
        .display_name
        .as_deref()
        .and_then(|p| Regex::new(p).ok());
    if let Some(found) = pattern.and_then(|p| find_uninstall_entry(&p)) {
        return (true, found);
    }
    if let Some(path) = &entry.detect.path {
        let path = PathBuf::from(expand_env(path));
        if path.exists() {
            let marker = path.parent().map(|d| d.join(VERSION_MARKER));
            let version = marker
                .and_then(|m| std::fs::read_to_string(m).ok())
                .map(|v| v.trim().to_string());
            return (true, version);
        }
    }
    // Activated by other means (e.g. a Discord mod installed by hand).
    (activation_in_effect(entry), None)
}

fn activation_in_effect(entry: &CustomApp) -> bool {
    entry
        .activate
        .as_ref()
        .is_some_and(|a| !a.done.is_empty() && a.done.iter().all(|p| resolve_path(p).is_some()))
}

/// Expands `%VAR%`s and resolves `*` segments to their newest existing match
/// ("app-1.0.9259" beats "app-1.0.9258"). None if the path does not exist.
fn resolve_path(pattern: &str) -> Option<PathBuf> {
    let expanded = expand_env(pattern);
    let mut current = PathBuf::new();
    for (i, segment) in expanded.split(['\\', '/']).enumerate() {
        if i == 0 {
            current.push(format!("{segment}\\"));
            continue;
        }
        if segment.contains('*') {
            let (prefix, suffix) = segment.split_once('*').unwrap_or((segment, ""));
            let newest = std::fs::read_dir(&current)
                .ok()?
                .flatten()
                .filter_map(|e| e.file_name().into_string().ok())
                .filter(|n| {
                    n.len() >= prefix.len() + suffix.len()
                        && n.starts_with(prefix)
                        && n.ends_with(suffix)
                })
                .reduce(|best, n| if is_newer(&n, &best) { n } else { best })?;
            current.push(newest);
        } else if !segment.is_empty() {
            current.push(segment);
        }
    }
    current.exists().then_some(current)
}

/// Searches the Uninstall keys (machine 64/32-bit and user) for a matching
/// DisplayName; returns its DisplayVersion.
fn find_uninstall_entry(pattern: &Regex) -> Option<Option<String>> {
    use winreg::RegKey;
    use winreg::enums::{
        HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY,
    };
    const UNINSTALL: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";

    let views = [
        (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_64KEY),
        (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_32KEY),
        (HKEY_CURRENT_USER, KEY_READ),
    ];
    for (hive, flags) in views {
        let Ok(root) = RegKey::predef(hive).open_subkey_with_flags(UNINSTALL, flags) else {
            continue;
        };
        for name in root.enum_keys().flatten() {
            let Ok(key) = root.open_subkey_with_flags(&name, flags) else {
                continue;
            };
            let Ok(display_name) = key.get_value::<String, _>("DisplayName") else {
                continue;
            };
            if pattern.is_match(&display_name) {
                return Some(key.get_value::<String, _>("DisplayVersion").ok());
            }
        }
    }
    None
}

fn is_activated(entry: &CustomApp) -> bool {
    match entry.activate.as_ref().map(|a| &a.action) {
        Some(ActivateAction::Shortcut) => shortcut_path(entry).exists(),
        Some(ActivateAction::Run { .. }) => activation_in_effect(entry),
        None => false,
    }
}

/// Dotted numeric comparison ("11.0.10" > "11.0.9"); non-numeric parts count as 0.
fn is_newer(latest: &str, current: &str) -> bool {
    let parts = |v: &str| -> Vec<u64> {
        v.split(['.', '-', '+'])
            .map(|p| {
                p.chars()
                    .take_while(char::is_ascii_digit)
                    .collect::<String>()
                    .parse()
                    .unwrap_or(0)
            })
            .collect()
    };
    let (a, b) = (parts(latest), parts(current));
    for i in 0..a.len().max(b.len()) {
        let (x, y) = (
            a.get(i).copied().unwrap_or(0),
            b.get(i).copied().unwrap_or(0),
        );
        if x != y {
            return x > y;
        }
    }
    false
}

// ---------------------------------------------------------------------------
// Installing

#[tauri::command]
pub async fn apps_install_custom(
    app: AppHandle,
    jobs: State<'_, Jobs>,
    id: String,
    on_event: Channel<JobEvent>,
) -> Result<JobOutcome, String> {
    let entry = find(&id)?;
    let job = jobs.start(&id)?;
    match install(&app, &job, entry, &on_event).await {
        Err(e) if e == CANCELLED || job.is_cancelled() => Ok(JobOutcome::Cancelled),
        other => other,
    }
}

async fn install(
    app: &AppHandle,
    job: &JobHandle,
    entry: &CustomApp,
    on_event: &Channel<JobEvent>,
) -> Result<JobOutcome, String> {
    let _ = on_event.send(JobEvent::Stage {
        stage: Stage::Resolving,
    });
    let resolved = resolver::resolve(app, &entry.id, &entry.resolver).await?;

    let _ = on_event.send(JobEvent::Stage {
        stage: Stage::Downloading,
    });
    let file = std::env::temp_dir()
        .join("MakeYourLifeEasier")
        .join("apps")
        .join(&resolved.file_name);
    let mut last = -1.0f64;
    let hash = download::download_to(
        &download::http_client(USER_AGENT)?,
        &resolved.url,
        &file,
        resolved.size,
        |done, total| {
            if let Some(total) = total.filter(|t| *t > 0) {
                let fraction = done as f64 / total as f64;
                if fraction - last >= 0.01 || fraction >= 1.0 {
                    last = fraction;
                    let _ = on_event.send(JobEvent::Progress {
                        fraction,
                        downloaded: Some(done),
                        total: Some(total),
                    });
                }
            }
        },
        || job.is_cancelled(),
    )
    .await?;

    if let Some(expected) = resolved.digest.as_deref().and_then(parse_sha256_digest) {
        let _ = on_event.send(JobEvent::Stage {
            stage: Stage::Verifying,
        });
        if hash != expected {
            let _ = tokio::fs::remove_file(&file).await;
            return Err("The download failed its SHA-256 check.".into());
        }
    }

    let _ = on_event.send(JobEvent::Stage {
        stage: Stage::Installing,
    });
    let note = match &entry.install {
        InstallKind::Installer { args } => run_installer(job, &file, args).await?,
        InstallKind::Portable { dir, exe } => {
            let target = programs_dir(dir);
            tokio::fs::create_dir_all(&target).await.map_err(err)?;
            tokio::fs::copy(&file, target.join(exe))
                .await
                .map_err(err)?;
            write_version_marker(&target, resolved.version.as_deref());
            None
        }
        InstallKind::Zip { dir, run } => {
            let target = programs_dir(dir);
            let (zip, dest) = (file.clone(), target.clone());
            tauri::async_runtime::spawn_blocking(move || extract_zip(&zip, &dest, None, |_, _| {}))
                .await
                .map_err(err)??;
            write_version_marker(&target, resolved.version.as_deref());
            if let Some(exe) = run {
                run_installer(job, &target.join(exe), &[]).await?
            } else {
                None
            }
        }
    };
    let _ = tokio::fs::remove_file(&file).await;

    if let Some(activate) = entry.activate.as_ref().filter(|a| a.after_install) {
        let _ = on_event.send(JobEvent::Note {
            text: format!("{}…", activate.label),
        });
        run_activation(entry, activate)
            .await
            .map_err(|e| format!("Downloaded, but \"{}\" failed: {e}", activate.label))?;
    }
    Ok(JobOutcome::Done { note })
}

/// Runs an installer and waits. Falls back to a UAC prompt when the installer
/// demands elevation. Exit codes 3010/1641 mean "done, restart needed".
pub(super) async fn run_installer(
    job: &JobHandle,
    file: &Path,
    args: &[String],
) -> Result<Option<String>, String> {
    let is_msi = file
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("msi"));
    let (program, args): (String, Vec<String>) = if is_msi {
        let mut all = vec![
            "/i".to_string(),
            file.display().to_string(),
            "/qn".into(),
            "/norestart".into(),
        ];
        all.extend(args.iter().cloned());
        ("msiexec.exe".into(), all)
    } else {
        (file.display().to_string(), args.to_vec())
    };

    let code = match hidden(&program).args(&args).stdin(Stdio::null()).spawn() {
        Ok(mut child) => {
            job.set_pid(child.id());
            let status = child.wait().await.map_err(err)?;
            job.set_pid(None);
            status.code().unwrap_or(-1)
        }
        Err(e) if e.raw_os_error() == Some(ERROR_ELEVATION_REQUIRED) => {
            let code = run_elevated(&program, &args, false).await?;
            if code == ERROR_CANCELLED {
                return Err("Administrator approval was declined.".into());
            }
            code
        }
        Err(e) => return Err(e.to_string()),
    };
    if job.is_cancelled() {
        return Err(CANCELLED.into());
    }
    match code {
        0 => Ok(None),
        3010 | 1641 => Ok(Some("Restart your PC to finish.".into())),
        other => Err(format!("The installer exited with code {other}.")),
    }
}

fn programs_dir(dir: &str) -> PathBuf {
    PathBuf::from(expand_env("%LOCALAPPDATA%\\Programs")).join(dir)
}

fn write_version_marker(dir: &Path, version: Option<&str>) {
    if let Some(version) = version {
        let _ = std::fs::write(dir.join(VERSION_MARKER), version);
    }
}

/// Extracts a single entry by its path inside the archive, and returns where it
/// landed. Much faster than unpacking a big archive for one installer.
/// `on_progress(done, total)` is called while the file is copied.
pub(super) fn extract_zip_entry(
    zip_path: &Path,
    entry_name: &str,
    dest: &Path,
    password: Option<&str>,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<PathBuf, String> {
    let file = std::fs::File::open(zip_path).map_err(err)?;
    let mut archive = zip::ZipArchive::new(file).map_err(err)?;
    let wanted = entry_name.replace('\\', "/");
    let index = (0..archive.len())
        .find(|i| {
            archive
                .name_for_index(*i)
                .is_some_and(|n| n.replace('\\', "/").eq_ignore_ascii_case(&wanted))
        })
        .ok_or_else(|| not_in_package(&mut archive, entry_name))?;

    let mut entry = match password {
        Some(pw) => archive
            .by_index_decrypt(index, pw.as_bytes())
            .map_err(err)?,
        None => archive.by_index(index).map_err(err)?,
    };
    let total = entry.size();
    let relative = entry
        .enclosed_name()
        .ok_or("the package contains an unsafe path")?;
    let out = dest.join(relative);
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent).map_err(err)?;
    }
    let mut target = std::fs::File::create(&out).map_err(err)?;
    copy_with_progress(&mut entry, &mut target, total, &mut on_progress)?;
    Ok(out)
}

/// A "no such file" message that also shows what the package does contain, so a
/// typo in the configured name is easy to spot.
fn not_in_package<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    wanted: &str,
) -> String {
    let mut runnable: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.name_for_index(i).map(str::to_string))
        .filter(|n| {
            n.to_ascii_lowercase().ends_with(".exe") || n.to_ascii_lowercase().ends_with(".msi")
        })
        .collect();
    runnable.sort_by_key(|n| n.matches('/').count());
    if runnable.is_empty() {
        return format!(
            "\"{wanted}\" is not in the package, and the package has no .exe or .msi at all."
        );
    }
    let shown: Vec<String> = runnable.iter().take(8).cloned().collect();
    let more = runnable.len().saturating_sub(shown.len());
    let tail = if more > 0 {
        format!(" (and {more} more)")
    } else {
        String::new()
    };
    format!(
        "\"{wanted}\" is not in the package. It contains: {}{tail}",
        shown.join(", ")
    )
}

fn copy_with_progress(
    reader: &mut impl std::io::Read,
    writer: &mut impl std::io::Write,
    total: u64,
    on_progress: &mut impl FnMut(u64, u64),
) -> Result<(), String> {
    let mut buffer = vec![0u8; 256 * 1024];
    let mut done = 0u64;
    loop {
        let read = reader.read(&mut buffer).map_err(err)?;
        if read == 0 {
            break;
        }
        writer.write_all(&buffer[..read]).map_err(err)?;
        done += read as u64;
        on_progress(done, total.max(done));
    }
    Ok(())
}

/// Extracts every entry, refusing paths that would escape `dest` (zip-slip).
/// `password` is needed for encrypted archives, and `on_progress(done, total)`
/// counts uncompressed bytes.
pub(super) fn extract_zip(
    zip_path: &Path,
    dest: &Path,
    password: Option<&str>,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(err)?;
    let mut archive = zip::ZipArchive::new(file).map_err(err)?;
    let total: u64 = (0..archive.len())
        .filter_map(|i| archive.by_index_raw(i).ok().map(|e| e.size()))
        .sum();
    let mut done = 0u64;
    for i in 0..archive.len() {
        let mut entry = match password {
            Some(pw) => archive.by_index_decrypt(i, pw.as_bytes()).map_err(err)?,
            None => archive.by_index(i).map_err(err)?,
        };
        let Some(relative) = entry.enclosed_name() else {
            continue;
        };
        let out = dest.join(relative);
        if entry.is_dir() {
            std::fs::create_dir_all(&out).map_err(err)?;
            continue;
        }
        if let Some(parent) = out.parent() {
            std::fs::create_dir_all(parent).map_err(err)?;
        }
        let mut target = std::fs::File::create(&out).map_err(err)?;
        let (before, size) = (done, entry.size());
        copy_with_progress(&mut entry, &mut target, size, &mut |written, _| {
            done = before + written;
            on_progress(done, total.max(done));
        })?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Activate

#[tauri::command]
pub async fn apps_activate(id: String) -> Result<(), String> {
    let entry = find(&id)?;
    let activate = entry
        .activate
        .as_ref()
        .ok_or("this app has no activation step")?;
    run_activation(entry, activate).await
}

async fn run_activation(entry: &CustomApp, activate: &Activate) -> Result<(), String> {
    match &activate.action {
        ActivateAction::Shortcut => {
            let target = installed_exe(entry).ok_or("the app is not installed")?;
            let link = shortcut_path(entry);
            if let Some(dir) = link.parent() {
                std::fs::create_dir_all(dir).map_err(err)?;
            }
            mslnk::ShellLink::new(&target)
                .map_err(err)?
                .create_lnk(&link)
                .map_err(err)
        }
        ActivateAction::Run { exe, args } => {
            let output = hidden(expand_env(exe))
                .args(args)
                .stdin(Stdio::null())
                .output()
                .await
                .map_err(err)?;
            if output.status.success() {
                return Ok(());
            }
            // The tool's last message is usually the most useful error.
            let text = String::from_utf8_lossy(&output.stdout).into_owned()
                + &String::from_utf8_lossy(&output.stderr);
            let last = text.lines().map(str::trim).rfind(|l| !l.is_empty());
            Err(last
                .map(String::from)
                .unwrap_or_else(|| format!("exited with code {:?}", output.status.code())))
        }
    }
}

fn installed_exe(entry: &CustomApp) -> Option<PathBuf> {
    let path = match &entry.install {
        InstallKind::Portable { dir, exe } => programs_dir(dir).join(exe),
        InstallKind::Zip {
            dir,
            run: Some(exe),
        } => programs_dir(dir).join(exe),
        _ => PathBuf::from(expand_env(entry.detect.path.as_deref()?)),
    };
    path.exists().then_some(path)
}

fn shortcut_path(entry: &CustomApp) -> PathBuf {
    PathBuf::from(expand_env(
        "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs",
    ))
    .join(format!(
        "{}.lnk",
        download::file_name_from(&entry.name, "App")
    ))
}

/// Expands `%VAR%` references using the current environment.
pub(crate) fn expand_env(input: &str) -> String {
    static VAR: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"%([A-Za-z0-9_]+)%").unwrap());
    VAR.replace_all(input, |c: &regex_lite::Captures| {
        std::env::var(&c[1]).unwrap_or_else(|_| c[0].to_string())
    })
    .into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_catalog_parses_and_patterns_compile() {
        assert!(!CATALOG.is_empty());
        for app in CATALOG.iter() {
            assert!(
                app.id.starts_with("Custom."),
                "{} must be namespaced",
                app.id
            );
            if let Some(p) = &app.detect.display_name {
                Regex::new(p).unwrap();
            }
            match &app.resolver {
                Resolver::Github { asset, .. } => drop(Regex::new(asset).unwrap()),
                Resolver::Page { pattern, .. } => drop(Regex::new(pattern).unwrap()),
                _ => {}
            }
        }
    }

    #[test]
    fn version_comparison() {
        assert!(is_newer("11.0.9.251", "11.0.8.299"));
        assert!(is_newer("11.0.10", "11.0.9"));
        assert!(!is_newer("16.7", "16.7"));
        assert!(!is_newer("16.6", "16.7"));
        assert!(is_newer("2.0", "1.9.9.9"));
        assert!(!is_newer("1.0", "1.0.0"));
    }

    #[test]
    fn wildcard_paths_resolve_to_the_newest_match() {
        let root = std::env::temp_dir().join(format!("myle-glob-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        for dir in ["app-1.0.9258", "app-1.0.9259", "app-1.0.10000-old"] {
            std::fs::create_dir_all(root.join(dir).join("resources")).unwrap();
        }
        std::fs::write(
            root.join("app-1.0.9259")
                .join("resources")
                .join("_app.asar"),
            b"x",
        )
        .unwrap();
        let pattern = format!("{}\\app-*\\resources", root.display());
        assert_eq!(
            resolve_path(&pattern),
            Some(root.join("app-1.0.10000-old").join("resources"))
        );
        // Only the newest folder counts: the marker there is missing.
        assert_eq!(
            resolve_path(&format!("{}\\app-*\\resources\\_app.asar", root.display())),
            None
        );
        std::fs::remove_dir_all(root.join("app-1.0.10000-old")).unwrap();
        assert!(
            resolve_path(&format!("{}\\app-*\\resources\\_app.asar", root.display())).is_some()
        );
        assert_eq!(resolve_path(&format!("{}\\nope-*", root.display())), None);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn conflicting_apps_reference_each_other() {
        for app in CATALOG.iter() {
            for other in &app.conflicts {
                let other = CATALOG
                    .iter()
                    .find(|a| &a.id == other)
                    .expect("conflict must be a known custom app");
                assert!(
                    other.conflicts.contains(&app.id),
                    "{} and {} must list each other",
                    app.id,
                    other.id
                );
            }
        }
    }

    #[test]
    fn env_expansion() {
        let windir = std::env::var("WINDIR").unwrap();
        assert_eq!(expand_env("%WINDIR%\\x"), format!("{windir}\\x"));
        assert_eq!(expand_env("%NOPE_NOT_SET%"), "%NOPE_NOT_SET%");
    }

    #[test]
    fn single_entries_come_out_of_encrypted_archives() {
        use std::io::Write;
        use zip::AesMode;
        use zip::write::SimpleFileOptions;

        let dir = std::env::temp_dir().join(format!("myle-aes-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let zip_path = dir.join("locked.zip");
        {
            let mut w = zip::ZipWriter::new(std::fs::File::create(&zip_path).unwrap());
            let opts = SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored)
                .with_aes_encryption(AesMode::Aes256, "123");
            w.start_file("release/App 2.0.0.exe", opts).unwrap();
            w.write_all(b"MZ-installer").unwrap();
            w.start_file("node_modules/big.js", opts).unwrap();
            w.write_all(&vec![b'x'; 4096]).unwrap();
            w.finish().unwrap();
        }
        let dest = dir.join("out");

        // Only the requested entry is unpacked, and a Windows-style path works.
        let mut seen = (0u64, 0u64);
        let picked = extract_zip_entry(
            &zip_path,
            "release\\App 2.0.0.exe",
            &dest,
            Some("123"),
            |done, total| seen = (done, total),
        )
        .unwrap();
        assert_eq!(picked, dest.join("release").join("App 2.0.0.exe"));
        assert_eq!(std::fs::read(&picked).unwrap(), b"MZ-installer");
        assert_eq!(seen, (12, 12)); // progress ran to the end
        assert!(!dest.join("node_modules").exists());

        // A wrong name says what the package actually holds.
        let message =
            extract_zip_entry(&zip_path, "setup.exe", &dest, Some("123"), |_, _| {}).unwrap_err();
        assert!(message.contains("release/App 2.0.0.exe"), "{message}");

        assert!(
            extract_zip_entry(
                &zip_path,
                "release/App 2.0.0.exe",
                &dest,
                Some("wrong"),
                |_, _| {}
            )
            .is_err()
        );
        assert!(extract_zip_entry(&zip_path, "nope.exe", &dest, Some("123"), |_, _| {}).is_err());
        // The whole archive still unpacks with the password.
        let all = dir.join("all");
        extract_zip(&zip_path, &all, Some("123"), |_, _| {}).unwrap();
        assert!(all.join("node_modules").join("big.js").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn zip_extraction_refuses_path_traversal() {
        use std::io::Write;
        use zip::write::SimpleFileOptions;

        let dir = std::env::temp_dir().join(format!("myle-zip-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let zip_path = dir.join("test.zip");
        {
            let mut w = zip::ZipWriter::new(std::fs::File::create(&zip_path).unwrap());
            let opts =
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
            w.start_file("app/tool.exe", opts).unwrap();
            w.write_all(b"MZ").unwrap();
            w.start_file("../escape.txt", opts).unwrap();
            w.write_all(b"nope").unwrap();
            w.finish().unwrap();
        }
        let dest = dir.join("out");
        extract_zip(&zip_path, &dest, None, |_, _| {}).unwrap();
        assert_eq!(
            std::fs::read(dest.join("app").join("tool.exe")).unwrap(),
            b"MZ"
        );
        assert!(!dir.join("escape.txt").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
