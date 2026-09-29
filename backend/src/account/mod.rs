//! Account: sign in with Discord or Google through Supabase Auth, and keep
//! this app's settings in the Supabase project the old app used.
//!
//! - Sign-in: the browser opens Supabase's authorize page (PKCE); a loopback
//!   server on `localhost:5252`, the redirect that project already allows,
//!   receives the code, which is exchanged for a session here.
//! - The session is kept encrypted with DPAPI (`vault`) and refreshed on use.
//! - Settings live in `user_settings.data` under their own key (`DATA_KEY`),
//!   next to whatever the old app stored there, which is left untouched.

mod oauth;
pub(crate) mod vault;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::{AppHandle, Manager, State};
use tokio::sync::Notify;

use crate::download::err;

const SUPABASE_URL: &str = "https://oofcywdbmhmqpowmwykz.supabase.co";
/// The project's public anon key. It is meant to ship inside apps: row-level
/// security limits every request to the signed-in user's own rows.
const SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZmN5d2RibWhtcXBvd213eWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDU5NTIsImV4cCI6MjA5ODU4MTk1Mn0.lu8JE-CfgcfPc3TaeDBFFu1nuwbihwtEgCr9wK0P9ps";
/// Allowed as a redirect URL in the Supabase project (used by the old app).
const REDIRECT_PORT: u16 = 5252;
const REDIRECT_URL: &str = "http://localhost:5252";
const TABLE: &str = "user_settings";
/// This app's settings inside the row's `data` object.
const DATA_KEY: &str = "v7";
const VAULT_FILE: &str = "account.bin";
const USER_AGENT: &str = "MakeYourLifeEasier-Account";
const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(5 * 60);
/// Refresh the access token when it has less than this left.
const REFRESH_MARGIN_SECS: u64 = 60;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Provider {
    Discord,
    Google,
}

impl Provider {
    fn id(self) -> &'static str {
        match self {
            Self::Discord => "discord",
            Self::Google => "google",
        }
    }
}

/// Who is signed in, as the Settings page shows it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub provider: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct Session {
    access_token: String,
    refresh_token: String,
    /// Unix seconds.
    expires_at: u64,
    profile: Profile,
}

#[derive(Default)]
struct Inner {
    session: Option<Session>,
    loaded: bool,
    signing_in: Option<Arc<Notify>>,
}

#[derive(Clone, Default)]
pub struct AccountState(Arc<Mutex<Inner>>);

impl AccountState {
    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.0.lock().unwrap_or_else(|p| p.into_inner())
    }

    /// The session from disk, read once per run.
    fn session(&self, app: &AppHandle) -> Option<Session> {
        let mut inner = self.lock();
        if !inner.loaded {
            inner.loaded = true;
            inner.session = vault_path(app)
                .ok()
                .and_then(|path| vault::load(&path))
                .and_then(|bytes| serde_json::from_slice(&bytes).ok());
        }
        inner.session.clone()
    }

    fn store(&self, app: &AppHandle, session: Option<Session>) -> Result<(), String> {
        let path = vault_path(app)?;
        match &session {
            Some(session) => vault::save(&path, &serde_json::to_vec(session).map_err(err)?)?,
            None => vault::remove(&path),
        }
        let mut inner = self.lock();
        inner.session = session;
        inner.loaded = true;
        Ok(())
    }
}

