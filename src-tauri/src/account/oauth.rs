//! Sign-in in the user's own browser (RFC 8252): PKCE plus a one-shot
//! loopback server that receives Supabase's redirect.
//!
//! The browser, not a webview, shows the provider's page: Google refuses
//! embedded browsers, and the user is usually signed in there already.

use base64::Engine;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use uuid::Uuid;

/// What came back from the provider on the redirect.
#[derive(Debug, PartialEq)]
pub enum Callback {
    Code(String),
    Error(String),
}

/// A random PKCE verifier and its S256 challenge.
pub fn pkce_pair() -> (String, String) {
    // Two v4 UUIDs: 64 characters and 244 random bits, within the 43-128
    // characters RFC 7636 allows.
    let verifier = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(Sha256::digest(verifier.as_bytes()));
    (verifier, challenge)
}

/// Listens on `localhost:<port>`, both IPv4 and IPv6: browsers try either.
pub struct Loopback {
    v4: TcpListener,
    v6: Option<TcpListener>,
}

impl Loopback {
    pub async fn bind(port: u16) -> Result<Self, String> {
        let v4 = TcpListener::bind(("127.0.0.1", port)).await.map_err(|e| {
            format!("Sign-in needs port {port} on this PC, but it is in use ({e}). Close the program using it and try again.")
        })?;
        let v6 = TcpListener::bind(("::1", port)).await.ok();
        Ok(Self { v4, v6 })
    }

    /// Answers requests until one carries a code or an error. Anything else
    /// (a favicon, a stray visit) gets a 404 and is ignored.
    pub async fn next_callback(&self) -> Callback {
        loop {
            let accepted = match &self.v6 {
                Some(v6) => tokio::select! {
                    r = self.v4.accept() => r,
                    r = v6.accept() => r,
                },
                None => self.v4.accept().await,
            };
            let Ok((mut stream, _)) = accepted else {
                continue;
            };
            let Some(target) = read_request_target(&mut stream).await else {
                continue;
            };
            match parse_callback(&target) {
                Some(Callback::Code(code)) => {
                    respond(&mut stream, 200, &page(true, "")).await;
                    return Callback::Code(code);
                }
                Some(Callback::Error(message)) => {
                    respond(&mut stream, 200, &page(false, &message)).await;
                    return Callback::Error(message);
                }
                None => respond(&mut stream, 404, "").await,
            }
        }
    }
}

/// `/?code=…` or `/?error=…&error_description=…` from the request target.
pub fn parse_callback(target: &str) -> Option<Callback> {
    let url = reqwest::Url::parse(&format!("http://localhost{target}")).ok()?;
    if url.path() != "/" {
        return None;
    }
    let mut code = None;
    let mut error = None;
    let mut description = None;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "code" if !value.is_empty() => code = Some(value.into_owned()),
            "error" => error = Some(value.into_owned()),
            "error_description" => description = Some(value.into_owned()),
            _ => {}
        }
    }
    if let Some(message) = description.or(error) {
        return Some(Callback::Error(message));
    }
    code.map(Callback::Code)
}

async fn read_request_target(stream: &mut TcpStream) -> Option<String> {
    let mut request = Vec::new();
    let mut buffer = [0u8; 2048];
    while !request.windows(4).any(|w| w == b"\r\n\r\n") {
        let read = tokio::time::timeout(std::time::Duration::from_secs(5), stream.read(&mut buffer))
            .await
            .ok()?
            .ok()?;
        if read == 0 || request.len() > 16 * 1024 {
            return None;
        }
        request.extend_from_slice(&buffer[..read]);
    }
    let line = String::from_utf8_lossy(&request);
    let mut parts = line.lines().next()?.split_whitespace();
    (parts.next()? == "GET").then(|| parts.next().map(str::to_string))?
}

async fn respond(stream: &mut TcpStream, status: u16, body: &str) {
    let reason = if status == 200 { "OK" } else { "Not Found" };
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.shutdown().await;
}

/// The page left in the browser tab after the redirect.
fn page(ok: bool, message: &str) -> String {
    let (title, text) = if ok {
        (
            "You're signed in",
            "You can close this tab and go back to Make Your Life Easier.".to_string(),
        )
    } else {
        ("Sign-in didn't finish", escape(message))
    };
    let accent = if ok { "#8b97ff" } else { "#ff8b8d" };
    format!(
        r#"<!doctype html><html><head><meta charset="utf-8"><title>{title}</title>
<style>
html,body{{height:100%;margin:0}}
body{{display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,#1b2040,#0a0c12 70%);color:#e8eaf6;font:15px/1.5 "Segoe UI",system-ui,sans-serif}}
.card{{max-width:420px;padding:32px 36px;border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(255,255,255,.05);box-shadow:0 24px 60px -24px rgba(0,0,0,.8);text-align:center}}
h1{{margin:0 0 8px;font-size:20px;color:{accent}}}
p{{margin:0;color:#aab0c8}}
</style></head><body><div class="card"><h1>{title}</h1><p>{text}</p></div></body></html>"#
    )
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_challenge_is_the_s256_of_the_verifier() {
        let (verifier, challenge) = pkce_pair();
        assert_eq!(verifier.len(), 64);
        assert!(verifier.chars().all(|c| c.is_ascii_hexdigit()));
        let expected = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(Sha256::digest(verifier.as_bytes()));
        assert_eq!(challenge, expected);
        assert_ne!(pkce_pair().0, verifier);
    }

    #[test]
    fn redirects_are_read_for_a_code_or_an_error() {
        assert_eq!(
            parse_callback("/?code=abc-123"),
            Some(Callback::Code("abc-123".into()))
        );
        assert_eq!(
            parse_callback("/?error=access_denied&error_description=The+user+cancelled"),
            Some(Callback::Error("The user cancelled".into()))
        );
        assert_eq!(parse_callback("/favicon.ico"), None);
        assert_eq!(parse_callback("/"), None);
    }

    #[test]
    fn error_text_cannot_inject_markup() {
        assert!(!page(false, "<script>x</script>").contains("<script>x"));
    }

    #[tokio::test]
    async fn the_loopback_server_hands_over_the_code_and_answers_the_browser() {
        let server = Loopback::bind(0).await;
        // Port 0 picks a free port, but only the IPv4 socket knows it.
        let server = server.unwrap();
        let port = server.v4.local_addr().unwrap().port();
        let browser = tokio::spawn(async move {
            let mut stream = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
            stream
                .write_all(b"GET /?code=xyz HTTP/1.1\r\nHost: localhost\r\n\r\n")
                .await
                .unwrap();
            let mut reply = String::new();
            stream.read_to_string(&mut reply).await.unwrap();
            reply
        });
        assert_eq!(server.next_callback().await, Callback::Code("xyz".into()));
        let reply = browser.await.unwrap();
        assert!(reply.starts_with("HTTP/1.1 200"));
        assert!(reply.contains("signed in"));
    }
}
