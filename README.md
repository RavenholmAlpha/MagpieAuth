<div align="center">
  <img src="public/MPA.png" alt="MagpieAuth Logo" width="128" style="background: rgba(255,255,255,0.1); border-radius: 20px; padding: 10px;" />
  <br/>
  <h1>MagpieAuth</h1>
  <p><strong>A Secure Offline 2FA Authenticator & Password Manager</strong></p>

  [![English](https://img.shields.io/badge/Language-English-blue.svg)](README.md)
  [![中文](https://img.shields.io/badge/Language-中文-red.svg)](README-zh.md)
  <br/>

  [![Tauri Shield](https://img.shields.io/badge/Tauri-v2-cyan?logo=tauri)](https://v2.tauri.app/)
  [![Rust](https://img.shields.io/badge/Rust-1.80+-orange?logo=rust)](https://www.rust-lang.org/)
  [![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev/)
  [![License](https://img.shields.io/badge/License-Dual-blue.svg)](LICENSE)
</div>

<br/>

MagpieAuth is an offline, air-gapped vault application built for Windows. It provides a local storage environment for securing accounts, passwords, and Time-based One-Time Passwords (TOTP) without relying on cloud synchronization.

---

## Features

### Security Architecture
- **Offline Storage**: MagpieAuth does not connect to the cloud. All data stays strictly on the local machine.
- **AES-256-GCM Encryption**: Passwords and TOTP secrets are encrypted at rest in a local SQLite database (`vault.db`).
- **DPAPI Integration**: The Internal Master Key (IMK) used to decrypt the vault is protected utilizing the native Windows Data Protection API (`CryptProtectData`). This binds the encryption directly to the active Windows user session.
- **System Authentication**: MagpieAuth uses native Windows Hello (PIN or biometrics) to verify identity before granting access, with a custom Pattern Lock fallback for systems without Windows Hello configured.

### Authenticator (OTP)
- Supports importing standard `otpauth://` URIs natively.
- Synchronous real-time TOTP generation (6-digit format).
- Visual progress indicators showing exactly how many seconds remain before the current code expires.

### User Interface
- Hardware-accelerated transitions via Framer Motion.
- Clean glassmorphism styling supporting System, Light, and Dark mode preferences.
- Configurable global keyboard shortcuts (e.g., `Ctrl+Shift+L` to show/hide the vault window).
- Custom color-coded labels for categorizing vault items.

### Convenience
- **Auto-Lock Timeout**: Secures the vault automatically upon inactivity. The timeout duration is configurable.
- **Clipboard Management**: Immediate copy features with automatic clipboard clearing to avoid leaving sensitive strings in memory.
- **Encrypted Backups**: Built-in support to export and import AES-encrypted JSON backups for securely moving data between trusted systems.

---

## Technology Stack

- **Frontend Core**: React 18, TypeScript, Vite
- **Frontend Styling**: Tailwind CSS, Framer Motion
- **Backend**: Tauri v2, Rust
- **Database**: SQLite (via `rusqlite`)
- **Cryptography**: `aes-gcm`, `rand`, `windows-rs` (DPAPI bindings), `totp-rs`

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Rust (v1.80+)
- Windows 10/11 with Visual Studio C++ Build Tools installed.

### Installation & Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/magpieauth.git
   cd magpieauth
   ```

2. **Install Frontend Dependencies**
   ```bash
   npm install
   ```

3. **Run in Development Mode**
   ```bash
   npm run tauri dev
   ```

### Building for Production
To compile a release-ready Windows installer (.msi):
```bash
npm run tauri build
```
The compiled installers will be generated under `src-tauri/target/release/bundle/msi/`.

---

## Project Structure

```text
magpieauth/
├── src/                      # Frontend UI (React + TypeScript)
│   ├── components/           # UI Components (SetupWizard, PatternLock, VaultList)
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utilities (tauri-api.ts frontend bindings)
│   ├── App.tsx               # Main Application Routing and State Guard
│   └── index.css             # Tailwind & Glassmorphism variables
├── src-tauri/                # Backend Core (Rust)
│   ├── src/
│   │   ├── auth.rs           # Windows Hello / UserConsentVerifier integration
│   │   ├── commands.rs       # Tauri Command IPC payload handlers
│   │   ├── crypto.rs         # AES-GCM and DPAPI native cryptography
│   │   ├── db.rs             # SQLite schema and queries
│   │   ├── totp.rs           # TOTP parsing and generation
│   │   └── lib.rs            # Application Bootstrapper
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri Application manifest and config
└── package.json              # NPM dependencies
```

---

## Security & Design Choices

MagpieAuth is designed to keep data locally without relying on cloud synchronization. To avoid requiring users to memorize a separate master password, it leverages the operating system's native encryption API (`DPAPI` on Windows) to secure the Internal Master Key. This binds the vault's encryption to the current user's Windows login session. Even if the local database files are copied to another device, they cannot be decrypted without the original logged-in Windows credentials context.

*Note: The current cryptographic implementation (`crypto.rs`) is bound to Windows DPAPI. Future support for macOS or Linux platforms will require compiling alongside alternatives like Keychain or libsecret integrations.*

---

## License
This project uses a dual-license model:
- **Personal / Non-Commercial Use**: Free.
- **Commercial Use**: Requires either purchasing a Commercial License (Closed Source) OR releasing your modifications/product under an Open Source license (AGPLv3 or similar).

See the [`LICENSE`](LICENSE) file for full details.
