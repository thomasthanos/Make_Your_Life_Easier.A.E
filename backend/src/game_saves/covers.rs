//! Game covers for the Game Saves list: Steam's portrait art
//! (`library_600x900.jpg`) for every game with a Steam id in the save
//! database. Steam's own cache on this PC comes first, so nothing is asked
//! for a game Steam already shows; else, when the user allows it, Steam's
//! image server, and what comes back is kept in the local data folder.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use futures_util::StreamExt;
use winreg::RegKey;
use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};

/// A cover is a JPEG of about 40 KB; anything far bigger is not one.
const MAX_COVER: usize = 600 * 1024;
/// A game Steam has no cover for is asked again after a week.
const RETRY_MISSING_AFTER: Duration = Duration::from_secs(7 * 24 * 3600);
/// Covers asked of Steam at the same time.
const AT_ONCE: usize = 4;
const COVER: &str = "library_600x900.jpg";

/// The covers found for `ids` (Steam app ids), as `data:` URLs. With
/// `online`, the ones not on this PC are fetched from Steam first.
#[tauri::command]
pub async fn game_saves_covers(ids: Vec<u32>, online: bool) -> Result<HashMap<u32, String>, String> {
    let mut ids: Vec<u32> = ids.into_iter().filter(|id| *id > 0).collect();
    ids.sort_unstable();
    ids.dedup();
    ids.truncate(5000);
    let folder = crate::storage::local_dir()?.join("game-saves").join("covers");
    let (mut found, missing) = {
        let folder = folder.clone();
        tauri::async_runtime::spawn_blocking(move || on_this_pc(&ids, &folder))
            .await
            .map_err(|e| e.to_string())?
    };
    if online && !missing.is_empty() {
        let client = crate::download::http_client("MYLE")?;
        let fetched: Vec<(u32, Option<Vec<u8>>)> = futures_util::stream::iter(missing)
            .map(|id| {
                let client = client.clone();
                async move { (id, fetch(&client, id).await) }
            })
            .buffer_unordered(AT_ONCE)
            .collect()
            .await;
        let _ = std::fs::create_dir_all(&folder);
        for (id, bytes) in fetched {
            match bytes {
                Some(bytes) => {
                    let _ = super::atomic::write(&folder.join(format!("{id}.jpg")), &bytes);
                    found.insert(id, data_url(&bytes));
                }
                // Not there (or not now): noted, so it is not asked again at once.
                None => {
                    let _ = std::fs::write(folder.join(format!("{id}.none")), b"");
                }
            }
        }
    }
    Ok(found)
}

/// The covers on this PC, and the ids still worth asking Steam for.
fn on_this_pc(ids: &[u32], folder: &Path) -> (HashMap<u32, String>, Vec<u32>) {
    let steam = steam_cache();
    let mut found = HashMap::new();
    let mut missing = Vec::new();
    for &id in ids {
        let candidates = [
            steam.as_ref().map(|cache| cache.join(id.to_string()).join(COVER)),
            Some(folder.join(format!("{id}.jpg"))),
        ];
        if let Some(bytes) = candidates.iter().flatten().find_map(|path| read_cover(path)) {
            found.insert(id, data_url(&bytes));
        } else if !recently_missing(&folder.join(format!("{id}.none"))) {
            missing.push(id);
        }
    }
    (found, missing)
}

/// Steam's own image cache, if Steam is installed.
fn steam_cache() -> Option<PathBuf> {
    let steam = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(r"Software\Valve\Steam", KEY_READ)
        .and_then(|key| key.get_value::<String, _>("SteamPath"))
        .map(PathBuf::from)
        .ok()
        .or_else(|| std::env::var_os("ProgramFiles(x86)").map(|dir| PathBuf::from(dir).join("Steam")))?;
    let cache = steam.join("appcache").join("librarycache");
    cache.is_dir().then_some(cache)
}

fn read_cover(path: &Path) -> Option<Vec<u8>> {
    let bytes = std::fs::read(path).ok()?;
    is_cover(&bytes).then_some(bytes)
}

/// A JPEG of a sensible size, whatever the file or the server claims.
fn is_cover(bytes: &[u8]) -> bool {
    bytes.len() > 1024 && bytes.len() <= MAX_COVER && bytes.starts_with(&[0xFF, 0xD8, 0xFF])
}

fn recently_missing(marker: &Path) -> bool {
    std::fs::metadata(marker)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|at| SystemTime::now().duration_since(at).ok())
        .is_some_and(|age| age < RETRY_MISSING_AFTER)
}

async fn fetch(client: &reqwest::Client, id: u32) -> Option<Vec<u8>> {
    let url = format!("https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/{id}/{COVER}");
    let response = client.get(url).timeout(Duration::from_secs(15)).send().await.ok()?;
    if !response.status().is_success() || response.content_length().is_some_and(|n| n as usize > MAX_COVER) {
        return None;
    }
    let bytes = response.bytes().await.ok()?;
    is_cover(&bytes).then(|| bytes.to_vec())
}

fn data_url(bytes: &[u8]) -> String {
    format!("data:image/jpeg;base64,{}", STANDARD.encode(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_jpegs_of_a_sensible_size_are_covers() {
        let mut jpeg = vec![0xFF, 0xD8, 0xFF, 0xE0];
        jpeg.resize(40 * 1024, 0);
        assert!(is_cover(&jpeg));
        assert!(!is_cover(&jpeg[..512]), "too small to be a cover");
        assert!(!is_cover(b"<!doctype html><html>Not Found</html>"));
        let mut huge = jpeg.clone();
        huge.resize(MAX_COVER + 1, 0);
        assert!(!is_cover(&huge));
    }

    #[test]
    fn a_game_without_a_cover_is_not_asked_again_for_a_week() {
        let folder = std::env::temp_dir().join(format!("myle-covers-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let marker = folder.join("4000000005.none");
        assert!(!recently_missing(&marker));
        std::fs::write(&marker, b"").unwrap();
        assert!(recently_missing(&marker));
        // Ids no Steam game has, so Steam's own cache cannot have them either.
        let (found, missing) = on_this_pc(&[4_000_000_001, 4_000_000_003], &folder);
        assert!(found.is_empty());
        assert_eq!(missing, vec![4_000_000_001, 4_000_000_003]);
        std::fs::write(folder.join("4000000001.none"), b"").unwrap();
        assert_eq!(on_this_pc(&[4_000_000_001, 4_000_000_003], &folder).1, vec![4_000_000_003]);
        let _ = std::fs::remove_dir_all(&folder);
    }

    /// Asks Steam for a real cover: `cargo test --lib covers -- --ignored`.
    #[tokio::test]
    #[ignore = "uses the network"]
    async fn steam_gives_a_cover_by_app_id() {
        let client = crate::download::http_client("MYLE").unwrap();
        let cover = fetch(&client, 1245620).await.expect("Elden Ring has a cover");
        assert!(is_cover(&cover));
        assert!(fetch(&client, 1).await.is_none(), "no such app");
    }
}
