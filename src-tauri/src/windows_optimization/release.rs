use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use semver::Version;
use serde::Deserialize;

use crate::download::{self, parse_sha256_digest};

use super::state::Cancellation;

const USER_AGENT: &str = "MakeYourLifeEasier/WindowsOptimization";
const RELEASES_URL: &str = "https://api.github.com/repos/thedogecraft/sparkle/releases?per_page=30";
const OFFICIAL_DOWNLOAD_PREFIX: &str = "https://github.com/thedogecraft/sparkle/releases/download/";
const MAX_ARCHIVE_ENTRIES: usize = 30_000;
const MAX_UNPACKED_BYTES: u64 = 1536 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
    size: Option<u64>,
    digest: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
struct Release {
    tag_name: String,
    draft: bool,
    prerelease: bool,
    body: Option<String>,
    assets: Vec<Asset>,
}

#[derive(Clone, Debug)]
pub struct VerifiedRelease {
    pub version: String,
    pub asset_name: String,
    pub url: String,
    pub size: Option<u64>,
    pub digest: String,
}

pub async fn resolve_sparkle() -> Result<VerifiedRelease, String> {
    let response = download::http_client(USER_AGENT)?
        .get(RELEASES_URL)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(download::err)?
        .error_for_status()
        .map_err(download::err)?;
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if !content_type
        .to_ascii_lowercase()
        .starts_with("application/json")
    {
        return Err("GitHub returned a non-JSON Sparkle release response.".into());
    }
    let releases: Vec<Release> = response.json().await.map_err(download::err)?;
    select_release(&releases)
}

fn select_release(releases: &[Release]) -> Result<VerifiedRelease, String> {
    let release = releases
        .iter()
        .filter(|release| !release.draft && !release.prerelease)
        .filter_map(|release| {
            let version = Version::parse(release.tag_name.trim_start_matches('v')).ok()?;
            version.pre.is_empty().then_some((version, release))
        })
        .max_by(|(left, _), (right, _)| left.cmp(right))
        .map(|(_, release)| release)
        .ok_or("No stable Sparkle release was found.")?;

    let version = release.tag_name.trim_start_matches('v');
    let expected_name = format!("sparkle-{version}-win.zip");
    let asset = release
        .assets
        .iter()
        .find(|asset| asset.name.eq_ignore_ascii_case(&expected_name))
        .ok_or_else(|| format!("The stable Sparkle release has no {expected_name} asset."))?;
    if !asset
        .browser_download_url
        .starts_with(OFFICIAL_DOWNLOAD_PREFIX)
    {
        return Err("The Sparkle asset points outside its official GitHub repository.".into());
    }

    // Sparkle stopped listing checksums in its notes with 2.24.0, while GitHub
    // computes one for every uploaded asset. Either source is enough; when
    // both exist they must agree.
    let noted = release
        .body
        .as_deref()
        .and_then(|body| checksum_from_release_notes(body, &asset.name));
    let github = match asset.digest.as_deref() {
        Some(raw) => Some(
            parse_sha256_digest(raw)
                .ok_or("GitHub returned a malformed SHA-256 digest for the Sparkle asset.")?,
        ),
        None => None,
    };
    let published = match (noted, github) {
        (Some(noted), Some(github)) if noted != github => {
            return Err("Sparkle's release-note checksum and GitHub digest disagree.".into());
        }
        (Some(digest), _) | (None, Some(digest)) => digest,
        (None, None) => {
            return Err("Neither Sparkle's release notes nor GitHub publish a SHA-256 for the portable ZIP.".into());
        }
    };

    Ok(VerifiedRelease {
        version: version.to_string(),
        asset_name: asset.name.clone(),
        url: asset.browser_download_url.clone(),
        size: asset.size,
        digest: published,
    })
}

fn checksum_from_release_notes(body: &str, asset_name: &str) -> Option<String> {
    body.lines().find_map(|line| {
        let at = line
            .to_ascii_lowercase()
            .find(&asset_name.to_ascii_lowercase())?;
        let after = &line[at + asset_name.len()..];
        let (_, value) = after.split_once(':')?;
        value
            .split(|character: char| !character.is_ascii_hexdigit())
            .find(|candidate| candidate.len() == 64)
            .map(str::to_ascii_lowercase)
    })
}

