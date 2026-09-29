//! Website icons for the vault's list.
//!
//! The app asks each website itself, so no icon service learns which sites
//! the vault holds, and it asks only public names over https, never an
//! address of this PC or the local network. What comes back is shown only
//! if its first bytes are an image's (never trusting what the server says it
//! is), and it is kept in the vault's icon cache, sealed with the vault key
//! (`vault.rs`), so the cache on disk does not give the sites away either.

use std::collections::{BTreeSet, HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use futures_util::StreamExt;
use reqwest::Url;
use reqwest::header::{ACCEPT, CONTENT_TYPE, LOCATION};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use super::PasswordsState;
use super::vault::CachedIcon;

/// Sent to the page for each icon fetched in the background.
pub const ICON_EVENT: &str = "passwords-icon";
/// A found icon is fetched again after a month; a site without one, a week.
const KEEP_FOUND: u64 = 30 * 24 * 3600;
const KEEP_MISSING: u64 = 7 * 24 * 3600;
/// Read of a home page: enough for its `<head>`.
const MAX_PAGE: usize = 512 * 1024;
const MAX_ICON: usize = 200 * 1024;
/// Websites asked at the same time.
const AT_ONCE: usize = 6;
static FETCHING: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize)]
struct Fetched {
    host: String,
    icon: String,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

/// The host whose icon an entry's address shows: a public name (no IP
/// address, no `localhost`, no name only the local network or Tor knows,
/// which asking for would only leak the name).
pub fn icon_host(url: &str) -> Option<String> {
    let host = super::browser::saved_host(url)?;
    if host.parse::<std::net::IpAddr>().is_ok() || host.starts_with('[') || !host.contains('.') {
        return None;
    }
    let top = host.rsplit('.').next().unwrap_or_default();
    if matches!(top, "arpa" | "onion" | "localhost" | "local" | "internal") {
        return None;
    }
    psl::suffix(host.as_bytes())
        .is_some_and(|suffix| suffix.is_known())
        .then_some(host)
}

/// The icons already known for the vault's websites, but those the page has
/// (`skip`). The missing and the old ones are fetched in the background and
/// sent as `passwords-icon`.
#[tauri::command]
pub async fn passwords_icons(
    app: AppHandle,
    state: State<'_, PasswordsState>,
    skip: Vec<String>,
) -> Result<HashMap<String, String>, String> {
    let skip: HashSet<String> = skip.into_iter().collect();
    let (known, wanted) = state.with_quiet(|vault| {
        if !vault.prefs().website_icons {
            return Ok((HashMap::new(), Vec::new()));
        }
        let hosts: BTreeSet<String> = vault
            .summaries()?
            .iter()
            .flat_map(|entry| entry.urls.iter().filter_map(|url| icon_host(url)))
            .collect();
        let now = now();
        let cache = vault.icons()?;
        let mut known = HashMap::new();
        let mut wanted = Vec::new();
        for host in hosts {
            match cache.icons.get(&host) {
                Some(cached) => {
                    if let Some(data) = &cached.data
                        && !skip.contains(&host)
                    {
                        known.insert(host.clone(), data.clone());
                    }
                    let keep = if cached.data.is_some() { KEEP_FOUND } else { KEEP_MISSING };
                    if now.saturating_sub(cached.at) >= keep {
                        wanted.push(host);
                    }
                }
                None => wanted.push(host),
            }
        }
        Ok((known, wanted))
    })?;
    if !wanted.is_empty() && !FETCHING.swap(true, Ordering::SeqCst) {
        let state = state.inner().clone();
        tauri::async_runtime::spawn(async move {
            fetch_all(&app, &state, wanted).await;
            FETCHING.store(false, Ordering::SeqCst);
        });
    }
    Ok(known)
}

async fn fetch_all(app: &AppHandle, state: &PasswordsState, hosts: Vec<String>) {
    let Ok(client) = client() else { return };
    let mut results = futures_util::stream::iter(hosts)
        .map(|host| {
            let client = client.clone();
            async move {
                let icon = fetch_icon(&client, &host).await;
                (host, icon)
            }
        })
        .buffer_unordered(AT_ONCE);
    let mut stored_since_save = 0;
    while let Some((host, icon)) = results.next().await {
        let stored = state.with_quiet(|vault| {
            if !vault.prefs().website_icons {
                return Err("Website icons are off.".to_string());
            }
            let cache = vault.icons()?;
            // A website that is down just now keeps the icon it had.
            let data = icon
                .clone()
                .or_else(|| cache.icons.get(&host).and_then(|old| old.data.clone()));
            cache.icons.insert(host.clone(), CachedIcon { data, at: now() });
            Ok(())
        });
        // Locked, or the icons were turned off: stop, and keep nothing.
        if stored.is_err() {
            return;
        }
        if let Some(icon) = icon {
            let _ = app.emit(ICON_EVENT, Fetched { host, icon });
        }
        // Kept as it goes: closing the app halfway loses little.
        stored_since_save += 1;
        if stored_since_save == 20 {
            stored_since_save = 0;
            let _ = state.with_quiet(|vault| vault.save_icons());
        }
    }
    let _ = state.with_quiet(|vault| vault.save_icons());
}

fn client() -> Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder()
        // Some sites answer an unknown program with an error page.
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
        )
        .https_only(true)
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(10))
        // Followed by `get`, which keeps every request on https.
        .redirect(reqwest::redirect::Policy::none())
        .build()
}

