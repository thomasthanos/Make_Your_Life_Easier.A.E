<div align="center">

# 🛠️ Make Your Life Easier

### *Simplify Your Digital World*

[![Version](https://img.shields.io/badge/version-3.7.1-blue.svg?style=for-the-badge)](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases)
[![Electron](https://img.shields.io/badge/electron-38.7.2-47848f.svg?style=for-the-badge&logo=electron)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078d4.svg?style=for-the-badge&logo=windows)](https://www.microsoft.com/windows)

**A powerful all-in-one desktop application for Windows system management, software installation, and secure password management with military-grade encryption.**

[📥 Download](#-installation) • [✨ Features](#-features) • [🚀 Quick Start](#-quick-start) • [💻 Development](#-development)

</div>

---

## 🌟 Why Choose This App?

- 🔐 **Military-Grade Security** - AES-256-GCM password manager
- 🎨 **Modern UI** - Beautiful dark/light theme
- 🌍 **Multi-Language** - English & Greek support
- 🔄 **Auto-Updates** - Seamless GitHub releases integration
- 🛡️ **Privacy First** - No telemetry, 100% local storage
- ⚡ **Lightning Fast** - Native desktop performance

---

## 📥 Installation

**Download the latest release:**
- [📦 Installer (.exe)](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest/download/MakeYourLifeEasier-installer.exe) - Full installation with shortcuts
- [🚀 Portable (.exe)](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest/download/MakeYourLifeEasier-Portable.exe) - No installation required

**System Requirements:** Windows 10/11 (64-bit) • 4GB RAM • 200MB Storage

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
- ✅ Organized categories (Email, Banking, Social, etc.)
- ✅ Quick search and filtering
- ✅ Secure clipboard with auto-clear
- ✅ Password strength indicator
- ✅ Master password protection
- ✅ No cloud sync - 100% local

### Master Password Requirements
- Minimum 8 characters
- Must include: uppercase, lowercase, number, special character
- ⚠️ **Cannot be recovered** - store safely!

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
- **New in v3.7.1:** Smooth progress bar animations
- **New in v3.7.1:** Enhanced error handling & retry logic
- **New in v3.7.1:** Fixed window lifecycle management

</details>

---

## 🚀 Quick Start

### First Launch

```
1. Download and run the app
2. Set your master password (8+ chars, mixed case, number, special)
3. Add your first password entry
4. Explore system tools and software installer
```

<details>
<summary><b>Common Tasks - Click to expand</b></summary>

### Search & Copy Passwords
```
Password Manager → Search → Click copy icon → Auto-clears in 30s
```

### Clean System
```
System Tools → Maintenance → Clean Temp Files → Approve UAC
```

### Install Multiple Apps
```
Install Apps → Check desired apps → Download Selected → Auto-launch
```

### System File Check
```
System Tools → SFC Scan → Approve UAC → Wait for completion
```

</details>

---

## 🏗️ Project Structure

<details>
<summary><b>📂 Directory Structure - Click to expand</b></summary>

```
Make_Your_Life_Easier.A.E/
├── 📂 src/
│   ├── 📂 modules/           # Core functionality
│   │   ├── auto-updater.js
│   │   ├── file-utils.js
│   │   ├── download-manager.js
│   │   ├── system-tools.js
│   │   └── user-profile.js
│   ├── 📂 styles/            # Modular CSS
│   └── 📂 assets/            # Icons & images
├── 📂 password-manager/      # Encrypted storage
│   ├── auth.js              # AES-256-GCM
│   └── database.js          # SQLite
├── 📂 lang/                 # i18n (en, gr)
├── main.js                  # Electron main
├── renderer.js              # Frontend logic
├── preload.js               # IPC bridge
└── package.json
```

</details>

<details>
<summary><b>🔧 Technology Stack - Click to expand</b></summary>

| Technology | Purpose | Version |
|-----------|---------|---------|
| Electron | Desktop framework | 38.7.2 |
| electron-updater | Auto-updates | 6.1.7 |
| SQLite3 | Local database | 5.1.6 |
| electron-store | Settings | 8.1.0 |
| Node.js Crypto | AES-256-GCM | Native |

</details>

---

## 🔒 Security

<details>
<summary><b>🔐 Encryption Details - Click to expand</b></summary>

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
- ✅ Keys cleared from memory on logout
- ✅ 30-minute auto-lock
- ✅ No password storage (hash verification only)
- ✅ Secure random number generation
- ✅ Timing attack protection
- ✅ Clipboard auto-clear

</details>

<details>
<summary><b>🛡️ Privacy Guarantees - Click to expand</b></summary>

| Feature | Status |
|---------|--------|
| Telemetry | ❌ None |
| Analytics | ❌ None |
| Cloud Sync | ❌ Disabled |
| Ads | ❌ None |
| Open Source | ✅ Yes |
| Local Storage | ✅ 100% |
| Data Collection | ❌ Zero |

**Your data never leaves your device.**

</details>

---

## 💻 Development

<details>
<summary><b>🛠️ Setup Instructions - Click to expand</b></summary>

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

## 🤝 Contributing

<details>
<summary><b>📝 How to Contribute - Click to expand</b></summary>

We welcome contributions! Here's how:

### Ways to Help
- 🐛 Report bugs with reproduction steps
- 💡 Suggest features in discussions
- 📝 Improve documentation
- 🌍 Add translations
- 💻 Submit pull requests

### Pull Request Process
1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Guidelines
- Follow existing code style
- Comment complex logic
- Test thoroughly
- Update docs if needed

</details>

---

## ❓ FAQ

<details>
<summary><b>Can I recover my master password if I forget it?</b></summary>

No, the master password uses one-way hashing. If forgotten, you must reset the password manager (deletes all passwords). Keep it safe!
</details>

<details>
<summary><b>Is my data synced to the cloud?</b></summary>

No, everything is stored locally. Zero cloud sync = your data never leaves your computer.
</details>

<details>
<summary><b>How do updates work?</b></summary>

Automatic checks on launch. Updates download in background and install on restart. Non-intrusive notifications.
</details>

<details>
<summary><b>Why does it need administrator privileges?</b></summary>

Only for system maintenance tools (SFC, temp cleanup). Password manager works without admin rights.
</details>

<details>
<summary><b>How can I add custom software?</b></summary>

Modify the `CUSTOM_APPS` array in `renderer.js`. Add name, URL, extension, and category.
</details>

---

## 🗺️ Roadmap

<details>
<summary><b>📅 Future Plans - Click to expand</b></summary>

### Version 3.3.0 (Planned)
- [ ] Encrypted notes feature
- [ ] Password strength analyzer
- [ ] Backup/restore functionality
- [ ] Browser extension integration
- [ ] Two-factor authentication

### Version 4.0.0 (Future)
- [ ] Optional encrypted cloud sync
- [ ] Advanced password generator
- [ ] Plugin system
- [ ] Enhanced system diagnostics

### Completed ✅
- [x] AES-256-GCM encryption
- [x] Auto-update system
- [x] Multi-language support
- [x] Dark/light themes
- [x] System maintenance tools
- [x] Fixed progress bar rendering (v3.7.1)
- [x] Enhanced updater reliability (v3.7.1)
- [x] Improved error handling (v3.7.1)

</details>

---

## 📊 Stats

<div align="center">

![GitHub release](https://img.shields.io/github/v/release/thomasthanos/Make_Your_Life_Easier.A.E?style=for-the-badge)
![GitHub downloads](https://img.shields.io/github/downloads/thomasthanos/Make_Your_Life_Easier.A.E/total?style=for-the-badge)
![GitHub stars](https://img.shields.io/github/stars/thomasthanos/Make_Your_Life_Easier.A.E?style=for-the-badge)
![GitHub last commit](https://img.shields.io/github/last-commit/thomasthanos/Make_Your_Life_Easier.A.E?style=for-the-badge)

</div>

---

## 📄 License

Licensed under **Proprietary License** - see [LICENSE](LICENSE) file for details.

---

## 👤 Author

<div align="center">

**ThomasThanos**

[![GitHub](https://img.shields.io/badge/GitHub-thomasthanos-181717?style=for-the-badge&logo=github)](https://github.com/thomasthanos)
[![Email](https://img.shields.io/badge/Email-thomasthanos2@icloud.com-0078D4?style=for-the-badge&logo=microsoft-outlook)](mailto:thomasthanos2@icloud.com)

---

**Made with ❤️ for simplifying your digital life**

[⬆ Back to Top](#-make-your-life-easier)

</div>