pub async fn download_verified(
    release: &VerifiedRelease,
    destination: &Path,
    cancellation: &Cancellation,
    on_progress: impl FnMut(u64, Option<u64>),
) -> Result<(), String> {
    let actual = download::download_to(
        &download::http_client(USER_AGENT)?,
        &release.url,
        destination,
        release.size,
        on_progress,
        || cancellation.is_cancelled(),
    )
    .await?;
    if actual != release.digest {
        let _ = tokio::fs::remove_file(destination).await;
        return Err("The Sparkle download failed SHA-256 verification.".into());
    }
    Ok(())
}

pub fn extract_verified_zip(
    archive_path: &Path,
    destination: &Path,
    cancellation: &Cancellation,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<PathBuf, String> {
    let mut signature = [0u8; 4];
    std::fs::File::open(archive_path)
        .and_then(|mut file| file.read_exact(&mut signature))
        .map_err(download::err)?;
    if !matches!(&signature, b"PK\x03\x04" | b"PK\x05\x06" | b"PK\x07\x08") {
        return Err("The verified Sparkle asset is not a ZIP archive.".into());
    }

    let file = std::fs::File::open(archive_path).map_err(download::err)?;
    let mut archive = zip::ZipArchive::new(file).map_err(download::err)?;
    if archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err("The Sparkle archive contains too many entries.".into());
    }
    let mut total = 0u64;
    for index in 0..archive.len() {
        let entry = archive.by_index_raw(index).map_err(download::err)?;
        if entry.enclosed_name().is_none() {
            return Err("The Sparkle archive contains an unsafe path.".into());
        }
        if is_symlink(&entry) {
            return Err("The Sparkle archive contains a symbolic link.".into());
        }
        total = total
            .checked_add(entry.size())
            .ok_or("The Sparkle archive size is invalid.")?;
        if total > MAX_UNPACKED_BYTES {
            return Err("The Sparkle archive is unexpectedly large.".into());
        }
    }

    std::fs::create_dir_all(destination).map_err(download::err)?;
    let mut done = 0u64;
    let mut buffer = vec![0u8; 128 * 1024];
    for index in 0..archive.len() {
        if cancellation.is_cancelled() {
            return Err(download::CANCELLED.into());
        }
        let mut entry = archive.by_index(index).map_err(download::err)?;
        let relative = entry
            .enclosed_name()
            .ok_or("The Sparkle archive contains an unsafe path.")?
            .to_path_buf();
        let output = destination.join(relative);
        if entry.is_dir() {
            std::fs::create_dir_all(&output).map_err(download::err)?;
            continue;
        }
        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent).map_err(download::err)?;
        }
        let mut target = std::fs::File::create(&output).map_err(download::err)?;
        loop {
            let read = entry.read(&mut buffer).map_err(download::err)?;
            if read == 0 {
                break;
            }
            target.write_all(&buffer[..read]).map_err(download::err)?;
            done += read as u64;
            on_progress(done, total.max(done));
            if cancellation.is_cancelled() {
                return Err(download::CANCELLED.into());
            }
        }
    }
    find_sparkle_executable(destination)
}

fn find_sparkle_executable(root: &Path) -> Result<PathBuf, String> {
    fn visit(path: &Path, matches: &mut Vec<PathBuf>) -> Result<(), String> {
        for entry in std::fs::read_dir(path).map_err(download::err)? {
            let entry = entry.map_err(download::err)?;
            let file_type = entry.file_type().map_err(download::err)?;
            if file_type.is_symlink() {
                return Err("The extracted Sparkle payload contains a link.".into());
            }
            let path = entry.path();
            if file_type.is_dir() {
                visit(&path, matches)?;
            } else if entry
                .file_name()
                .to_string_lossy()
                .eq_ignore_ascii_case("Sparkle.exe")
            {
                matches.push(path);
            }
        }
        Ok(())
    }

    let mut matches = Vec::new();
    visit(root, &mut matches)?;
    match matches.as_slice() {
        [only] => Ok(only.clone()),
        [] => Err("The verified Sparkle archive does not contain Sparkle.exe.".into()),
        _ => Err("The verified Sparkle archive contains an ambiguous executable layout.".into()),
    }
}