/// A GET that follows up to five redirects itself, turning an `http://` one
/// into `https://` (as a browser does for a site that asks for https), so
/// nothing ever goes out unencrypted.
async fn get(client: &reqwest::Client, url: &Url, accept: &str) -> Option<reqwest::Response> {
    let mut url = url.clone();
    for _ in 0..=5 {
        let response = client.get(url.clone()).header(ACCEPT, accept).send().await.ok()?;
        if !response.status().is_redirection() {
            return Some(response);
        }
        let location = response.headers().get(LOCATION)?.to_str().ok()?;
        let mut next = url.join(location).ok()?;
        if next.scheme() == "http" {
            next.set_scheme("https").ok()?;
            if next.port() == Some(80) {
                next.set_port(None).ok()?;
            }
        }
        if next.scheme() != "https" {
            return None;
        }
        url = next;
    }
    None
}

/// A website's icon as a `data:` URL: from its own host, else from the site
/// it belongs to (`mail.example.com` → `example.com`).
async fn fetch_icon(client: &reqwest::Client, host: &str) -> Option<String> {
    if let Some(icon) = icon_of(client, host).await {
        return Some(icon);
    }
    let site = psl::domain_str(host).filter(|site| *site != host)?;
    icon_of(client, site).await
}

async fn icon_of(client: &reqwest::Client, host: &str) -> Option<String> {
    let home = Url::parse(&format!("https://{host}/")).ok()?;
    let mut tried = Vec::new();
    let mut found = page(client, &home).await;
    // A page that only sends the browser on (`<meta http-equiv="refresh">`).
    if let Some((base, html)) = &found
        && icon_links(html, base).is_empty()
        && let Some(next) = meta_refresh(html, base)
        && let Some(next_page) = page(client, &next).await
    {
        found = Some(next_page);
    }
    if let Some((base, html)) = found {
        let fallback = base.join("/favicon.ico").ok();
        for link in icon_links(&html, &base).into_iter().chain(fallback) {
            if tried.contains(&link) {
                continue;
            }
            if let Some(icon) = image(client, &link).await {
                return Some(icon);
            }
            tried.push(link);
        }
    }
    let fallback = home.join("/favicon.ico").ok()?;
    if tried.contains(&fallback) {
        return None;
    }
    image(client, &fallback).await
}

