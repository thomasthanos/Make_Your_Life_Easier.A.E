//! Filling in logins in Chrome, Edge and Firefox.
//!
//! The browser extension (`extension/`) talks to a "native messaging host"
//! the browser starts: this same program, run by the browser with the
//! extension's id as its argument (`run_native_host`). The host passes each
//! request over a named pipe to the app that is running, which answers from
//! the unlocked vault (`serve`).
//!
//! Who may ask:
//! - the browser starts the host only for our extension (the manifests list
//!   its id), and the host also checks the id it was given and that a
//!   browser started it;
//! - the app answers only a host that is this same program, and the host
//!   only talks to an app that is this same program;
//! - the app answers only while browser filling is on and the vault is
//!   unlocked, gives a password only for an entry saved for that site, and
//!   only for https pages (or this PC's own `localhost`);
//! - it answers only so many requests a minute: plenty for a person
//!   clicking, far too few for a program trying to empty the vault;
//! - look-ups from the browser never keep an unattended vault open; only
//!   what the extension does at the user's click (fill, save, a new
//!   password) counts as using it;
//! - a page can change only the login saved for its own host, never one of
//!   another subdomain (the password it replaces goes into the history).

use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Read, Write};
use std::os::windows::io::AsRawHandle;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use tokio::net::windows::named_pipe::ServerOptions;
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::Pipes::{GetNamedPipeClientProcessId, GetNamedPipeServerProcessId};
use windows_sys::Win32::System::Threading::{
    OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
};
use winreg::RegKey;
use winreg::enums::HKEY_CURRENT_USER;
use zeroize::Zeroizing;

use super::PasswordsState;
use super::vault::{EntryInput, Status};

/// The native messaging host's name, as the extension asks for it.
pub const HOST_NAME: &str = "com.thomasthanos.myle";
/// The extension's id in Chrome and Edge (fixed by the `key` in its manifest).
pub const CHROME_EXTENSION_ID: &str = "gaelkhdpkgnffkfmaaklknijinjmmopo";
/// Its id in Firefox (`browser_specific_settings.gecko.id`).
pub const FIREFOX_EXTENSION_ID: &str = "myle-passwords@thomast.uk";
/// Browsers the host may be started by (their program file names).
const BROWSERS: [&str; 4] = ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe"];
/// Where each browser looks for native messaging hosts.
const HOST_KEYS: [(&str, &str); 4] = [
    (r"Software\Google\Chrome\NativeMessagingHosts", "chrome.json"),
    (r"Software\Microsoft\Edge\NativeMessagingHosts", "chrome.json"),
    (r"Software\BraveSoftware\Brave-Browser\NativeMessagingHosts", "chrome.json"),
    (r"Software\Mozilla\NativeMessagingHosts", "firefox.json"),
];
/// A native message larger than this is not ours.
const MAX_MESSAGE: u32 = 64 * 1024;
/// Website icons sent with a site's logins: each small, and all together
/// well under the browser's 1 MB limit for an answer.
const MAX_ICON: usize = 48 * 1024;
const ICONS_PER_ANSWER: usize = 384 * 1024;
/// Requests a minute that give out, check or change a password, and
/// look-ups of which logins a site has.
const SENSITIVE_PER_MINUTE: usize = 20;
const LOOKUPS_PER_MINUTE: usize = 120;
static SENSITIVE: Mutex<VecDeque<Instant>> = Mutex::new(VecDeque::new());
static LOOKUPS: Mutex<VecDeque<Instant>> = Mutex::new(VecDeque::new());

/// Counts a request against `bucket`; false when the minute's share is used.
fn allow(bucket: &Mutex<VecDeque<Instant>>, per_minute: usize) -> bool {
    let mut times = bucket.lock().unwrap_or_else(|p| p.into_inner());
    let now = Instant::now();
    while times
        .front()
        .is_some_and(|at| now.duration_since(*at) >= Duration::from_secs(60))
    {
        times.pop_front();
    }
    if times.len() >= per_minute {
        return false;
    }
    times.push_back(now);
    true
}

// ---------------------------------------------------------------------------
// Registration

fn manifest_dir() -> Result<PathBuf, String> {
    Ok(crate::storage::local_dir()?.join("native-messaging"))
}

