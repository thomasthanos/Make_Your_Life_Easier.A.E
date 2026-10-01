/// Set the policy on WebView2 itself, before a newly created window is shown.
/// JavaScript event handlers alone cannot disable the native Inspect menu.
pub(crate) fn harden(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    #[cfg(windows)]
    {
        let guarded = window.clone();
        window.with_webview(move |webview| {
            // SAFETY: Tauri executes this callback on the webview's UI thread.
            let result = unsafe {
                webview.controller().CoreWebView2().and_then(|view| {
                    let settings = view.Settings()?;
                    settings.SetAreDefaultContextMenusEnabled(false)?;
                    settings.SetAreDevToolsEnabled(cfg!(debug_assertions))
                })
            };
            if let Err(error) = result {
                eprintln!("Could not configure the webview policy: {error}");
                // Do not leave a window running with the native menu enabled.
                let _ = guarded.destroy();
            }
        })?;
    }
    Ok(())
}
