<div align="center">

# 🛠️ Make Your Life Easier

### *Simplify Your Digital World*

[![Version](https://img.shields.io/badge/version-4.2.8-blue.svg?style=for-the-badge)](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases)
[![Electron](https://img.shields.io/badge/electron-39.8.10-47848f.svg?style=for-the-badge&logo=electron)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078d4.svg?style=for-the-badge&logo=windows)](https://www.microsoft.com/windows)

**All-in-one desktop toolkit for Windows: a one-click app installer, deep system maintenance & debloat tools, Spicetify and Windows Utility integrations, optional cloud-synced preferences, and self-updating, code-signed releases.**

[📥 Download](#-installation) • [✨ Features](#-features) • [🚀 Quick Start](#-quick-start) • [💻 Development](#-development)

</div>

---

## 🌟 Highlights

📦 **One-Click App Installer** • 🧹 **System Maintenance & Debloat** • ☁️ **Optional Cloud-Synced Settings** • 🎨 **Modern UI** • 🌍 **Multi-Language** • 🔄 **Auto-Updates** • ✍️ **Code-Signed**

---

## 📥 Installation

**Download:** [Installer](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest/download/MakeYourLifeEasier-installer.exe) • [Portable](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest/download/MakeYourLifeEasier-Portable.exe)

**Requirements:** Windows 10/11 (64-bit) • 4GB RAM • 200MB Storage

> Installers are signed with an Authenticode certificate, so Windows SmartScreen shows a trusted publisher.

---

## ✨ Features

<details>
<summary><b>☁️ Account & Cloud-Synced Settings (Optional)</b></summary>

- Sign in with **Google** or **Discord** via Supabase Auth
- Syncs preferences (theme, language, selected app list, view/sort options) across devices
- Session cache is encrypted at rest using Electron's OS-level `safeStorage` API where available
- The app works fully **without** signing in — an account only adds cross-device sync

</details>

<details>
<summary><b>📦 App Installer Hub (winget-powered)</b></summary>

- Categorized catalog (Browsers, Communication, Games, Media, Development, Security, Hardware, Utilities…)
- **Check Installed** — scans installed & upgradable packages via `winget list` / `winget upgrade`
- Bulk actions: Install Selected, Uncheck All, Export list, Import list
- List/Grid view toggle and sorting (Category, A→Z, Z→A, Status)
- Automatic retry logic for failed installs (hash mismatch, permission, silent-mode fallbacks)
- Add your own custom app entries alongside the winget catalog

</details>

<details>
<summary><b>🖥️ System Maintenance Tools</b></summary>

**Cleanup:** Temp files, Recycle Bin, Windows Update cache, thumbnail cache, error reports, Disk Cleanup (`cleanmgr`)

**Network & Connectivity:** Flush DNS, Release/Renew IP, Fix Bluetooth, full Network Reset

**Repair & Diagnostics:** SFC scan, DISM repair, Check Disk, restart Audio services

**Tools:** One-click download & launch of [Patch My PC](https://patchmypc.com/) to keep third-party apps updated

</details>

<details>
<summary><b>🧹 Windows Debloat</b></summary>

- Launches the open-source **Sparkle** debloat utility to remove Windows bloatware
- Downloaded and extracted automatically on first use

</details>

<details>
<summary><b>⚙️ Windows Utility Integration</b></summary>

- One-click launcher for [Chris Titus Tech's WinUtil](https://github.com/ChrisTitusTech/winutil)
- System optimization, bloatware removal, privacy tweaks, and essential software installs
- Runs in an elevated PowerShell window with the official, signed script

</details>

<details>
<summary><b>🎵 Spicetify Integration</b></summary>

- Install / uninstall Spicetify themes and customizations for Spotify
- Full Spotify + Spicetify uninstall option

</details>

<details>
<summary><b>🔄 BIOS / UEFI Quick Restart</b></summary>

- One click to restart directly into BIOS/UEFI setup (requires admin rights)

</details>

<details>
<summary><b>🎨 Customization</b></summary>

- Dark/Light theme toggle
- Custom Windows 11-style title bar
- Responsive layout with list/grid views
- Language switching (EN/GR)

</details>

<details>
<summary><b>🔄 Auto-Update System</b></summary>

- Background update checks via `electron-updater`
- Update feed hosted on Cloudflare R2 (generic provider), independent of GitHub rate limits
- Non-intrusive notifications with detailed progress UI
- Works in portable mode too

</details>

---

## 🚀 Quick Start

```
1. Download and run the app
2. (Optional) Sign in with Google or Discord to sync your settings
3. Explore the sidebar: App Installer, System Maintenance, Debloat, BIOS, Spicetify, Windows Utility
```

**Common Tasks:**
- **Install Apps:** App Installer → search/select → Install Selected (or "Check Installed" first)
- **Clean System:** System Maintenance → Cleanup / Network / Repair & Diagnostics
- **Debloat Windows:** Debloat → Launch Sparkle Debloat
- **Deep Windows Tweaks:** Windows Utility → Launch Tool
- **BIOS Access:** BIOS → Restart to BIOS/UEFI → confirm

---

## 🏗️ Architecture

<details>
<summary><b>📂 Project Structure</b></summary>

```
Make_Your_Life_Easier.A.E/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.js           # Entry point
│   │   ├── window-manager.js
│   │   ├── ipc-handlers.js
│   │   ├── updater.js         # Auto-update logic
│   │   ├── update-info.js
│   │   ├── security.js
│   │   └── certificate.js
│   ├── preload/                # IPC bridge (context isolation)
│   ├── renderer/                # Frontend UI
│   │   ├── index.html
│   │   ├── index.js / core.js / components.js / managers.js / services.js / utils.js
│   │   ├── pages/               # installers.js, tools.js, media.js, utilities.js, activation.js
│   │   ├── styles/               # Main CSS
│   │   ├── data/                 # installer.json (winget app catalog)
│   │   └── info/                 # Help/info window
│   ├── modules/                  # Shared utilities
│   │   ├── supabase.js           # Cloud auth & settings sync client
│   │   ├── oauth.js               # Google/Discord OAuth flow
│   │   ├── user-profile.js        # Encrypted local session cache
│   │   ├── settings-store.js      # Local + cloud settings persistence
│   │   ├── system-tools.js
│   │   ├── download-manager.js
│   │   ├── archive-utils.js / file-utils.js / http-utils.js / process-utils.js
│   │   ├── sparkle.js             # Windows debloat utility
│   │   └── spicetify.js
│   ├── updater/                   # Update window UI
│   ├── i18n/                      # Translations (en, gr)
│   ├── public/                    # Static docs pages (readme/changelog/copyright)
│   ├── resources/                 # Packaged helper binaries (7-Zip, etc.)
│   └── assets/                    # Icons & images
├── config/                        # Tooling & build config
│   ├── hooks/                     # Git hooks
│   ├── signing/                   # Local certificate files (ignored)
│   ├── eslint.config.js / prettier.config.json
│   ├── installer.nsh              # NSIS installer customization
│   └── setup-hooks.js
└── package.json
```

</details>

<details>
<summary><b>🔧 Technology Stack</b></summary>

| Technology | Purpose | Version |
|-----------|---------|---------|
| **Electron** | Desktop framework | 39.8.10 |
| **electron-updater** | Auto-updates | 6.8.9 |
| **electron-builder** | Packaging & code signing | 26.15.3 |
| **@supabase/supabase-js** | Cloud auth & settings sync | 2.110.0 |
| **electron-log** | Structured logging | 5.4.4 |
| **dotenv** | Environment configuration | 17.4.2 |
| **Electron safeStorage** | Local credential encryption | Native |

</details>

---

## 🔒 Security & Privacy

<details>
<summary><b>🔐 How Your Data Is Handled</b></summary>

- **Optional account:** Google/Discord sign-in via Supabase Auth is only needed for cross-device settings sync — the app is fully usable signed out.
- **Encrypted session cache:** Local auth/session data is encrypted at rest with Electron's OS-level `safeStorage` API where available, with a safe fallback for older sessions.
- **Local-first tools:** System maintenance, the app installer, debloat, and utility integrations run entirely on your machine.
- **Hardened renderer:** Strict Content-Security-Policy, no inline scripts, context isolation via a dedicated preload bridge.
- **Signed releases:** Installers are Authenticode-signed in CI using a certificate stored in GitHub Secrets.

</details>

<details>
<summary><b>🛡️ Privacy Overview</b></summary>

| Feature | Status |
|---------|--------|
| Telemetry | ❌ None |
| Analytics | ❌ None |
| Ads | ❌ None |
| Cloud Sync | ☁️ Optional (account settings only) |
| Source Code | 👁️ View-only (Proprietary — see [LICENSE](LICENSE)) |

</details>

---

## 💻 Development

<details>
<summary><b>🛠️ Setup Instructions</b></summary>

### Prerequisites
- Node.js 22+
- npm
- Git
- Windows 10/11

### Installation
```bash
# Clone repository
git clone https://github.com/thomasthanos/Make_Your_Life_Easier.A.E.git

# Navigate to directory
cd Make_Your_Life_Easier.A.E

# Install dependencies
npm install

# Start development
npm run dev
```

### Build Commands
```bash
npm run dev        # Dev mode (no updater)
npm run build-all  # Build portable + installer (Windows)
npm run lint       # Run ESLint
```

Releases (signed installer, R2 update feed, GitHub Release) are produced by the `release.yml` GitHub Actions workflow on tag push.

### Development Tips
- Press `Ctrl+R` for hot reload
- Press `F12` for DevTools
- `npm run dev` skips update checks automatically

</details>

---

## 📄 License & Author

**License:** Proprietary — see [LICENSE](LICENSE)

<div align="center">

**ThomasThanos**

[![GitHub](https://img.shields.io/badge/GitHub-thomasthanos-181717?style=for-the-badge&logo=github)](https://github.com/thomasthanos)
[![Email](https://img.shields.io/badge/Email-thomasthanos2@icloud.com-0078D4?style=for-the-badge&logo=microsoft-outlook)](mailto:thomasthanos2@icloud.com)

---

**Made with ❤️ for simplifying your digital life**

[⬆ Back to Top](#-make-your-life-easier)

</div>