/// Tells Chrome, Edge, Brave and Firefox where the host is. Written again
/// on every start, so it follows the program if it moves.
pub fn register_hosts() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = manifest_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let description = "MYLE: fills in logins from your password vault";
    let chrome = json!({
        "name": HOST_NAME,
        "description": description,
        "path": exe,
        "type": "stdio",
        "allowed_origins": [format!("chrome-extension://{CHROME_EXTENSION_ID}/")],
    });
    let firefox = json!({
        "name": HOST_NAME,
        "description": description,
        "path": exe,
        "type": "stdio",
        "allowed_extensions": [FIREFOX_EXTENSION_ID],
    });
    for (name, manifest) in [("chrome.json", &chrome), ("firefox.json", &firefox)] {
        let text = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
        std::fs::write(dir.join(name), text).map_err(|e| e.to_string())?;
    }
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    for (key, file) in HOST_KEYS {
        let (host, _) = hkcu
            .create_subkey(format!(r"{key}\{HOST_NAME}"))
            .map_err(|e| e.to_string())?;
        host.set_value("", &dir.join(file).to_string_lossy().into_owned())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Browser filling switched off: the browsers forget the host.
pub fn unregister_hosts() {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    for (key, _) in HOST_KEYS {
        let _ = hkcu.delete_subkey_all(format!(r"{key}\{HOST_NAME}"));
    }
    if let Ok(dir) = manifest_dir() {
        let _ = std::fs::remove_dir_all(dir);
    }
}

// ---------------------------------------------------------------------------
// Processes

/// The pipe both sides meet at, one per Windows user.
fn pipe_name() -> String {
    let user = std::env::var("USERNAME").unwrap_or_default();
    let domain = std::env::var("USERDOMAIN").unwrap_or_default();
    let digest = Sha256::digest(format!("{domain}\\{user}").to_lowercase().as_bytes());
    let id: String = digest[..8].iter().map(|b| format!("{b:02x}")).collect();
    format!(r"\\.\pipe\myle-passwords-{id}")
}

pub(super) fn process_path(pid: u32) -> Option<PathBuf> {
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return None;
        }
        let mut buffer = [0u16; 1024];
        let mut length = buffer.len() as u32;
        let ok = QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, buffer.as_mut_ptr(), &mut length);
        CloseHandle(process);
        (ok != 0).then(|| PathBuf::from(String::from_utf16_lossy(&buffer[..length as usize])))
    }
}

fn same_file(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => a.to_string_lossy().eq_ignore_ascii_case(&b.to_string_lossy()),
    }
}

/// Whether `pid` runs this very program.
fn is_this_program(pid: u32) -> bool {
    match (process_path(pid), std::env::current_exe()) {
        (Some(other), Ok(mine)) => same_file(&other, &mine),
        _ => false,
    }
}

/// This process's parent, grandparent and so on (Chrome starts the host
/// through `cmd.exe`), as program file names, lowercase.
fn ancestors() -> Vec<String> {
    let mut parents = std::collections::HashMap::new();
    let mut names = std::collections::HashMap::new();
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot.is_null() || snapshot as isize == -1 {
            return Vec::new();
        }
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
        let mut more = Process32FirstW(snapshot, &mut entry) != 0;
        while more {
            let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
            names.insert(entry.th32ProcessID, String::from_utf16_lossy(&entry.szExeFile[..len]).to_lowercase());
            parents.insert(entry.th32ProcessID, entry.th32ParentProcessID);
            more = Process32NextW(snapshot, &mut entry) != 0;
        }
        CloseHandle(snapshot);
    }
    let mut chain = Vec::new();
    let mut pid = std::process::id();
    for _ in 0..4 {
        let Some(&parent) = parents.get(&pid) else { break };
        let Some(name) = names.get(&parent) else { break };
        chain.push(name.clone());
        pid = parent;
    }
    chain
}

// ---------------------------------------------------------------------------
// The host, started by the browser

/// `Some(exit code)` when a browser started this program as the extension's
/// native messaging host; `None` for a normal start.
pub fn run_native_host() -> Option<i32> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    // Chrome and Edge pass the extension's origin; Firefox the path of the
    // manifest and the extension's id.
    // Chrome may omit the trailing slash when passing the caller origin.
    let chrome_origin = format!("chrome-extension://{CHROME_EXTENSION_ID}");
    let ours = args.iter().any(|a| a == &chrome_origin || a == &format!("{chrome_origin}/") || a == FIREFOX_EXTENSION_ID);
    let asked = args.iter().any(|a| a.starts_with("chrome-extension://"))
        || args.iter().any(|a| a.ends_with(".json")) && args.iter().any(|a| a.contains('@'));
    if !asked {
        return None;
    }
    if !ours || !ancestors().iter().any(|name| BROWSERS.contains(&name.as_str())) {
        return Some(3);
    }
    Some(match host_loop() {
        Ok(()) => 0,
        Err(_) => 2,
    })
}