/// The start of a website's home page (up to its `</head>`), and where it
/// ended up after redirects.
async fn page(client: &reqwest::Client, url: &Url) -> Option<(Url, String)> {
    let mut response = get(client, url, "text/html").await?;
    if !response.status().is_success() {
        return None;
    }
    let is_html = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.to_ascii_lowercase().contains("html"));
    if !is_html {
        return None;
    }
    let base = response.url().clone();
    let mut body: Vec<u8> = Vec::new();
    while let Ok(Some(chunk)) = response.chunk().await {
        let searched = body.len().saturating_sub(6);
        body.extend_from_slice(&chunk);
        if body.len() >= MAX_PAGE || contains_ignoring_case(&body[searched..], b"</head>") {
            break;
        }
    }
    body.truncate(MAX_PAGE);
    Some((base, String::from_utf8_lossy(&body).into_owned()))
}

fn contains_ignoring_case(haystack: &[u8], needle: &[u8]) -> bool {
    haystack
        .windows(needle.len())
        .any(|window| window.eq_ignore_ascii_case(needle))
}

/// The icons a page names in `<link rel="icon">` (and Apple's touch icons),
/// best first: a scalable or a larger one over a tiny one.
fn icon_links(html: &str, base: &Url) -> Vec<Url> {
    // ASCII lowercasing keeps every byte where it was.
    let lower = html.to_ascii_lowercase();
    let mut found: Vec<(u32, Url)> = Vec::new();
    let mut from = 0;
    while let Some(at) = lower[from..].find("<link") {
        let start = from + at;
        let Some(length) = lower[start..].find('>') else { break };
        let tag = &html[start..start + length];
        from = start + length;
        let attrs = attributes(tag);
        let rel = attrs.get("rel").map(|r| r.to_ascii_lowercase()).unwrap_or_default();
        let touch = rel.split_ascii_whitespace().any(|r| r.starts_with("apple-touch-icon"));
        if !touch && !rel.split_ascii_whitespace().any(|r| r == "icon") {
            continue;
        }
        let Some(href) = attrs.get("href").map(|h| h.trim().replace("&amp;", "&")) else {
            continue;
        };
        let Ok(url) = base.join(&href) else { continue };
        if !matches!(url.scheme(), "https" | "data") {
            continue;
        }
        let kind = attrs.get("type").map(|t| t.to_ascii_lowercase()).unwrap_or_default();
        let sizes = attrs.get("sizes").map(|s| s.to_ascii_lowercase()).unwrap_or_default();
        let scalable = kind.contains("svg") || sizes == "any" || url.path().to_ascii_lowercase().ends_with(".svg");
        let score = match largest(&sizes) {
            _ if scalable => 90,
            Some(size) if (48..=256).contains(&size) => 100 - size.abs_diff(96) / 8,
            Some(size) if size > 256 => 60,
            Some(size) if size >= 32 => 80,
            Some(_) => 40,
            None if touch => 85,
            None => 50,
        };
        found.push((score, url));
    }
    found.sort_by_key(|(score, _)| std::cmp::Reverse(*score));
    let mut seen = HashSet::new();
    found
        .into_iter()
        .filter_map(|(_, url)| seen.insert(url.clone()).then_some(url))
        .take(4)
        .collect()
}

/// Where a `<meta http-equiv="refresh" content="0; url=…">` sends the browser.
fn meta_refresh(html: &str, base: &Url) -> Option<Url> {
    let lower = html.to_ascii_lowercase();
    let mut from = 0;
    while let Some(at) = lower[from..].find("<meta") {
        let start = from + at;
        let length = lower[start..].find('>')?;
        from = start + length;
        let attrs = attributes(&html[start..start + length]);
        if !attrs.get("http-equiv").is_some_and(|v| v.eq_ignore_ascii_case("refresh")) {
            continue;
        }
        let content = attrs.get("content")?;
        let at = content.to_ascii_lowercase().find("url=")?;
        let target = content[at + 4..].trim().trim_matches(['\'', '"']);
        return base.join(target).ok().filter(|url| url.scheme() == "https");
    }
    None
}

/// The largest width in a `sizes` attribute ("16x16 32x32" → 32).
fn largest(sizes: &str) -> Option<u32> {
    sizes
        .split_ascii_whitespace()
        .filter_map(|size| size.split_once('x')?.0.parse().ok())
        .max()
}