fn is_symlink<R: Read>(entry: &zip::read::ZipFile<'_, R>) -> bool {
    entry
        .unix_mode()
        .is_some_and(|mode| mode & 0o170000 == 0o120000)
}

#[cfg(test)]
mod tests {
    use super::*;
    use zip::write::SimpleFileOptions;

    fn digest() -> &'static str {
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }

    fn release(tag: &str, prerelease: bool, body_digest: Option<&str>) -> Release {
        let version = tag.trim_start_matches('v');
        let name = format!("sparkle-{version}-win.zip");
        Release {
            tag_name: tag.into(),
            draft: false,
            prerelease,
            body: body_digest.map(|value| format!("### Checksums\n{name}: {value}")),
            assets: vec![Asset {
                name: name.clone(),
                browser_download_url: format!(
                    "https://github.com/thedogecraft/sparkle/releases/download/{tag}/{name}"
                ),
                size: Some(10),
                digest: body_digest.map(|value| format!("sha256:{value}")),
            }],
        }
    }

    fn temp_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("myle-sparkle-{name}-{}", std::process::id()))
    }

    #[test]
    fn newest_stable_release_and_exact_asset_are_selected() {
        let releases = vec![
            release("2.18.1-beta.1", true, Some(digest())),
            release("2.17.0", false, Some(digest())),
            release("v2.18.0", false, Some(digest())),
        ];
        let selected = select_release(&releases).unwrap();
        assert_eq!(selected.version, "2.18.0");
        assert_eq!(selected.asset_name, "sparkle-2.18.0-win.zip");
    }

    #[test]
    fn checksum_is_required_and_must_agree_with_github() {
        let missing = release("2.18.0", false, None);
        assert!(select_release(&[missing]).is_err());
        let mut mismatch = release("2.18.0", false, Some(digest()));
        mismatch.assets[0].digest = Some(format!("sha256:{}", "b".repeat(64)));
        assert!(select_release(&[mismatch]).is_err());
    }

    #[test]
    fn github_digest_alone_is_enough_when_notes_have_no_checksum() {
        // Sparkle 2.24.0: plain release notes, digest only on the asset.
        let mut item = release("2.24.0", false, Some(digest()));
        item.body = Some("### What's new\n- Fixes".into());
        let selected = select_release(&[item]).unwrap();
        assert_eq!(selected.digest, digest());

        let mut notes_only = release("2.23.0", false, Some(digest()));
        notes_only.assets[0].digest = None;
        assert_eq!(select_release(&[notes_only]).unwrap().digest, digest());
    }

    #[test]
    fn unofficial_asset_host_is_rejected() {
        let mut item = release("2.18.0", false, Some(digest()));
        item.assets[0].browser_download_url = "https://example.com/sparkle.zip".into();
        assert!(select_release(&[item]).is_err());
    }

    #[test]
    fn traversal_and_malformed_archives_are_rejected() {
        let root = temp_dir("unsafe");
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        let malformed = root.join("bad.zip");
        std::fs::write(&malformed, b"not a zip").unwrap();
        let cancellation = super::super::state::WindowsOptimizationState::default()
            .begin(
                "test".into(),
                super::super::models::WindowsOptimizationAction::LaunchSparkle,
            )
            .unwrap();
        assert!(
            extract_verified_zip(&malformed, &root.join("bad"), &cancellation, |_, _| {}).is_err()
        );

        let unsafe_zip = root.join("unsafe.zip");
        let mut writer = zip::ZipWriter::new(std::fs::File::create(&unsafe_zip).unwrap());
        writer
            .start_file(
                "../Sparkle.exe",
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored),
            )
            .unwrap();
        writer.write_all(b"payload").unwrap();
        writer.finish().unwrap();
        assert!(
            extract_verified_zip(&unsafe_zip, &root.join("unsafe"), &cancellation, |_, _| {})
                .is_err()
        );
        assert!(!root.join("Sparkle.exe").exists());
        let _ = std::fs::remove_dir_all(root);
    }
}
