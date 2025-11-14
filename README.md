# Make Your Life Easier

<div align="center">

![Version](https://img.shields.io/badge/version-3.2.1-blue.svg)
![Electron](https://img.shields.io/badge/electron-38.2.2-47848f.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows-0078d4.svg)

**A comprehensive desktop application for Windows system management, software installation, and password security**

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Development](#development)

</div>

---

## 🎯 Overview

**Make Your Life Easier** is a powerful Electron-based desktop application that streamlines Windows system management, software installation, and password security with military-grade encryption.

---

## ✨ Features

### 🔐 **Password Manager**
- Military-grade AES-256-GCM encryption
- Master password with scrypt hashing
- Auto-fetch website logos
- Password strength validator
- 30-minute auto-logout

### 💻 **Software Management**
- One-click app installation
- Download manager with pause/resume
- Pre-configured popular apps (Discord, Spotify, Epic Games, etc.)

### 🛠️ **System Maintenance**
- SFC Scan & DISM Repair
- Temp files cleanup
- Windows Debloat scripts
- Chris Titus Windows Utility

### 🎨 **Customization**
- Spicetify for Spotify theming
- DLC Unlockers (EA Games, Sims)
- Auto-updates with changelog

### 🌍 **Multi-Language**
- English & Greek support
- Dark/Light themes

---

## 📥 Installation

### **Option 1: Installer**
Download `MakeYourLifeEasier-installer.exe` from [Releases](https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases)

### **Option 2: Portable**
Download `MakeYourLifeEasier-Portable.exe` - no installation required

---

## 🚀 Usage

### **Password Manager**
1. Set master password (8+ chars with uppercase, lowercase, number, special)
2. Add passwords with title, username/email, password, URL
3. Auto-lock after 30 minutes

### **System Maintenance**
```powershell
# Run SFC Scan (requires admin)
Click "Run SFC" → Accept UAC prompt

# Clean Temp Files
Click "Clean Temp Files" → Accept UAC prompt
```

### **Install Software**
1. Navigate to "Install Apps"
2. Select apps from list
3. Click "Download Selected"
4. Installers open automatically

---

## 🏗️ Architecture
```
├── main.js              # Electron main process
├── renderer.js          # UI logic
├── preload.js           # IPC bridge
├── password-manager/    # Password manager module
│   ├── auth.js         # AES-256-GCM encryption
│   └── database.js     # SQLite storage
├── lang/               # Translations (en, gr)
└── updater/            # Auto-update system
```

### **Key Technologies**
- **Electron 38.2.2** - Desktop framework
- **SQLite3** - Local database
- **AES-256-GCM** - Encryption
- **scrypt** - Key derivation (2^14 cost)
- **electron-updater** - Auto-updates

---

## 🔒 Security

### **Password Manager**
- **Encryption**: AES-256-GCM with random 128-bit IV
- **Key Derivation**: scrypt (cost=2^14, blocksize=8)
- **Key Expansion**: HKDF with SHA-256
- **Protection**: Keys cleared on logout, 30-min timeout

### **Privacy**
- No telemetry or analytics
- All data stored locally
- No cloud sync
- Optional OAuth (Google/Discord)

---


## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 👤 Author

**ThomasThanos**
- GitHub: [@thomasthanos](https://github.com/thomasthanos)
- Email: thomasthanos2@icloud.com

---

<div align="center">

**Made with ❤️ by ThomasThanos**

[⬆ Back to Top](#make-your-life-easier)

</div>