/// A tag's attributes, names lowercased; the first of a repeated name wins.
fn attributes(tag: &str) -> HashMap<String, String> {
    let bytes = tag.as_bytes();
    let mut attrs = HashMap::new();
    // Past the tag's name.
    let mut i = bytes.iter().position(|b| b.is_ascii_whitespace()).unwrap_or(bytes.len());
    while i < bytes.len() {
        while i < bytes.len() && (bytes[i].is_ascii_whitespace() || bytes[i] == b'/') {
            i += 1;
        }
        let name_start = i;
        while i < bytes.len() && !bytes[i].is_ascii_whitespace() && bytes[i] != b'=' && bytes[i] != b'/' {
            i += 1;
        }
        if i == name_start {
            break;
        }
        let name = tag[name_start..i].to_ascii_lowercase();
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        let mut value = "";
        if i < bytes.len() && bytes[i] == b'=' {
            i += 1;
            while i < bytes.len() && bytes[i].is_ascii_whitespace() {
                i += 1;
            }
            if i < bytes.len() && (bytes[i] == b'"' || bytes[i] == b'\'') {
                let quote = bytes[i];
                let value_start = i + 1;
                i = value_start;
                while i < bytes.len() && bytes[i] != quote {
                    i += 1;
                }
                value = &tag[value_start..i];
                i += 1;
            } else {
                let value_start = i;
                while i < bytes.len() && !bytes[i].is_ascii_whitespace() {
                    i += 1;
                }
                value = &tag[value_start..i];
            }
        }
        attrs.entry(name).or_insert_with(|| value.to_string());
    }
    attrs
}

