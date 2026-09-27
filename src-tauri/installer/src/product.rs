//! Facts about the app being installed, read from its `tauri.conf.json` and
//! `package.json` by the build script.

/// "Make Your Life Easier": shortcut names, the "Installed apps" entry.
pub const NAME: &str = env!("MYLE_PRODUCT_NAME");
/// "MakeYourLifeEasier": the exe's stem and the Uninstall key's name.
pub const BINARY: &str = env!("MYLE_MAIN_BINARY");
/// The app's own data folders are named after it.
pub const IDENTIFIER: &str = env!("MYLE_IDENTIFIER");
pub const PUBLISHER: &str = env!("MYLE_PUBLISHER");
/// The version this setup installs (and the uninstaller shipped with).
pub const VERSION: &str = env!("MYLE_APP_VERSION");

pub const UNINSTALLER: &str = "uninstall.exe";
/// Written into the install folder: what this setup put there.
pub const INSTALL_MANIFEST: &str = "install.json";
/// Created by the app's Game Saves page; must go with the app.
pub const GAME_SAVES_TASK: &str = "MakeYourLifeEasier Game Saves Backup";

pub fn exe_name() -> String {
    format!("{BINARY}.exe")
}

pub fn uninstall_key() -> String {
    format!(r"Software\Microsoft\Windows\CurrentVersion\Uninstall\{BINARY}")
}

/// Where the install folder is remembered (the same key the NSIS setup used).
pub fn product_key() -> String {
    format!(r"Software\{PUBLISHER}\{BINARY}")
}

pub fn publisher_key() -> String {
    format!(r"Software\{PUBLISHER}")
}

/// Files an install made by the old NSIS setup has, which left no list.
pub fn legacy_files() -> Vec<String> {
    let mut files = vec![exe_name(), UNINSTALLER.to_string()];
    files.extend(
        env!("MYLE_RESOURCE_FILES")
            .split('|')
            .filter(|path| !path.is_empty())
            .map(str::to_string),
    );
    files
}
