<div align="center">

# 🛠️ Make Your Life Easier

### *Simplify Your Digital World*

[![Version](https://img.shields.io/badge/version-3.7.1-blue.svg?style=for-the-badge)](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases)
[![Electron](https://img.shields.io/badge/electron-38.7.2-47848f.svg?style=for-the-badge&logo=electron)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078d4.svg?style=for-the-badge&logo=windows)](https://www.microsoft.com/windows)

**All-in-one desktop app for Windows with password management (AES-256-GCM), system tools, and auto-updates.**

[📥 Download](#-installation) • [✨ Features](#-features) • [🚀 Quick Start](#-quick-start) • [💻 Development](#-development)

</div>

---

## 🌟 Highlights

🔐 **Military-Grade Security** • 🎨 **Modern UI** • 🌍 **Multi-Language** • 🔄 **Auto-Updates** • 🛡️ **Privacy First** • ⚡ **Lightning Fast**

---

## 📥 Installation

**Download:** [Installer](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest/download/MakeYourLifeEasier-installer.exe) • [Portable](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest/download/MakeYourLifeEasier-Portable.exe)

**Requirements:** Windows 10/11 (64-bit) • 4GB RAM • 200MB Storage

---

## ✨ Features

<details>
<summary><b>🔑 Password Manager</b></summary>

### Security Features
- **Encryption**: AES-256-GCM with random 128-bit IV per entry
- **Key Derivation**: scrypt (cost=2^14, blocksize=8)
- **Auto-Lock**: 30-minute inactivity timeout
- **Zero Knowledge**: Keys cleared from memory on logout

### Capabilities
- Organized categories (Email, Banking, Social, etc.)
- Quick search and filtering
- Secure clipboard with auto-clear
- Password strength indicator
- Master password protection
- No cloud sync - 100% local

</details>

<details>
<summary><b>🖥️ System Management Tools</b></summary>

- **Disk Cleanup** - Remove temporary files and free up space
- **SFC Scanner** - System File Checker with one click
- **DISM Repair** - Fix Windows corruption issues
- **Process Monitor** - View and manage running processes
- **Startup Manager** - Control boot applications
- **Registry Cleaner** - Safe registry optimization
- **Network Tools** - IP configuration and diagnostics

</details>

<details>
<summary><b>📦 Software Installation Hub</b></summary>

- Install popular software with one click
- Fast downloads from official sources
- Add custom software links
- Batch installation support
- Auto-launch installers after download
- Real-time progress tracking

**Included Apps:** Advanced Installer, Chrome, Firefox, 7-Zip, VLC, and more...

</details>

<details>
<summary><b>🎨 Customization Options</b></summary>

- Dark/Light theme toggle
- Custom Windows 11-style title bar
- Responsive design
- Smooth animations
- Language switching (EN/GR)
- Configurable auto-lock timer

</details>

<details>
<summary><b>🔄 Auto-Update System</b></summary>

- Background update checks
- Direct integration with GitHub releases
- Non-intrusive notifications
- Safe rollback mechanism
- Works in portable mode
- Optional manual update checks
- **New in v3.7.1:** Smooth progress bar • Enhanced error handling • Fixed window lifecycle

</details>

---

## 🚀 Quick Start

```
1. Download and run the app
2. Set master password (8+ chars, mixed case, number, special)
3. Add password entries and explore features
```

**Common Tasks:**
- **Search Password:** Password Manager → Search → Copy (auto-clears in 30s)
- **Clean System:** System Tools → Maintenance → Clean Temp Files
- **Install Apps:** Install Apps → Select → Download → Auto-launch
- **System Check:** System Tools → SFC Scan → Approve UAC

---

## 🏗️ Architecture

<details>
<summary><b>📂 Project Structure</b></summary>

```
Make_Your_Life_Easier.A.E/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.js       # Entry point
│   │   ├── updater.js     # Auto-update logic
│   │   ├── window-manager.js
│   │   └── ipc-handlers.js
│   ├── preload/           # IPC bridge
│   │   └── index.js
│   ├── renderer/          # Frontend UI
│   │   ├── index.html     # Main window
│   │   ├── core.js
│   │   ├── components.js
│   │   ├── styles/        # Main CSS
│   │   ├── info/          # Help/info window
│   │   ├── data/          # Renderer data files
│   │   └── services.js
│   ├── modules/           # Shared utilities
│   │   ├── file-utils.js
│   │   ├── download-manager.js
│   │   ├── system-tools.js
│   │   └── security.js
│   ├── updater/           # Update window
│   │   ├── update.html
│   │   └── updateRenderer.js
│   ├── i18n/              # Translations (en, gr)
│   ├── resources/         # Packaged helper binaries
│   └── assets/            # Icons & images
├── config/                # Tooling, installer, hooks, signing config
│   ├── hooks/
│   └── signing/           # Local certificate files (ignored)
└── package.json
```

</details>

<details>
<summary><b>🔧 Technology Stack</b></summary>

| Technology | Purpose | Version |
|-----------|---------|---------|
| **Electron** | Desktop framework | 38.7.2 |
| **electron-updater** | Auto-updates | 6.7.2 |
| **SQLite3** | Local database | 5.1.6 |
| **electron-store** | Settings persistence | 11.0.2 |
| **Node.js Crypto** | AES-256-GCM encryption | Native |
| **electron-sudo** | Elevated privileges | 4.0.12 |

</details>

---

## 🔒 Security

<details>
<summary><b>🔐 Encryption Details</b></summary>

### Password Manager Encryption

**Algorithm**: AES-256-GCM (Galois/Counter Mode)
- 256-bit encryption keys
- Random 128-bit IV per entry
- Authenticated encryption with GMAC

**Key Derivation Flow**:
```
Master Password
    ↓
scrypt (cost=2^14, blocksize=8)
    ↓
512-bit Derived Key
    ↓
HKDF-SHA256 (Key Expansion)
    ↓
256-bit Encryption Key + 256-bit Auth Key
```

**Protection Mechanisms**:
- Keys cleared from memory on logout
- 30-minute auto-lock
- No password storage (hash verification only)
- Secure random number generation
- Timing attack protection
- Clipboard auto-clear

</details>

<details>
<summary><b>🛡️ Privacy Guarantees</b></summary>

| Feature | Status |
|---------|--------|
| Telemetry | ❌ None |
| Analytics | ❌ None |
| Cloud Sync | ❌ Disabled |
| Ads | ❌ None |
| Open Source | ✅ Yes |
| Local Storage | ✅ 100% |

**Your data never leaves your device.**

</details>

---

## 💻 Development

<details>
<summary><b>🛠️ Setup Instructions</b></summary>

### Prerequisites
- Node.js 18+
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
npm start
```

### Build Commands
```bash
npm start              # Dev mode (no updater)
npm run build-portable # Create portable .exe
npm run build-installer # Create installer .exe
npm run build-all      # Build both versions
npm run publish        # Build + publish to GitHub
```

### Development Tips
- Press `Ctrl+R` for hot reload
- Press `F12` for DevTools
- Use `--no-updater` flag to skip update checks

</details>

---

## 📄 License & Author

**License:** Proprietary - see [LICENSE](LICENSE)

<div align="center">

**ThomasThanos**

[![GitHub](https://img.shields.io/badge/GitHub-thomasthanos-181717?style=for-the-badge&logo=github)](https://github.com/thomasthanos)
[![Email](https://img.shields.io/badge/Email-thomasthanos2@icloud.com-0078D4?style=for-the-badge&logo=microsoft-outlook)](mailto:thomasthanos2@icloud.com)

---

**Made with ❤️ for simplifying your digital life**

[⬆ Back to Top](#-make-your-life-easier)

</div>
