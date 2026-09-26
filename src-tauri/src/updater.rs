//! Discord-style updater backed by the GitHub Releases API.
//!
//! 1. `check_for_update` asks GitHub for the latest release and compares its
//!    tag with the running version.
//! 2. `install_update` downloads the `*_x64-setup.exe` asset while streaming
//!    progress to the splash, verifies its SHA-256 against the digest GitHub
//!    publishes for every asset, runs it silently and exits the app. The
//!    installer relaunches the new version (`/R`).

use std::time::Duration;

use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, State};

use crate::apps::Jobs;
use crate::download::{self, err, parse_sha256_digest};

/// GitHub repository ("owner/name") whose Releases are checked.
/// It also holds the releases of the old Electron app (v4.x); this rewrite
/// starts at 5.0.0, so those always compare as older.
pub const GITHUB_REPO: &str = "thomasthanos/Make_Your_Life_Easier.A.E";

/// Set while an update is downloading, so the startup watchdog does not show
/// the main window on top of the splash mid-update.
static UPDATING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

pub fn is_updating() -> bool {
    UPDATING.load(std::sync::atomic::Ordering::Relaxed)
}

/// Release asset to install. `release.yml` publishes it with this suffix.
const ASSET_SUFFIX: &str = "_x64-setup.exe";
const DOWNLOAD_PREFIX: &str = "https://github.com/";
const CHECK_TIMEOUT: Duration = Duration::from_secs(8);
const USER_AGENT: &str = "MakeYourLifeEasier-Updater";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UpdateAsset {
    pub name: String,
    pub url: String,
    pub size: u64,
    /// `"sha256:<hex>"`, as reported by GitHub.
    pub digest: Option<String>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum UpdateCheck {
    UpToDate {
        current: String,
        latest: String,
    },
    Available {
        current: String,
        latest: String,
        notes: String,
        asset: UpdateAsset,
    },
    NotConfigured {
        current: String,
    },
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum DownloadEvent {
    Started { total: Option<u64> },
    Progress { downloaded: u64, total: Option<u64> },
    Verifying,
    Installing,
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: String,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    assets: Vec<GhAsset>,
}

#[derive(Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
    size: u64,
    #[serde(default)]
    digest: Option<String>,
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<UpdateCheck, String> {
    let current = app.package_info().version.clone();

    #[cfg(debug_assertions)]
    if let Some(mode) = demo::mode() {
        return demo::check(&current, &mode);
    }

    if GITHUB_REPO.starts_with("OWNER/") {
        return Ok(UpdateCheck::NotConfigured {
            current: current.to_string(),
        });
    }

    let response = download::http_client(USER_AGENT)?
        .get(format!(
            "https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
        ))
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .timeout(CHECK_TIMEOUT)
        .send()
        .await
        .map_err(err)?;

    // No published release yet.
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(UpdateCheck::UpToDate {
            current: current.to_string(),
            latest: current.to_string(),
        });
    }

    let release: GhRelease = response
        .error_for_status()
        .map_err(err)?
        .json()
        .await
        .map_err(err)?;
    evaluate(&current, release)
}

#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    jobs: State<'_, Jobs>,
    asset: UpdateAsset,
    on_event: Channel<DownloadEvent>,
) -> Result<(), String> {
    // Share the app-wide exclusive lane with installers and destructive
    // system actions so an updater and firmware restart cannot cross while
    // either one is waiting on the operating system.
    let _exclusive = jobs.start_exclusive("application-update")?;

    #[cfg(debug_assertions)]
    if demo::mode().is_some() {
        return demo::install(&on_event).await;
    }

    let expected = asset
        .digest
        .as_deref()
        .and_then(parse_sha256_digest)
        .ok_or("the release asset has no SHA-256 digest, refusing to install")?;
    if !asset.url.starts_with(DOWNLOAD_PREFIX) {
        return Err(format!("unexpected download location: {}", asset.url));
    }
    UPDATING.store(true, std::sync::atomic::Ordering::Relaxed);
    let _reset = ResetUpdating;

    let file_name = download::file_name_from(&asset.name, "MakeYourLifeEasier-setup.exe");
    let path = std::env::temp_dir()
        .join("MakeYourLifeEasier")
        .join("update")
        .join(file_name);

    let mut started = false;
    let actual = download::download_to(
        &download::http_client(USER_AGENT)?,
        &asset.url,
        &path,
        Some(asset.size),
        |downloaded, total| {
            let event = if started {
                DownloadEvent::Progress { downloaded, total }
            } else {
                started = true;
                DownloadEvent::Started { total }
            };
            let _ = on_event.send(event);
        },
        || false,
    )
    .await?;

    let _ = on_event.send(DownloadEvent::Verifying);
    if actual != expected {
        let _ = tokio::fs::remove_file(&path).await;
        return Err("the downloaded update failed SHA-256 verification".into());
    }

    let _ = on_event.send(DownloadEvent::Installing);
    // Per-user install: no UAC prompt. `/UPDATE` keeps shortcuts as the user
    // left them and `/R` relaunches the app when the installer finishes.
    std::process::Command::new(&path)
        .args(["/S", "/UPDATE", "/R"])
        .spawn()
        .map_err(err)?;

    // Let the splash paint "Installing update…" before the app goes away.
    tokio::time::sleep(Duration::from_millis(600)).await;
    app.exit(0);
    Ok(())
}

