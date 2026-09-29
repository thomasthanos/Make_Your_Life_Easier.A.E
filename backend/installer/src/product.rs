//! Facts about the app being installed, read from its `tauri.conf.json` and
//! `package.json` by the build script.

/// The visible Windows name and the executable stem.
pub const NAME: &str = env!("MYLE_PRODUCT_NAME");
pub const BINARY: &str = env!("MYLE_MAIN_BINARY");
/// Keep existing install/data/registry locations so an update does not strand them.
pub const LEGACY_NAME: &str = "Make Your Life Easier";
pub const LEGACY_BINARY: &str = "MakeYourLifeEasier";
/// The app's own data folders are named after it.
pub const IDENTIFIER: &str = env!("MYLE_IDENTIFIER");
pub const PUBLISHER: &str = env!("MYLE_PUBLISHER");
/// The version this setup installs (and the uninstaller shipped with).
pub const VERSION: &str = env!("MYLE_APP_VERSION");
/// The browser extension's download page: `myle.extensionUrl` in
/// package.json. Empty until the extension is published.
const EXTENSION_URL: &str = env!("MYLE_EXTENSION_URL");

/// The extension's page, when there is one (and it is https).
pub fn extension_url() -> Option<&'static str> {
    EXTENSION_URL.starts_with("https://").then_some(EXTENSION_URL)
}

pub const UNINSTALLER: &str = "uninstall.exe";
/// Written into the install folder: what this setup put there.
pub const INSTALL_MANIFEST: &str = "install.json";
/// Created by the app's Game Saves page; must go with the app.
pub const GAME_SAVES_TASK: &str = "MakeYourLifeEasier Game Saves Backup";

pub fn exe_name() -> String {
    format!("{BINARY}.exe")
}

pub fn legacy_exe_name() -> String {
    format!("{LEGACY_BINARY}.exe")
}

pub fn uninstall_key() -> String {
    format!(r"Software\Microsoft\Windows\CurrentVersion\Uninstall\{LEGACY_BINARY}")
}

/// Where the install folder is remembered (the same key the NSIS setup used).
pub fn product_key() -> String {
    format!(r"Software\{PUBLISHER}\{LEGACY_BINARY}")
}

pub fn publisher_key() -> String {
    format!(r"Software\{PUBLISHER}")
}

/// Files an install made by the old NSIS setup has, which left no list.
pub fn legacy_files() -> Vec<String> {
    let mut files = vec![exe_name(), legacy_exe_name(), UNINSTALLER.to_string()];
    files.extend(
        env!("MYLE_RESOURCE_FILES")
            .split('|')
            .filter(|path| !path.is_empty())
            .map(str::to_string),
    );
    files
}