fn read_message(input: &mut impl Read) -> std::io::Result<Option<Value>> {
    let mut length = [0u8; 4];
    match input.read_exact(&mut length) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let length = u32::from_le_bytes(length);
    if length > MAX_MESSAGE {
        return Err(std::io::ErrorKind::InvalidData.into());
    }
    let mut body = Zeroizing::new(vec![0u8; length as usize]);
    input.read_exact(&mut body)?;
    Ok(Some(serde_json::from_slice(&body).map_err(|_| std::io::Error::from(std::io::ErrorKind::InvalidData))?))
}

fn write_message(output: &mut impl Write, value: &Value) -> std::io::Result<()> {
    let body = Zeroizing::new(serde_json::to_vec(value)?);
    output.write_all(&(body.len() as u32).to_le_bytes())?;
    output.write_all(&body)?;
    output.flush()
}

/// Passes each message from the browser to the app and back.
fn host_loop() -> std::io::Result<()> {
    let mut input = std::io::stdin().lock();
    let mut output = std::io::stdout().lock();
    while let Some(message) = read_message(&mut input)? {
        let reply = if message.get("type").and_then(Value::as_str) == Some("open") && !app_running() {
            // The app is not running: start it; it shows the vault.
            let started = std::env::current_exe()
                .and_then(|exe| std::process::Command::new(exe).arg("--open-passwords").spawn())
                .is_ok();
            json!({ "ok": started })
        } else {
            ask_app(&message).unwrap_or_else(|| json!({ "ok": false, "error": "notRunning" }))
        };
        write_message(&mut output, &reply)?;
    }
    Ok(())
}

fn app_running() -> bool {
    std::fs::OpenOptions::new().read(true).write(true).open(pipe_name()).is_ok()
}

/// One request to the running app; `None` when it is not running (or the
/// pipe's owner is not this program).
fn ask_app(message: &Value) -> Option<Value> {
    let pipe = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(pipe_name())
        .ok()?;
    let mut server = 0u32;
    let ok = unsafe { GetNamedPipeServerProcessId(pipe.as_raw_handle() as HANDLE, &mut server) };
    if ok == 0 || !is_this_program(server) {
        return None;
    }
    let mut writer = pipe.try_clone().ok()?;
    let mut line = Zeroizing::new(serde_json::to_string(message).ok()?);
    line.push('\n');
    writer.write_all(line.as_bytes()).ok()?;
    writer.flush().ok()?;
    let mut answer = Zeroizing::new(String::new());
    BufReader::new(pipe).read_line(&mut answer).ok()?;
    serde_json::from_str(answer.trim()).ok()
}

// ---------------------------------------------------------------------------
// The app's side