fn vault_path(app: &AppHandle) -> Result<PathBuf, String> {
    let _ = app;
    Ok(crate::storage::roaming_dir()?.join(VAULT_FILE))
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn client() -> Result<reqwest::Client, String> {
    crate::download::http_client(USER_AGENT)
}

/// A signed-in connection to the app's other tables (the Password
/// Manager's), with the same token and row security as the settings.
pub(crate) struct Cloud {
    pub user_id: String,
    token: String,
    client: reqwest::Client,
}

impl Cloud {
    /// `rest/v1/<path>` with `query` parameters.
    pub fn url(&self, path: &str, query: &[(&str, String)]) -> Result<reqwest::Url, String> {
        reqwest::Url::parse_with_params(&format!("{SUPABASE_URL}/rest/v1/{path}"), query).map_err(err)
    }

    pub fn request(&self, method: reqwest::Method, url: reqwest::Url) -> reqwest::RequestBuilder {
        self.client
            .request(method, url)
            .header("apikey", SUPABASE_ANON_KEY)
            .bearer_auth(&self.token)
            .timeout(Duration::from_secs(20))
    }
}

/// `None` when nobody is signed in.
pub(crate) async fn cloud(app: &AppHandle) -> Result<Option<Cloud>, String> {
    let state = app.state::<AccountState>();
    if state.session(app).is_none() {
        return Ok(None);
    }
    let session = fresh_session(app, &state).await?;
    Ok(Some(Cloud {
        user_id: session.profile.id,
        token: session.access_token,
        client: client()?,
    }))
}

// ---------------------------------------------------------------------------
// Commands

/// The signed-in profile, if any. Reads the saved session; no network.
#[tauri::command(async)]
pub fn account_profile(app: AppHandle, state: State<'_, AccountState>) -> Option<Profile> {
    state.session(&app).map(|session| session.profile)
}

/// Signs in with the provider in the browser and returns who signed in.
#[tauri::command]
pub async fn account_sign_in(
    app: AppHandle,
    state: State<'_, AccountState>,
    provider: Provider,
) -> Result<Profile, String> {
    let cancel = Arc::new(Notify::new());
    {
        let mut inner = state.lock();
        if inner.signing_in.is_some() {
            return Err("A sign-in is already waiting for the browser.".into());
        }
        inner.signing_in = Some(cancel.clone());
    }
    let result = sign_in(provider, &cancel).await;
    state.lock().signing_in = None;
    let session = result?;
    let profile = session.profile.clone();
    state.store(&app, Some(session))?;
    // The browser has the focus now; bring the app back.
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(profile)
}

/// Stops waiting for the browser (the user closed the tab, changed their mind).
#[tauri::command]
pub fn account_cancel_sign_in(state: State<'_, AccountState>) {
    if let Some(cancel) = state.lock().signing_in.take() {
        cancel.notify_one();
    }
}

#[tauri::command]
pub async fn account_sign_out(app: AppHandle, state: State<'_, AccountState>) -> Result<(), String> {
    if let Some(session) = state.session(&app) {
        // Revokes the refresh token; the local sign-out happens regardless.
        let _ = client()?
            .post(format!("{SUPABASE_URL}/auth/v1/logout"))
            .header("apikey", SUPABASE_ANON_KEY)
            .bearer_auth(&session.access_token)
            .timeout(Duration::from_secs(8))
            .send()
            .await;
    }
    state.store(&app, None)
}

/// This app's settings from the cloud, or `None` when none are saved yet.
#[tauri::command]
pub async fn account_pull(
    app: AppHandle,
    state: State<'_, AccountState>,
) -> Result<Option<Value>, String> {
    let session = fresh_session(&app, &state).await?;
    let row = read_row(&session).await?;
    Ok(row.and_then(|data| data.get(DATA_KEY).cloned()))
}

/// Saves this app's settings to the cloud, keeping the rest of the row.
#[tauri::command]
pub async fn account_push(
    app: AppHandle,
    state: State<'_, AccountState>,
    settings: Value,
) -> Result<(), String> {
    if !settings.is_object() {
        return Err("Settings must be an object.".into());
    }
    let session = fresh_session(&app, &state).await?;
    let mut data = match read_row(&session).await? {
        Some(Value::Object(map)) => map,
        _ => Map::new(),
    };
    data.insert(DATA_KEY.into(), settings);
    let body = serde_json::json!({
        "user_id": session.profile.id,
        "data": data,
        "updated_at": iso8601(now()),
    });
    client()?
        .post(format!("{SUPABASE_URL}/rest/v1/{TABLE}?on_conflict=user_id"))
        .header("apikey", SUPABASE_ANON_KEY)
        .bearer_auth(&session.access_token)
        .header("Prefer", "resolution=merge-duplicates,return=minimal")
        .json(&body)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(err)?
        .error_for_status()
        .map_err(|e| format!("The cloud did not accept the settings: {e}"))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Sign-in

async fn sign_in(provider: Provider, cancel: &Notify) -> Result<Session, String> {
    // Listen before the browser opens, so the redirect cannot arrive first.
    let loopback = oauth::Loopback::bind(REDIRECT_PORT).await?;
    let (verifier, challenge) = oauth::pkce_pair();
    let authorize = reqwest::Url::parse_with_params(
        &format!("{SUPABASE_URL}/auth/v1/authorize"),
        &[
            ("provider", provider.id()),
            ("redirect_to", REDIRECT_URL),
            ("code_challenge", challenge.as_str()),
            ("code_challenge_method", "s256"),
        ],
    )
    .map_err(err)?;
    tauri_plugin_opener::open_url(authorize.as_str(), None::<&str>).map_err(err)?;

    let callback = tokio::select! {
        callback = loopback.next_callback() => callback,
        _ = cancel.notified() => return Err("Sign-in was cancelled.".into()),
        _ = tokio::time::sleep(SIGN_IN_TIMEOUT) => {
            return Err("Sign-in timed out. Try again.".into());
        }
    };
    let code = match callback {
        oauth::Callback::Code(code) => code,
        oauth::Callback::Error(message) => return Err(message),
    };
    token_request(
        "pkce",
        serde_json::json!({ "auth_code": code, "code_verifier": verifier }),
    )
    .await
    .map_err(String::from)
}

/// A session with at least a minute left, refreshed (and saved) if needed.
async fn fresh_session(app: &AppHandle, state: &AccountState) -> Result<Session, String> {
    let session = state.session(app).ok_or("You are not signed in.")?;
    if session.expires_at > now() + REFRESH_MARGIN_SECS {
        return Ok(session);
    }
    match token_request(
        "refresh_token",
        serde_json::json!({ "refresh_token": session.refresh_token }),
    )
    .await
    {
        Ok(fresh) => {
            state.store(app, Some(fresh.clone()))?;
            Ok(fresh)
        }
        Err(TokenError::Rejected(_)) => {
            // Revoked, or expired after long disuse: sign out cleanly.
            state.store(app, None)?;
            Err("Your session has expired. Sign in again.".into())
        }
        Err(TokenError::Network(e)) => Err(e),
    }
}

enum TokenError {
    /// Supabase answered and refused (4xx): the token is no good.
    Rejected(String),
    Network(String),
}

impl From<TokenError> for String {
    fn from(error: TokenError) -> Self {
        match error {
            TokenError::Rejected(e) | TokenError::Network(e) => e,
        }
    }
}

async fn token_request(grant: &str, body: Value) -> Result<Session, TokenError> {
    let response = client()
        .map_err(TokenError::Network)?
        .post(format!("{SUPABASE_URL}/auth/v1/token?grant_type={grant}"))
        .header("apikey", SUPABASE_ANON_KEY)
        .json(&body)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| TokenError::Network(e.to_string()))?;
    let status = response.status();
    // Busy or slow, not a verdict on the token: signing out over it would
    // throw away a perfectly good session.
    if matches!(
        status,
        reqwest::StatusCode::TOO_MANY_REQUESTS | reqwest::StatusCode::REQUEST_TIMEOUT
    ) {
        return Err(TokenError::Network(format!(
            "Supabase is busy ({status}). Try again in a moment."
        )));
    }
    let json: Value = response
        .json()
        .await
        .map_err(|e| TokenError::Network(e.to_string()))?;
    if status.is_client_error() {
        let message = json
            .get("error_description")
            .or_else(|| json.get("msg"))
            .or_else(|| json.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("Supabase refused the sign-in.");
        return Err(TokenError::Rejected(message.to_string()));
    }
    if !status.is_success() {
        return Err(TokenError::Network(format!("Supabase answered {status}")));
    }
    session_from(&json).ok_or_else(|| TokenError::Network("Supabase sent an incomplete session.".into()))
}

fn session_from(json: &Value) -> Option<Session> {
    let text = |value: Option<&Value>| value.and_then(Value::as_str).map(str::to_string);
    let user = json.get("user")?;
    let meta = user.get("user_metadata");
    let meta_text = |key: &str| text(meta.and_then(|m| m.get(key)));
    let expires_at = json
        .get("expires_at")
        .and_then(Value::as_u64)
        .unwrap_or_else(|| now() + json.get("expires_in").and_then(Value::as_u64).unwrap_or(3600));
    Some(Session {
        access_token: text(json.get("access_token"))?,
        refresh_token: text(json.get("refresh_token"))?,
        expires_at,
        profile: Profile {
            id: text(user.get("id"))?,
            name: meta_text("full_name")
                .or_else(|| meta_text("name"))
                .or_else(|| meta_text("user_name")),
            email: text(user.get("email")).filter(|e| !e.is_empty()),
            avatar_url: meta_text("avatar_url").or_else(|| meta_text("picture")),
            provider: text(user.get("app_metadata").and_then(|m| m.get("provider"))),
        },
    })
}

// ---------------------------------------------------------------------------
// user_settings

/// The row's whole `data` object, or `None` when the user has no row yet.
async fn read_row(session: &Session) -> Result<Option<Value>, String> {
    let url = reqwest::Url::parse_with_params(
        &format!("{SUPABASE_URL}/rest/v1/{TABLE}"),
        &[
            ("select", "data".to_string()),
            ("user_id", format!("eq.{}", session.profile.id)),
        ],
    )
    .map_err(err)?;
    let rows: Vec<Value> = client()?
        .get(url)
        .header("apikey", SUPABASE_ANON_KEY)
        .bearer_auth(&session.access_token)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(err)?
        .error_for_status()
        .map_err(|e| format!("The cloud settings could not be read: {e}"))?
        .json()
        .await
        .map_err(err)?;
    Ok(rows
        .into_iter()
        .next()
        .and_then(|mut row| row.get_mut("data").map(Value::take)))
}

/// `2026-09-27T12:34:56Z` from Unix seconds (UTC), for `updated_at`.
fn iso8601(seconds: u64) -> String {
    let days = (seconds / 86_400) as i64;
    let rest = seconds % 86_400;
    // Civil date from days since 1970-01-01 (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        rest / 3600,
        rest % 3600 / 60,
        rest % 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamps_are_iso_8601_utc() {
        assert_eq!(iso8601(0), "1970-01-01T00:00:00Z");
        assert_eq!(iso8601(951_782_400), "2000-02-29T00:00:00Z");
        assert_eq!(iso8601(1_790_462_096), "2026-09-26T22:34:56Z");
    }

    #[test]
    fn a_discord_session_becomes_a_profile() {
        let json = serde_json::json!({
            "access_token": "a", "refresh_token": "r", "expires_in": 3600, "expires_at": 2_000_000_000u64,
            "user": {
                "id": "uuid-1", "email": "me@example.com",
                "app_metadata": { "provider": "discord" },
                "user_metadata": { "full_name": "Thomas", "avatar_url": "https://cdn.discordapp.com/a.png" }
            }
        });
        let session = session_from(&json).unwrap();
        assert_eq!(session.expires_at, 2_000_000_000);
        assert_eq!(session.profile.name.as_deref(), Some("Thomas"));
        assert_eq!(session.profile.provider.as_deref(), Some("discord"));
        assert!(session_from(&serde_json::json!({ "access_token": "a" })).is_none());
    }

    #[test]
    fn providers_come_from_the_page_as_camel_case() {
        let provider: Provider = serde_json::from_str("\"google\"").unwrap();
        assert_eq!(provider.id(), "google");
        assert!(serde_json::from_str::<Provider>("\"github\"").is_err());
    }
}
