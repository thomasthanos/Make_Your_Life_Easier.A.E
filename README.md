<div align="center">

# 🛠️ Make Your Life Easier

### *Simplify Your Digital World*

[![Version](https://img.shields.io/badge/version-3.2.8-blue.svg?style=for-the-badge)](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases)
[![Electron](https://img.shields.io/badge/electron-38.7.2-47848f.svg?style=for-the-badge&logo=electron)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078d4.svg?style=for-the-badge&logo=windows)](https://www.microsoft.com/windows)

**A powerful all-in-one desktop application for Windows system management, software installation, and secure password management with military-grade encryption.**

[📥 Download](#-installation) • [✨ Features](#-features) • [📚 Documentation](#-usage) • [🚀 Quick Start](#-quick-start)

![Main Interface](https://via.placeholder.com/800x450/1a1a2e/ffffff?text=Make+Your+Life+Easier+Screenshot)

</div>

---

## 🌟 Highlights

- 🔐 **Military-Grade Encryption** - AES-256-GCM password manager with scrypt key derivation
- 🎨 **Modern UI** - Beautiful dark/light theme with smooth animations
- 🌍 **Multi-Language** - English and Greek support
- 🔄 **Auto-Updates** - Seamless background updates with GitHub releases
- ⚡ **Lightning Fast** - Built on Electron for native desktop performance
- 🛡️ **Privacy First** - No telemetry, all data stored locally
- 🎯 **One-Click Actions** - Automate system maintenance tasks
- 📦 **Software Hub** - Install popular apps with a single click

---

## ✨ Features

### 🔑 Password Manager
- **Bank-Level Security**: AES-256-GCM encryption with 128-bit random IV
- **Smart Key Derivation**: scrypt algorithm (cost=2^14, blocksize=8)
- **Auto-Lock**: Automatic session timeout after 30 minutes
- **Organized Storage**: Categorize passwords by type (Email, Banking, Social, etc.)
- **Quick Search**: Instantly find any credential
- **Copy Protection**: Clipboard auto-clear for sensitive data
- **Master Password**: Single password to access all credentials
- **Zero Cloud**: Everything stays on your device

### 🖥️ System Management
- **Disk Cleanup**: Remove temporary files and free up space
- **SFC Scanner**: System File Checker with one click
- **DISM Repair**: Fix Windows corruption issues
- **Process Monitor**: View and manage running processes
- **Startup Manager**: Control which apps launch at boot
- **Registry Cleaner**: Safely clean registry entries
- **Network Tools**: IP configuration and network diagnostics

### 📦 Software Installation Hub
- **Curated Apps**: Install popular software instantly
- **Direct Downloads**: Fast downloads from official sources
- **Custom Apps**: Add your own software links
- **Batch Install**: Select multiple apps to install at once
- **Auto-Launch**: Installers open automatically after download
- **Progress Tracking**: Real-time download progress

### 🎨 Customization
- **Dark/Light Themes**: Easy theme switching
- **Custom Title Bar**: Native Windows 11-style chrome
- **Responsive Design**: Adapts to any window size
- **Smooth Animations**: Polished user experience
- **Language Toggle**: Switch between English and Greek

### 🔄 Auto-Update System
- **Background Updates**: Check for updates automatically
- **GitHub Integration**: Direct updates from releases
- **Smart Notifications**: Non-intrusive update alerts
- **Portable Support**: Updates work in portable mode
- **Rollback Protection**: Safe update mechanism

---

## 📥 Installation

### Quick Install (Recommended)

1. **Download** the latest release:
   - [📦 Installer (.exe)](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest/download/MakeYourLifeEasier-installer.exe) - Full installation with shortcuts
   - [🚀 Portable (.exe)](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest/download/MakeYourLifeEasier-Portable.exe) - No installation required

2. **Run** the downloaded file
3. **Launch** and start simplifying your life!

### System Requirements

- **OS**: Windows 10/11 (64-bit)
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 200MB free space
- **Internet**: Required for initial download and updates

---

## 🚀 Quick Start

### First Launch

1. **Set Your Master Password**
   - Click "Password Manager" in the sidebar
   - Create a strong master password (8+ characters)
   - Must include: uppercase, lowercase, number, special character
   - ⚠️ **Important**: This password cannot be recovered!

2. **Add Your First Password**
   ```
   Title: Gmail Account
   Username: your.email@gmail.com
   Password: ••••••••
   URL: https://mail.google.com
   Category: Email
   ```

3. **Explore System Tools**
   - Navigate to "System Tools" → "Maintenance"
   - Run "Clean Temp Files" to free up space
   - Use "SFC Scan" to check system integrity

### Common Tasks

#### 🔍 Search & Copy Passwords
```
1. Open Password Manager
2. Use the search bar to find your password
3. Click the copy icon next to the field
4. Password auto-clears from clipboard after 30 seconds
```

#### 🧹 Clean System
```
1. Go to System Tools → Maintenance
2. Click "Clean Temp Files"
3. Approve UAC prompt
4. Wait for completion notification
```

#### 📦 Install Multiple Apps
```
1. Navigate to "Install Apps"
2. Check boxes next to desired apps
3. Click "Download Selected"
4. Installers will launch automatically
```

---

## 🏗️ Architecture

```
Make_Your_Life_Easier.A.E/
├── 📂 src/
│   ├── 📂 modules/           # Core functionality modules
│   │   ├── auto-updater.js   # Update system
│   │   ├── file-utils.js     # File operations
│   │   ├── download-manager.js
│   │   ├── system-tools.js   # Windows utilities
│   │   ├── spicetify.js      # Spotify customization
│   │   └── user-profile.js   # User data management
│   ├── 📂 styles/            # Modular CSS
│   └── 📂 assets/            # Icons & images
├── 📂 password-manager/      # Encrypted password storage
│   ├── auth.js              # AES-256-GCM encryption
│   └── database.js          # SQLite database
├── 📂 lang/                 # Internationalization
│   ├── en.json
│   └── gr.json
├── main.js                  # Electron main process
├── renderer.js              # Frontend logic
├── preload.js               # Secure IPC bridge
└── package.json
```

### 🔧 Technology Stack

| Technology | Purpose | Version |
|-----------|---------|---------|
| [Electron](https://www.electronjs.org/) | Desktop framework | 38.7.2 |
| [electron-updater](https://www.electron.build/auto-update) | Auto-update system | 6.1.7 |
| [SQLite3](https://www.sqlite.org/) | Local database | 5.1.6 |
| [electron-store](https://github.com/sindresorhus/electron-store) | Settings storage | 8.1.0 |
| Node.js Crypto | AES-256-GCM encryption | Native |
| HTML/CSS/JS | User interface | Modern standards |

---

## 🔒 Security & Privacy

### Password Manager Security

#### Encryption
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **IV**: Random 128-bit initialization vector per entry
- **Authentication**: Built-in authenticated encryption
- **Key Size**: 256-bit encryption keys

#### Key Derivation
```
Master Password
      ↓
  scrypt (cost=2^14, blocksize=8, parallelization=1)
      ↓
  512-bit Derived Key
      ↓
  HKDF-SHA256 (Key Expansion)
      ↓
  256-bit Encryption Key + 256-bit Auth Key
```

#### Security Features
- ✅ Keys cleared from memory on logout
- ✅ Auto-lock after 30 minutes of inactivity
- ✅ No password storage (only hashed verification)
- ✅ Secure random number generation
- ✅ Protection against timing attacks
- ✅ No clipboard history for sensitive data

### Privacy Guarantees

- 🚫 **No Telemetry** - Zero usage tracking
- 🚫 **No Analytics** - No data collection
- 🚫 **No Cloud Sync** - All data stored locally
- 🚫 **No Ads** - Completely ad-free
- ✅ **Open Source** - Transparent codebase
- ✅ **Local First** - Your data never leaves your device

---

## 💻 Development

### Prerequisites

- Node.js 18+ and npm
- Git
- Windows 10/11 development environment

### Setup

```bash
# Clone the repository
git clone https://github.com/thomasthanos/Make_Your_Life_Easier.A.E.git

# Navigate to directory
cd Make_Your_Life_Easier.A.E

# Install dependencies
npm install

# Start development server
npm start
```

### Build Commands

```bash
# Development mode (no updater)
npm start

# Build portable executable
npm run build-portable

# Build installer
npm run build-installer

# Build both versions
npm run build-all

# Build and publish to GitHub
npm run publish
```

### Project Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Launch app in development mode |
| `npm run build-portable` | Create portable .exe |
| `npm run build-installer` | Create installer .exe |
| `npm run build-all` | Build both versions |
| `npm run publish` | Build and publish to GitHub releases |

### Development Tips

1. **Hot Reload**: Restart app with `Ctrl+R` to see changes
2. **DevTools**: Press `F12` to open developer tools
3. **Logs**: Check console for debug information
4. **Testing**: Use `--no-updater` flag to skip update checks

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute

- 🐛 **Report Bugs**: Open an issue with reproduction steps
- 💡 **Suggest Features**: Share your ideas in discussions
- 📝 **Improve Docs**: Help make documentation clearer
- 🌍 **Translations**: Add support for more languages
- 💻 **Code**: Submit pull requests with improvements

### Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Code Guidelines

- Follow existing code style
- Comment complex logic
- Test your changes thoroughly
- Update documentation if needed

---

## ❓ FAQ

<details>
<summary><b>Can I recover my master password if I forget it?</b></summary>

No, the master password uses one-way hashing for security. If you forget it, you'll need to reset the password manager, which will delete all stored passwords. Always keep your master password in a safe place!
</details>

<details>
<summary><b>Is my data synced to the cloud?</b></summary>

No, all your data is stored locally on your device. There is no cloud sync, which means your passwords never leave your computer.
</details>

<details>
<summary><b>How do updates work?</b></summary>

The app checks for updates automatically when launched. If an update is available, you'll see a notification in the title bar. Updates download in the background and install when you restart the app.
</details>

<details>
<summary><b>Can I use this on macOS or Linux?</b></summary>

Currently, the app is only available for Windows. macOS and Linux support may be added in future versions.
</details>

<details>
<summary><b>Why does it need administrator privileges?</b></summary>

Some system maintenance tools (like SFC scan and temp file cleanup) require administrator access to modify system files. The password manager and most other features work without admin rights.
</details>

<details>
<summary><b>How can I add custom software to the installer?</b></summary>

You can add custom apps by modifying the `CUSTOM_APPS` array in `renderer.js`. Add your app's name, download URL, file extension, and category.
</details>

---

## 🗺️ Roadmap

### Version 3.3.0 (Planned)
- [ ] Encrypted notes feature
- [ ] Password strength analyzer
- [ ] Backup/restore functionality
- [ ] Browser extension integration
- [ ] Two-factor authentication

### Version 4.0.0 (Future)
- [ ] macOS and Linux support
- [ ] Cloud sync (optional, encrypted)
- [ ] Mobile companion app
- [ ] Password generator improvements
- [ ] Advanced system diagnostics
- [ ] Plugin system

### Completed ✅
- [x] AES-256-GCM encryption
- [x] Auto-update system
- [x] Multi-language support
- [x] Custom title bar
- [x] Dark/light themes
- [x] System maintenance tools
- [x] Software installation hub

---

## 📊 Stats

<div align="center">

![GitHub release (latest by date)](https://img.shields.io/github/v/release/thomasthanos/Make_Your_Life_Easier.A.E?style=for-the-badge)
![GitHub all releases](https://img.shields.io/github/downloads/thomasthanos/Make_Your_Life_Easier.A.E/total?style=for-the-badge)
![GitHub repo size](https://img.shields.io/github/repo-size/thomasthanos/Make_Your_Life_Easier.A.E?style=for-the-badge)
![GitHub last commit](https://img.shields.io/github/last-commit/thomasthanos/Make_Your_Life_Easier.A.E?style=for-the-badge)

</div>

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 ThomasThanos

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```

---

## 🙏 Acknowledgments

- **Electron Team** - For the amazing framework
- **SQLite** - For reliable local storage
- **Node.js Community** - For excellent packages
- **All Contributors** - Thank you for your support!

---

## 👤 Author

<div align="center">

**ThomasThanos**

[![GitHub](https://img.shields.io/badge/GitHub-thomasthanos-181717?style=for-the-badge&logo=github)](https://github.com/thomasthanos)
[![Email](https://img.shields.io/badge/Email-thomasthanos2@icloud.com-0078D4?style=for-the-badge&logo=microsoft-outlook)](mailto:thomasthanos2@icloud.com)

</div>

---

## 💖 Support

If you find this project helpful, please consider:

- ⭐ **Starring** the repository
- 🐛 **Reporting** bugs you encounter
- 💡 **Suggesting** new features
- 🤝 **Contributing** to the codebase
- 📢 **Sharing** with others who might benefit

---

<div align="center">

**Made with ❤️ by ThomasThanos**

*Simplifying technology, one click at a time.*

[⬆ Back to Top](#-make-your-life-easier)

---

**© 2024 ThomasThanos. All Rights Reserved.**

</div>