/// Clears the flag however `install_update` ends.
struct ResetUpdating;

impl Drop for ResetUpdating {
    fn drop(&mut self) {
        UPDATING.store(false, std::sync::atomic::Ordering::Relaxed);
    }
}

fn evaluate(current: &Version, release: GhRelease) -> Result<UpdateCheck, String> {
    let latest = parse_tag(&release.tag_name)?;
    if latest <= *current {
        return Ok(UpdateCheck::UpToDate {
            current: current.to_string(),
            latest: latest.to_string(),
        });
    }
    let asset = release
        .assets
        .into_iter()
        .find(|a| a.name.to_ascii_lowercase().ends_with(ASSET_SUFFIX))
        .ok_or_else(|| format!("release {} has no *{ASSET_SUFFIX} asset", release.tag_name))?;
    Ok(UpdateCheck::Available {
        current: current.to_string(),
        latest: latest.to_string(),
        notes: release.body.unwrap_or_default(),
        asset: UpdateAsset {
            name: asset.name,
            url: asset.browser_download_url,
            size: asset.size,
            digest: asset.digest,
        },
    })
}

fn parse_tag(tag: &str) -> Result<Version, String> {
    let raw = tag.trim().trim_start_matches(['v', 'V']);
    Version::parse(raw).map_err(|e| format!("release tag {tag:?} is not a version: {e}"))
}

/// Debug builds only: `MYLE_UPDATER_DEMO=1` fakes an available update and a
/// download so the splash can be tested without a real release;
/// `MYLE_UPDATER_DEMO=offline` fakes a failed check.
#[cfg(debug_assertions)]
mod demo {
    use super::*;

    pub fn mode() -> Option<String> {
        std::env::var("MYLE_UPDATER_DEMO")
            .ok()
            .filter(|v| !v.is_empty())
    }

    pub fn check(current: &Version, mode: &str) -> Result<UpdateCheck, String> {
        if mode == "offline" {
            return Err("error sending request for url (https://api.github.com/…) (demo)".into());
        }
        Ok(UpdateCheck::Available {
            current: current.to_string(),
            latest: "9.9.9".into(),
            notes: String::new(),
            asset: UpdateAsset {
                name: "MakeYourLifeEasier_9.9.9_x64-setup.exe".into(),
                url: String::new(),
                size: 7_400_000,
                digest: None,
            },
        })
    }