/// Answers the host while the app runs.
pub fn serve(app: AppHandle, state: PasswordsState) {
    tauri::async_runtime::spawn(async move {
        let name = pipe_name();
        let Ok(mut server) = ServerOptions::new()
            .first_pipe_instance(true)
            .reject_remote_clients(true)
            .create(&name)
        else {
            // Another copy of the app already answers.
            return;
        };
        loop {
            if server.connect().await.is_err() {
                continue;
            }
            let client = server;
            server = match ServerOptions::new().reject_remote_clients(true).create(&name) {
                Ok(next) => next,
                Err(_) => return,
            };
            let (app, state) = (app.clone(), state.clone());
            tauri::async_runtime::spawn(async move {
                let mut pid = 0u32;
                let ok = unsafe { GetNamedPipeClientProcessId(client.as_raw_handle() as HANDLE, &mut pid) };
                if ok == 0 || !is_this_program(pid) {
                    return;
                }
                let mut client = tokio::io::BufReader::new(client);
                let mut line = Zeroizing::new(String::new());
                if client.read_line(&mut line).await.unwrap_or(0) == 0 {
                    return;
                }
                let reply = match serde_json::from_str::<Request>(line.trim()) {
                    Ok(request) => answer(&app, &state, request),
                    Err(_) => json!({ "ok": false, "error": "badRequest" }),
                };
                let mut out = Zeroizing::new(reply.to_string());
                out.push('\n');
                let _ = client.get_mut().write_all(out.as_bytes()).await;
                let _ = client.get_mut().flush().await;
            });
        }
    });
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum Request {
    Status,
    Open,
    Logins { url: String },
    Fill { id: String, url: String },
    Known { url: String, username: String, password: String },
    Save { url: String, username: String, password: String },
    /// A strong new password, for a sign-up or password-change form.
    Generate,
}

#[derive(Serialize)]
struct Login {
    id: String,
    title: String,
    username: String,
    /// Saved for this exact host (else for the same site, another subdomain).
    exact: bool,
    /// The host it was saved for, shown when it is not the page's own.
    site: String,
    /// The website's icon from the vault's cache (a `data:` URL), if known.
    #[serde(skip_serializing_if = "Option::is_none")]
    icon: Option<String>,
}

/// The page's host, if it is one we fill: https, or http on this PC.
fn page_host(url: &str) -> Option<String> {
    let parsed = reqwest::Url::parse(url).ok()?;
    let host = parsed.host_str()?.trim_end_matches('.').to_lowercase();
    let local = matches!(host.as_str(), "localhost" | "127.0.0.1" | "[::1]");
    (parsed.scheme() == "https" || parsed.scheme() == "http" && local).then_some(host)
}

pub(super) fn saved_host(value: &str) -> Option<String> {
    let address = if value.contains("://") { value.to_string() } else { format!("https://{value}") };
    let parsed = reqwest::Url::parse(&address).ok()?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return None;
    }
    Some(parsed.host_str()?.trim_end_matches('.').trim_start_matches("www.").to_lowercase())
}

/// The part of a host that one owner controls (`accounts.google.com` →
/// `google.com`, `a.b.co.uk` → `b.co.uk`), from the Public Suffix List.
fn site(host: &str) -> String {
    psl::domain_str(host).unwrap_or(host).to_string()
}

/// How well an entry's saved address fits the page: `Some(true)` the same
/// host, `Some(false)` the same site, `None` another site.
fn fits(saved: &str, page: &str) -> Option<bool> {
    let saved = saved_host(saved)?;
    let page_bare = page.trim_start_matches("www.");
    if saved == page_bare {
        Some(true)
    } else if site(&saved) == site(page_bare) {
        Some(false)
    } else {
        None
    }
}