async fn image(client: &reqwest::Client, url: &Url) -> Option<String> {
    if url.scheme() == "data" {
        return data_url_image(url.as_str());
    }
    let mut response = get(client, url, "image/*,*/*;q=0.5").await?;
    if !response.status().is_success() || response.content_length().is_some_and(|n| n > MAX_ICON as u64) {
        return None;
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.ok()? {
        body.extend_from_slice(&chunk);
        if body.len() > MAX_ICON {
            return None;
        }
    }
    as_data_url(&body)
}

/// An icon written into the page itself (`data:image/png;base64,…`).
fn data_url_image(url: &str) -> Option<String> {
    let (meta, payload) = url.strip_prefix("data:")?.split_once(',')?;
    let bytes = if meta.to_ascii_lowercase().ends_with(";base64") {
        STANDARD.decode(payload.trim()).ok()?
    } else {
        percent_decode(payload)
    };
    as_data_url(&bytes)
}

fn percent_decode(text: &str) -> Vec<u8> {
    let bytes = text.as_bytes();
    let hex = |b: u8| (b as char).to_digit(16).map(|d| d as u8);
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && let (Some(high), Some(low)) = (hex(bytes[i + 1]), hex(bytes[i + 2]))
        {
            out.push(high * 16 + low);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    out
}

fn as_data_url(bytes: &[u8]) -> Option<String> {
    let kind = sniff(bytes)?;
    Some(format!("data:{kind};base64,{}", STANDARD.encode(bytes)))
}

/// What image `bytes` are, from their first bytes (never from what the
/// server claims), or none when they are not an image worth showing.
fn sniff(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() < 24 || bytes.len() > MAX_ICON {
        return None;
    }
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        let width = u32::from_be_bytes(bytes[16..20].try_into().ok()?);
        let height = u32::from_be_bytes(bytes[20..24].try_into().ok()?);
        // A 1x1 placeholder is not an icon.
        return (width >= 16 && height >= 16).then_some("image/png");
    }
    if bytes.starts_with(&[0, 0, 1, 0]) {
        return Some("image/x-icon");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        let width = u16::from_le_bytes([bytes[6], bytes[7]]);
        let height = u16::from_le_bytes([bytes[8], bytes[9]]);
        return (width >= 16 && height >= 16).then_some("image/gif");
    }
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some("image/jpeg");
    }
    if &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    let head = String::from_utf8_lossy(&bytes[..bytes.len().min(1024)]).to_ascii_lowercase();
    let head = head.trim_start_matches('\u{feff}').trim_start();
    // Drawn by <img>, where an SVG's scripts never run.
    (head.starts_with('<') && head.contains("<svg")).then_some("image/svg+xml")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_public_names_are_asked() {
        assert_eq!(icon_host("https://www.GitHub.com/login").as_deref(), Some("github.com"));
        assert_eq!(icon_host("accounts.google.com").as_deref(), Some("accounts.google.com"));
        assert_eq!(icon_host("http://192.168.1.1"), None);
        assert_eq!(icon_host("http://localhost:8080"), None);
        assert_eq!(icon_host("https://router.local"), None);
        assert_eq!(icon_host("https://nas.home.arpa"), None);
        assert_eq!(icon_host("https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion"), None);
        assert_eq!(icon_host("https://[::1]/"), None);
    }

    #[test]
    fn the_best_icon_a_page_names_comes_first() {
        let base = Url::parse("https://www.example.com/start").unwrap();
        let html = r##"<html><head>
            <link rel="stylesheet" href="/site.css">
            <LINK REL="shortcut icon" href="/favicon.ico">
            <link rel=icon sizes="16x16" href="small.png">
            <link rel="icon" type="image/png" sizes="96x96" href="https://cdn.example.com/icon-96.png?v=1&amp;x=2">
            <link rel="mask-icon" href="/mask.svg" color="#000">
            <link rel="apple-touch-icon" href="/touch.png">
            <link rel="icon" href="http://example.com/insecure.png">
        </head>"##;
        let links: Vec<String> = icon_links(html, &base).iter().map(Url::to_string).collect();
        assert_eq!(
            links,
            [
                "https://cdn.example.com/icon-96.png?v=1&x=2",
                "https://www.example.com/touch.png",
                "https://www.example.com/favicon.ico",
                "https://www.example.com/small.png",
            ]
        );
    }

    #[test]
    fn a_page_that_sends_the_browser_on_is_followed() {
        let base = Url::parse("https://www.example.gr/").unwrap();
        let html = r#"<HTML><HEAD><meta http-equiv="refresh" content="0; url=/hub" /></HEAD></HTML>"#;
        assert_eq!(meta_refresh(html, &base).unwrap().as_str(), "https://www.example.gr/hub");
        let insecure = r#"<meta http-equiv="Refresh" content="0;URL='http://example.gr/'">"#;
        assert_eq!(meta_refresh(insecure, &base), None);
    }

    #[test]
    fn only_real_images_are_kept() {
        let mut png = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
        png.extend_from_slice(&32u32.to_be_bytes());
        png.extend_from_slice(&32u32.to_be_bytes());
        png.extend_from_slice(&[0; 20]);
        assert_eq!(sniff(&png), Some("image/png"));
        png[16..24].copy_from_slice(&[0, 0, 0, 1, 0, 0, 0, 1]);
        assert_eq!(sniff(&png), None, "a 1x1 placeholder");
        let svg = br#"<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>"#;
        assert_eq!(sniff(svg), Some("image/svg+xml"));
        assert_eq!(sniff(b"<!doctype html><html><body>Not found</body></html>"), None);
        assert_eq!(sniff(&[7; 64]), None);
    }

    /// Asks real websites: `cargo test --lib icons -- --ignored`.
    #[tokio::test]
    #[ignore = "uses the network"]
    async fn real_websites_give_their_icons() {
        let client = client().unwrap();
        for host in ["github.com", "www.wikipedia.org", "accounts.google.com", "cosmote.gr"] {
            let icon = fetch_icon(&client, host).await;
            println!("{host}: {}", icon.as_deref().map_or("none".into(), |i| i[..40.min(i.len())].to_string()));
            assert!(icon.is_some_and(|i| i.starts_with("data:image/")), "{host}");
        }
    }

    #[test]
    fn icons_written_into_the_page_are_read() {
        let svg = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2016%2016'%3E%3C/svg%3E";
        assert!(data_url_image(svg).unwrap().starts_with("data:image/svg+xml;base64,"));
        let html = format!("data:text/html;base64,{}", STANDARD.encode("<html><script>alert(1)</script></html>"));
        assert_eq!(data_url_image(&html), None);
    }
}