    pub async fn install(on_event: &Channel<DownloadEvent>) -> Result<(), String> {
        const TOTAL: u64 = 7_400_000;
        let _ = on_event.send(DownloadEvent::Started { total: Some(TOTAL) });
        for step in 1..=40u64 {
            tokio::time::sleep(Duration::from_millis(60)).await;
            let _ = on_event.send(DownloadEvent::Progress {
                downloaded: TOTAL * step / 40,
                total: Some(TOTAL),
            });
        }
        let _ = on_event.send(DownloadEvent::Verifying);
        tokio::time::sleep(Duration::from_millis(500)).await;
        let _ = on_event.send(DownloadEvent::Installing);
        tokio::time::sleep(Duration::from_millis(900)).await;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag: &str, assets: serde_json::Value) -> GhRelease {
        serde_json::from_value(
            serde_json::json!({ "tag_name": tag, "body": "notes", "assets": assets }),
        )
        .unwrap()
    }

    fn setup_asset() -> serde_json::Value {
        serde_json::json!([
            { "name": "latest.json", "browser_download_url": "https://github.com/o/r/latest.json", "size": 1, "digest": null },
            {
                "name": "MakeYourLifeEasier_1.2.0_x64-setup.exe",
                "browser_download_url": "https://github.com/o/r/releases/download/v1.2.0/MakeYourLifeEasier_1.2.0_x64-setup.exe",
                "size": 4200000,
                "digest": "sha256:ABCDEF0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
            }
        ])
    }

    #[test]
    fn newer_tag_is_available_with_the_setup_asset() {
        let current = Version::new(1, 1, 0);
        let UpdateCheck::Available {
            latest,
            asset,
            notes,
            ..
        } = evaluate(&current, release("v1.2.0", setup_asset())).unwrap()
        else {
            panic!("expected an update");
        };
        assert_eq!(latest, "1.2.0");
        assert_eq!(notes, "notes");
        assert_eq!(asset.name, "MakeYourLifeEasier_1.2.0_x64-setup.exe");
        assert_eq!(asset.size, 4_200_000);
    }

    #[test]
    fn same_or_older_tag_is_up_to_date() {
        let current = Version::new(1, 2, 0);
        assert!(matches!(
            evaluate(&current, release("v1.2.0", setup_asset())),
            Ok(UpdateCheck::UpToDate { .. })
        ));
        assert!(matches!(
            evaluate(&current, release("1.1.9", setup_asset())),
            Ok(UpdateCheck::UpToDate { .. })
        ));
    }

    #[test]
    fn prerelease_sorts_below_release() {
        let current = Version::parse("1.2.0-beta.1").unwrap();
        assert!(matches!(
            evaluate(&current, release("v1.2.0", setup_asset())),
            Ok(UpdateCheck::Available { .. })
        ));
    }

    #[test]
    fn missing_setup_asset_is_an_error() {
        let current = Version::new(1, 0, 0);
        assert!(evaluate(&current, release("v2.0.0", serde_json::json!([]))).is_err());
    }

    #[test]
    fn bad_tag_is_an_error() {
        assert!(parse_tag("nightly").is_err());
        assert_eq!(parse_tag(" V3.4.5 ").unwrap(), Version::new(3, 4, 5));
    }

    #[test]
    fn check_result_serializes_for_the_frontend() {
        let json = serde_json::to_value(UpdateCheck::NotConfigured {
            current: "0.1.0".into(),
        })
        .unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "status": "notConfigured", "current": "0.1.0" })
        );
        let json = serde_json::to_value(DownloadEvent::Progress {
            downloaded: 5,
            total: Some(10),
        })
        .unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "event": "progress", "data": { "downloaded": 5, "total": 10 } })
        );
        let json = serde_json::to_value(DownloadEvent::Verifying).unwrap();
        assert_eq!(json, serde_json::json!({ "event": "verifying" }));
    }
}