fn answer(app: &AppHandle, state: &PasswordsState, request: Request) -> Value {
    if let Request::Open = request {
        open_vault(app);
        return json!({ "ok": true });
    }
    let enabled = state.with_quiet(|vault| Ok(vault.prefs().browser_filling)).unwrap_or(false);
    let status = state.with_quiet(|vault| Ok(vault.status())).unwrap_or(Status::New);
    if let Request::Status = request {
        return json!({ "ok": true, "enabled": enabled, "state": status });
    }
    if !enabled {
        return json!({ "ok": false, "error": "disabled" });
    }
    let within_limit = match request {
        Request::Logins { .. } => allow(&LOOKUPS, LOOKUPS_PER_MINUTE),
        _ => allow(&SENSITIVE, SENSITIVE_PER_MINUTE),
    };
    if !within_limit {
        return json!({ "ok": false, "error": "busy" });
    }
    if let Request::Generate = request {
        // Asked at the user's click on a sign-up form: keep the vault open
        // until the form is sent and the new login can be saved.
        let _ = state.with_quiet(|vault| {
            vault.touch();
            Ok(())
        });
        let options = super::generator::Options {
            length: 20,
            lower: true,
            upper: true,
            digits: true,
            symbols: true,
            avoid_ambiguous: true,
        };
        return match super::generator::generate(&options) {
            Ok(password) => json!({ "ok": true, "password": password.as_str() }),
            Err(error) => json!({ "ok": false, "error": error }),
        };
    }
    if status != Status::Unlocked {
        return json!({ "ok": false, "error": if status == Status::New { "noVault" } else { "locked" } });
    }
    let result = state.with_quiet(|vault| match &request {
        Request::Logins { url } => {
            let host = page_host(url).ok_or("insecure")?;
            let mut logins: Vec<Login> = vault
                .summaries()?
                .into_iter()
                .filter_map(|entry| {
                    let (exact, saved) = entry
                        .urls
                        .iter()
                        .filter_map(|u| fits(u, &host).map(|exact| (exact, u)))
                        .max_by_key(|(exact, _)| *exact)?;
                    Some(Login {
                        site: saved_host(saved).unwrap_or_default(),
                        id: entry.id,
                        title: entry.title,
                        username: entry.username,
                        exact,
                        icon: None,
                    })
                })
                .collect();
            logins.sort_by(|a, b| b.exact.cmp(&a.exact).then(a.title.cmp(&b.title)));
            // Only what the app already has: the browser never makes it fetch.
            if vault.prefs().website_icons {
                let cache = vault.icons()?;
                let mut budget = ICONS_PER_ANSWER;
                for login in &mut logins {
                    let icon = super::icons::icon_host(&login.site)
                        .and_then(|host| cache.icons.get(&host))
                        .and_then(|cached| cached.data.as_ref())
                        .filter(|data| data.len() <= MAX_ICON.min(budget));
                    if let Some(icon) = icon {
                        budget -= icon.len();
                        login.icon = Some(icon.clone());
                    }
                }
            }
            Ok(json!({ "ok": true, "logins": logins }))
        }
        Request::Fill { id, url } => {
            let host = page_host(url).ok_or("insecure")?;
            let entry = vault
                .summaries()?
                .into_iter()
                .find(|e| e.id == *id)
                .ok_or("notFound")?;
            // Only for the site it was saved for, whatever the page asks.
            if !entry.urls.iter().any(|u| fits(u, &host).is_some()) {
                return Err("wrongSite".to_string());
            }
            let password = vault.password(id)?;
            vault.touch();
            Ok(json!({ "ok": true, "username": entry.username, "password": password.as_str() }))
        }
        Request::Known { url, username, password } => {
            let host = page_host(url).ok_or("insecure")?;
            let same = same_login(vault, &host, username)?;
            let mut known = false;
            for id in &same.same_site {
                if vault.password(id)?.as_str() == password {
                    known = true;
                    break;
                }
            }
            Ok(json!({ "ok": true, "known": known, "update": same.exact.is_some() && !known }))
        }
        Request::Save { url, username, password } => {
            let host = page_host(url).ok_or("insecure")?;
            if password.is_empty() {
                return Err("empty".into());
            }
            let existing = same_login(vault, &host, username)?.exact;
            let input = match &existing {
                Some(id) => {
                    let e = vault.summaries()?.into_iter().find(|s| s.id == *id).ok_or("notFound")?;
                    EntryInput {
                        id: Some(id.clone()),
                        title: e.title,
                        username: e.username,
                        password: Some(password.clone()),
                        urls: e.urls,
                        apps: e.apps,
                        notes: e.notes,
                        favorite: e.favorite,
                        folder: e.folder,
                    }
                }
                None => EntryInput {
                    id: None,
                    title: host.trim_start_matches("www.").to_string(),
                    username: username.clone(),
                    password: Some(password.clone()),
                    urls: vec![format!("https://{host}")],
                    apps: Vec::new(),
                    notes: String::new(),
                    favorite: false,
                    folder: String::new(),
                },
            };
            vault.save(&input)?;
            vault.touch();
            Ok(json!({ "ok": true, "updated": existing.is_some() }))
        }
        Request::Status | Request::Open | Request::Generate => unreachable!("answered above"),
    });
    if matches!(request, Request::Save { .. }) && result.is_ok() {
        let _ = app.emit(super::CHANGED_EVENT, ());
    }
    result.unwrap_or_else(|error| json!({ "ok": false, "error": error }))
}

/// The logins saved with one user name for a page.
#[derive(Debug, Default, PartialEq)]
struct SameLogin {
    /// The one saved for this very host: the only one the page may change.
    exact: Option<String>,
    /// Every one on the same site (subdomains too); a typed password that
    /// any of them holds is already known.
    same_site: Vec<String>,
}

fn same_login(vault: &mut super::vault::Vault, host: &str, username: &str) -> Result<SameLogin, String> {
    let summaries = vault.summaries()?;
    Ok(same_login_in(
        summaries.iter().map(|e| (e.id.as_str(), e.username.as_str(), e.urls.as_slice())),
        host,
        username,
    ))
}

fn same_login_in<'a>(
    entries: impl IntoIterator<Item = (&'a str, &'a str, &'a [String])>,
    host: &str,
    username: &str,
) -> SameLogin {
    let wanted = username.trim();
    let mut found = SameLogin::default();
    let mut on_host = Vec::new();
    for (id, name, urls) in entries {
        // A password-change form often has no user name field: then any
        // login of the site may be the one.
        if !wanted.is_empty() && !name.eq_ignore_ascii_case(wanted) {
            continue;
        }
        if let Some(exact) = urls.iter().filter_map(|u| fits(u, host)).max() {
            if exact {
                on_host.push(id.to_string());
            }
            found.same_site.push(id.to_string());
        }
    }
    // Without a user name, only a host with a single login says which one.
    if !wanted.is_empty() || on_host.len() == 1 {
        found.exact = on_host.into_iter().next();
    }
    found
}

/// Brings the app forward on the Password Manager page.
pub fn open_vault(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    let _ = app.emit("myle-navigate", "password-manager");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_https_pages_and_this_pc_are_filled() {
        assert_eq!(page_host("https://Accounts.Google.com/signin?x=1").as_deref(), Some("accounts.google.com"));
        assert_eq!(page_host("http://localhost:5173/login").as_deref(), Some("localhost"));
        assert_eq!(page_host("http://example.com/login"), None);
        assert_eq!(page_host("file:///C:/login.html"), None);
        assert_eq!(page_host("https://user@evil.com@bank.com/"), Some("bank.com".into()));
    }

    #[test]
    fn a_login_fits_its_own_site_and_never_a_look_alike() {
        assert_eq!(fits("https://github.com/login", "github.com"), Some(true));
        assert_eq!(fits("github.com", "www.github.com"), Some(true));
        assert_eq!(fits("https://accounts.google.com", "mail.google.com"), Some(false));
        assert_eq!(fits("https://google.com", "google.com.evil.io"), None);
        assert_eq!(fits("https://bank.co.uk", "evil.co.uk"), None);
        assert_eq!(fits("https://mybank.co.uk", "login.mybank.co.uk"), Some(false));
    }

    #[test]
    fn native_messages_round_trip() {
        let mut buffer = Vec::new();
        write_message(&mut buffer, &json!({ "type": "status" })).unwrap();
        let mut reader = &buffer[..];
        assert_eq!(read_message(&mut reader).unwrap().unwrap()["type"], "status");
        assert!(read_message(&mut reader).unwrap().is_none());
        let too_big = (MAX_MESSAGE + 1).to_le_bytes();
        assert!(read_message(&mut &too_big[..]).is_err());
    }

    #[test]
    fn a_page_changes_only_the_login_saved_for_its_own_host() {
        let urls = |u: &str| vec![u.to_string()];
        let (main, shop, other) = (urls("https://example.com"), urls("https://shop.example.com"), urls("https://other.org"));
        let entries = [("main", "Alice", main.as_slice()), ("shop", "alice", shop.as_slice()), ("other", "alice", other.as_slice())];
        // On shop.example.com: its own login may change; example.com's only counts as known.
        let found = same_login_in(entries, "shop.example.com", " alice ");
        assert_eq!(found.exact.as_deref(), Some("shop"));
        assert_eq!(found.same_site, ["main", "shop"]);
        // A subdomain with no login of its own changes nothing.
        let found = same_login_in(entries, "evil.example.com", "alice");
        assert_eq!(found.exact, None);
        assert_eq!(found.same_site, ["main", "shop"]);
        assert_eq!(same_login_in(entries, "example.com", "bob"), SameLogin::default());
        // A password-change form without a user name: the host's only login.
        assert_eq!(same_login_in(entries, "shop.example.com", "").exact.as_deref(), Some("shop"));
        let (a, b) = (urls("https://two.example.com"), urls("https://two.example.com/login"));
        let two = [("a", "x", a.as_slice()), ("b", "y", b.as_slice())];
        assert_eq!(same_login_in(two, "two.example.com", "").exact, None, "which of the two is unclear");
    }

    #[test]
    fn a_script_cannot_ask_for_more_than_a_minutes_share() {
        let bucket = Mutex::new(VecDeque::new());
        for _ in 0..5 {
            assert!(allow(&bucket, 5));
        }
        assert!(!allow(&bucket, 5), "the sixth in the same minute is refused");
    }

    #[test]
    fn the_pipe_is_per_user_and_ours() {
        assert!(pipe_name().starts_with(r"\\.\pipe\myle-passwords-"));
        assert_eq!(pipe_name(), pipe_name());
    }
}
