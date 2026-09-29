# Make Your Life Easier · for developers

Everything about the build, structure, pages, updater and setup. For the app itself, see the [README](../README.md).

## Development

### Requirements

- Node.js 20+
- Rust stable with MSVC: `winget install Rustlang.Rustup`
- Visual Studio 2022 Build Tools with the `Desktop development with C++` workload
- Windows 10/11 and the WebView2 Runtime

### Core commands

~~~powershell
npm install
npm run dev       # app with hot reload
npm run build     # the full Windows setup
npm run check     # svelte-check, TypeScript and site checks
npm test          # Rust tests for the app and the setup
npm run lint      # cargo clippy -D warnings
~~~

| Script | What it does |
| --- | --- |
| <code>build</code> | The whole setup: backend/target/release/bundle/setup/MYLE.exe |
| <code>build:app</code> | Release exe of the app, without the setup |
| <code>verify:install</code> | Checks an install, or with <code>-- -Removed</code>, an uninstall |
| <code>web:dev</code> / <code>web:build</code> | Vite for the app; <code>web:dev</code> also opens a local preview |
| <code>web:setup</code> | Builds the setup/uninstaller UI |
| <code>prepare:game-saves</code> | Downloads and verifies the pinned Game Saves resources |

Every push to main and every pull request runs through .github/workflows/ci.yml: frontend checks, Rust lint/tests and a Windows install smoke test. Each CI run's setup is kept as an artifact for 7 days.

`dev`, `build`, `build:app` and `tauri` all run `prepare:game-saves` automatically. To preview the installer, open `npm run web:dev` and `http://localhost:1420/installer.html?demo=reinstall`.

The main icon lives at `backend/icons/app-icon.svg`. The app logo and splash share the shapes from `frontend/lib/brand.ts`.

## Structure

```
.github/workflows/            ci.yml (every push/PR), release.yml (tag v*), keepalive.yml
scripts/
  build-setup.ps1             the whole setup (npm run build)
  bootstrap-game-saves.ps1    download and SHA-256 verification of the pinned resources
  sign.ps1                    exe signing (release.yml)
  smoke-test-setup.ps1        silent install → update → uninstall with checks (CI)
  verify-install.ps1          checks a single install
  check-site.mjs              checks site/
site/                         static download site (Cloudflare Pages, wrangler.toml)
frontend/                     frontend (Svelte 5 + TS), Vite root
  index.html                  main window → main.ts → app/
  splash.html                 updater window → splash.ts → splash/
  installer.html              setup/uninstaller window → installer/
  app/App.svelte              layout: titlebar + sidebar + content
  app/shell/                  Titlebar, Sidebar, ContentArea
  app/pages/registry.ts       ← add pages here
  app/pages/<page>/           one page per folder (UI, state, typed IPC)
  app/account/                Discord/Google sign-in and settings sync
  installer/                  the setup/uninstaller window (Svelte)
  splash/                     updater screen (animated logo, status, progress)
  lib/                        shared: toast, confirm, updater, brand, components/
  styles/                     tokens.css (colors, sizes, motion), glass.css
  public/                     static files shipped with the app (icons/)
backend/                      backend (Rust + Tauri)
  src/lib.rs                  startup, splash → main
  src/<feature>/               apps, game_saves, cleaner, spotify_hub, account, …
  src/updater.rs               updater (feed on R2, GitHub Releases as a fallback)
  installer/                  setup.exe + uninstall.exe (Rust, its own Tauri window)
  icons/                      app-icon.svg (the source) and the PNG/ICO built from it
  resources/                  what ships next to the exe (Ludusavi, Spicetify)
  tauri.conf.json             name, version, windows, resources (and for the setup)
vite.config.ts                one config for everything: `vite build` → backend/target/web/, `--mode setup` → backend/target/web-setup/
```

Not in git: `node_modules/` (npm) and `backend/target/`, where **every** build goes: Rust, Vite (`web/`, `web-setup/`) and the setup (`release/bundle/setup/`).

### A new page

1. Create `frontend/app/pages/MyPage.svelte` and start it with `<PageHeader title="…" />`.
2. Add one line to `registry.ts`: `{ id: "my-page", label: "My page", icon: SomeIcon, component: MyPage }`.

Icons come from [Lucide](https://lucide.dev/icons), e.g. `import Star from "@lucide/svelte/icons/star"`.
For cards inside a page, use the `.surface` class, not `.glass`: blur inside blur is costly.

## The "Install Apps" page

An app store on top of **winget**, in `frontend/app/pages/install-apps/` (frontend) and `backend/src/apps/` (Rust).

| File | Content |
|---|---|
| `data/apps.json` | The fixed list (winget IDs, site, `selfUpdating`, `iconDomain`/`icon`) and the **app packs** |
| `backend/catalog/custom-apps.json` | The "special" apps outside winget: resolver (`github` / `page` / `static`), install kind (`installer` / `portable` / `zip`), detection, `activate` |
| `categories.ts` | Keywords for the automatic categories (override with `"category"` in the JSON) |

- Status (green = installed, blue = update, grey = not installed) comes from `winget list`. Special apps are detected from the registry or a file.
- Anything `selfUpdating` never counts toward updates.
- **Search:**
  - looks in the list first
  - if nothing turns up, searches winget live ("More from catalog")
  - whatever you check there stays "Pinned"
- **Install via winget**, with three attempts:
  1. `--silent`
  2. without `--silent`
  3. `--scope user`
- **Hash mismatch:**
  - the app asks first
  - if you agree, a UAC prompt briefly opens `InstallerHashOverride`, installs, and closes it again
- **Special apps:** the resolver finds the latest link (6-hour cache). A malformed SHA-256 is always rejected. Executable installers need either a valid SHA-256 or a valid Authenticode signature from a publisher pinned in the catalog (e.g. NVIDIA Corporation).
- **Safety:** the UI only sends IDs. URLs and commands only exist in the JSON baked into the binary.
- **Vencord / BetterDiscord:**
  - Install downloads the official tool (`VencordInstallerCli.exe` / `bdcli.exe`) and immediately patches Discord Stable.
  - Status comes from the files in `%LOCALAPPDATA%\Discord\app-*\resources` (the most recent `app-*`).
  - If a Discord update wipes the patch, the "Patch Discord" button reappears.
  - The two declare `conflicts` with each other, so installing one asks for confirmation while the other is active.

## The "Creative Suite" page

Cards for **your own** packages (zip or installer): download with progress, extraction, running the setup, and cleaning up temp files.
Frontend: `frontend/app/pages/creative-hub/`. Backend: `backend/src/apps/creative.rs`.

The list is **only** `backend/catalog/creative-apps.json`, baked into the exe at build time. The user can't change it: any change needs a new build.

```jsonc
{
  "id": "creative.video",
  "name": "…", "description": "…", "category": "Video",
  "sizeHint": 1500000000,          // optional, for a size estimate
  "digest": "sha256:…",            // optional, checked before setup runs
  "source": { "type": "gdrive", "fileId": "ID_FROM_THE_LINK", "fileName": "suite.zip" },
  "setup": { "type": "zip", "run": "setup.exe", "args": [] }
}
```

- `source`: `gdrive` (a file id **or the whole** Drive link), `static` (any https URL: R2, B2, Dropbox, your own server), `github`, `page`.
- `setup`:
  - `zip`: unpacks and runs `run` (missing, it finds a `setup.exe`/`.msi` on its own). With `"onlyRun": true` it extracts **only** that file from the zip, useful when the zip holds a whole project.
  - `installer`: runs a plain exe/msi.
  - `extract`: only unpacks, into `to` (default `%USERPROFILE%\Downloads\<name>`).
  - `"password": "…"` for locked zips (AES or classic).
- `icon` (optional):
  - `"/icons/app.svg"` for a file inside `frontend/public/icons/`, shipped with the app
  - `"https://…"` for an image from the web
  - a file path, e.g. `%USERPROFILE%\Pictures\logo.png`, read by the backend (local only)
  - Prefer **SVG** for logos, or 256×256 **PNG/WebP** with transparency. Accepted: svg, png, webp, jpg, gif, avif, ico, up to 4 MB.
- **Where files go:** the package downloads to `%USERPROFILE%\Downloads\` and unpacks into `%USERPROFILE%\Downloads\<name>\`. The installer runs from there, and if it asks for admin rights, UAC appears.
- **Cleanup:** the downloaded file and the folder unpacked for an installer are deleted **when the app closes**, not sooner — so an installer that restarts itself never loses its files mid-run. The `extract` destination (e.g. photos) is **never** deleted.
- Percentage progress shows for both the download and the extraction, along with the file name.
- If `run` doesn't match any file in the zip, the error message shows which `.exe`/`.msi` the package actually contains. A malformed JSON shows an error with the line, instead of being silently ignored.

### Google Drive

Uses the direct endpoint `https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t`,
which skips the "can't scan this file" page.

- The file must be shared as **"Anyone with the link"**.
- Google Drive has a **daily per-file download quota**. Once it's hit, it returns a web page instead of the file, and the app shows that as a clear error. The app can't work around it.
- For large or often-downloaded packages, **Cloudflare R2** (no egress fees), **Backblaze B2**, or **GitHub Releases** (up to 2 GB/file) are better, with `"source": { "type": "static", "url": "…" }`.

## The "Game Saves" page

The page sits after Install Apps and uses a bundled **Ludusavi v0.31.0** with its own config directory, so it never touches a user's personal Ludusavi install.

- A normal scan is offline (`--no-manifest-update`) and recognizes saves from the pinned database along with the user's custom games.
- `Update database` is the only explicit action that talks to the manifest source. If the download or validation fails, the previous database is kept atomically.
- Backups are ZIP/Deflate level 6, with three full snapshots per game and no differential snapshots.
- Restore runs a fresh preview, asks for confirmation, and keeps a safety copy for seven days. The last restore can be undone with `Undo last restore`.
- The frontend sends opaque IDs. Titles reach Ludusavi over stdin, never as arbitrary command arguments.
- Settings are saved atomically in the app data, along with launcher roots, custom games, exclusions, path mappings, database metadata, and the last scheduled result.
- Daily/Weekly auto-backup creates a per-user Windows Scheduled Task with `StartWhenAvailable`, no elevation and no wake-from-sleep. `Off` and uninstall both remove the task.
- **Cloud backup**: buttons for Dropbox, Google Drive, MEGA and OneDrive. Clicking one creates `<cloud>\Make Your Life Easier\Game Saves Backups` and makes it the backup folder (never the root of the cloud folder). Only each app's local synced folder is used, with no cloud APIs or accounts:
  - **Dropbox**: `info.json` in `%LOCALAPPDATA%` or `%APPDATA%\Dropbox` (personal and business), else `%USERPROFILE%\Dropbox`.
  - **Google Drive**: Drive for desktop's drive (from its registry settings or a drive named "Google Drive") and its "My Drive" folder in whatever language, or the mirror folder in the profile.
  - **MEGA**: its settings are encrypted, so `MEGA` / `MEGAsync` is looked for in the profile and in Documents.
  - **OneDrive**: the Windows `OneDrive*` environment variables.
  - If a service isn't found, its button asks for its folder and creates the backup folder inside it. Earlier backups stay in the old folder.

Generated binaries/manifest are ignored by Git. On a fresh checkout, run `npm run prepare:game-saves`. The pinned URLs and SHA-256 values live in `scripts/bootstrap-game-saves.ps1`, and the licenses/attributions ship in the installer from `backend/resources/ludusavi/`.

## The "Password Manager" page

An end-to-end encrypted vault (`backend/src/passwords/`, page in `frontend/app/pages/password-manager/`).

- **Keys.** The master password gives a master key through Argon2id (64 MiB, 3 passes). A random vault key encrypts each entry on its own with XChaCha20-Poly1305. The associated data is `entry id | revision`, so a ciphertext cannot be moved to another entry or rolled back unnoticed. The vault key is stored only wrapped: by the master key, and by a 52-character recovery code shown once. Changing the master password re-wraps it; entries are not encrypted again.
- **On this PC.** `%APPDATA%\ThomasThanos\MakeYourLifeEasier\passwords.vault` holds only ciphertext (titles, user names and addresses are encrypted too). Keys and decrypted entries live only in Rust and are wiped (`zeroize`). The page never gets the vault key; a password reaches it only when revealed. Copying goes from Rust to the clipboard, marked to stay out of clipboard history and cloud clipboard, and is cleared after 30 seconds. The vault locks after the chosen idle time (5 minutes by default), whenever Windows locks and after the PC wakes from sleep. Only what the user does counts as use: the page, and filling, saving or a new password from the extension at the user's click; look-ups from the browser and the sync never keep it open.
- **Windows Hello.** Optional, per PC (`backend/src/passwords/hello.rs`); opening the page asks it at once, if the window is in front (never when the vault locks while the user is on the page). Turning it on makes a Windows Hello key (`KeyCredentialManager`, in the TPM where there is one) and has it sign a random challenge; the signature (RSA PKCS#1 v1.5, the same every time for the same data) is hashed into a key that wraps the vault key. Only the wrapped key and the challenge are stored, sealed with DPAPI in `%LOCALAPPDATA%\ThomasThanos\MakeYourLifeEasier\data\passwords-hello.bin`, never synced. Opening the vault this way has Windows Hello sign again, which it does only after the user's PIN, fingerprint or face. A changed master password keeps it working (the vault key is the same); another vault, or Windows Hello reset, turns it off and the master password opens the vault.
- **Guarding it.** After three wrong master passwords (or recovery codes) each try waits longer, doubling up to a minute. Exporting a backup asks for the master password again even while the vault is open, and an import reads only the file just picked in its dialog, never a path the page names. An entry that does not open with the vault key (damaged, or not made with it) is left out and counted, instead of keeping the whole vault shut; the page says how many. A shown password, and the password history, hide again after 30 seconds.
- **Sync.** Two Supabase tables with row security per user: `password_vault` (header) and `password_items` (one sealed row per entry, deletions as tombstones). Create them with `docs/supabase/password-manager.sql`. Every change is sent with compare-and-swap on the revision the PC last saw. An entry changed on two PCs is merged once unlocked: the newer change wins and the other password goes into the entry's history. Deletions are sealed with the vault key too (`myle-tombstone|id|revision`), and nothing from the account is taken in while the vault is locked: every row must open with the key first, so someone with the account alone can neither add nor delete entries (a row that does not open is refused, and this PC's version goes back over it one revision up). A second PC takes the account's vault and opens it with the same master password.
- **Browser filling.** `extension/` is the Manifest V3 extension for Chrome, Edge and Brave; `extension/firefox/` has the Firefox manifest and copies of the shared files, refreshed by `npm run prepare:extension`. Chromium uses `background.service_worker`, while Firefox uses `background.scripts`. The extension talks to a native messaging host (`com.thomasthanos.myle`): this same program, started by the browser with the extension's id (`run_native_host` in `browser.rs`). The host checks the id and that a browser started it, then passes each request over a per-user named pipe to the running app, which answers only a host that is the same program. The app answers only while "Browser filling" is on and the vault is unlocked, only for https pages (or `localhost`), and a password only for an entry saved for that site (same host, or same registrable domain by the Public Suffix List). Nothing is filled without a click. Turning filling on writes the host manifests to `%LOCALAPPDATA%\ThomasThanos\MakeYourLifeEasier\data\native-messaging` and registers them under `HKCU\Software\{Google\Chrome, Microsoft\Edge, BraveSoftware\Brave-Browser, Mozilla}\NativeMessagingHosts`; the uninstaller removes those keys. Both browser folders ship in the install folder for loading as temporary/unpacked extensions, and `npm run prepare:extension` also packs `extension/myle-passwords-{chrome,firefox}.zip` for the stores (git-ignored). Its Chrome id `gaelkhdpkgnffkfmaaklknijinjmmopo` is fixed by the `key` in its manifest; the Firefox id is `myle-passwords@thomast.uk`. Once it is published, set its page in `package.json` (`myle.extensionUrl`): the setup then offers it on a first install ("Browser extension", opened when setup finishes) and Browser filling shows "Get the extension".
- **The extension against the page.** The page's scripts share the document, so the menu (`extension/content.js`) assumes they are hostile. It counts only real input (`isTrusted`); it lives in a closed shadow root under a random tag name, in the browser's top layer (a manual popover, shown again above anything the page put there), with its host's look pinned by `:host { … !important }` rules; a change to its element closes it. A click on it counts only after it has been on screen, still and untouched, for half a second, never as the second click of a double click, only where it is the element under the pointer, and in Chromium only while IntersectionObserver v2 sees nothing drawn over it (otherwise it says so). It never fills hidden fields or a form that sends over plain http (checked before the password is asked for). A sign-in form embedded from another site is filled only from the toolbar popup, where the user sees whose it is. A login is offered for saving only if the user typed it (or picked the suggested password): the next page gets a random nonce and the user name, never the password, and "Save" works only with that nonce. On a password step, the account the page already shows (Google's, say) comes first. The app answers the host only so many requests a minute (20 fills, checks or saves, 120 look-ups), and a page may change only the login saved for its own host (the old password goes into the history).
- **Website icons.** The list shows each website's icon (`backend/src/passwords/icons.rs`, `Favicon.svelte`; on by default, off from ⋯, which deletes them). The app asks each website itself, so no icon service learns the vault's sites: only public names over https, never an IP address, `localhost` or a local, `.arpa` or `.onion` name, following redirects itself and turning `http://` ones into `https://`. It reads the home page up to `</head>` for `<link rel="icon">` and Apple touch icons (or a `<meta http-equiv="refresh">` page), then `/favicon.ico`, and keeps an answer only if its first bytes are an image's (PNG, ICO, GIF, JPEG, WebP or SVG, 200 KB at most, drawn by `<img>` where an SVG's scripts never run). The icons are kept in `passwords-icons.bin` next to the vault, sealed with the vault key, read when the vault opens and fetched again after a month (a site without one after a week). The extension gets the icons of a site's logins from that cache with its answer; the browser never fetches them.
- **Tray.** With a vault on the PC and "Keep running in the tray" on (Settings, `KeepInTray` in `HKCU\Software\ThomasThanos\MakeYourLifeEasier`, on when unset), closing the window hides the app next to the clock (`backend/src/tray.rs`), so Ctrl+Shift+L and browser filling keep working; the icon's menu opens the app or the vault, locks the vault, or quits. Started by Windows with "Start minimized", the app starts there. Because a closed window only hides, the setup first sets the event `Local\MakeYourLifeEasier-Quit`, on which the app exits cleanly, before it asks the windows to close (`processes.rs`).

## The "Windows Optimization" page

Four tabs: **Debloat**, **Tweaks**, **Apps** and **Tools** (Auto-Logon, restart to BIOS/UEFI). The debloater is MYLE's own (`backend/src/debloat/`, page in `frontend/app/pages/windows-optimization/debloat/`); it replaces the WinUtil and Sparkle launchers, whose downloaded cache (`…\data\windows-optimization`) is deleted on the page's first load.

- **The tables.** `catalog.rs` holds every tweak (registry values, service start types, scheduled tasks, Store apps, the 24-hour clock, Edge) and every app it may remove, fixed at compile time; the page sends only ids. Values follow WinUtil, Win11Debloat and Sparkle without their known mistakes: WinUtil's `wermgr` is not a service; `SearchboxTaskbarMode` has four values, so the user's own is kept; Widgets are hidden with the `Dsh\AllowNewsAndInterests` policy because the UserChoice Protection Driver blocks `TaskbarDa`; `SharedAccess` is left alone (Mobile Hotspot needs it). A service changes only from the Windows default (`from`), so one the user set by hand stays. `NEVER` and `removable()` keep Windows' and MYLE's own packages out of reach whatever the table says: the Store, Terminal, winget, Xbox sign-in, frameworks, codecs, and WebView2, which MYLE runs on. Names match exactly or by publisher suffix, never with wildcards.
- **Where it stands.** `detect.rs` reads each tweak's state from the registry, services (`QueryServiceConfig`), scheduled tasks (Task Scheduler COM), the locale's time format and the installed packages (the per-user AppModel repository in the registry, not PowerShell), without administrator rights, in well under a second.
- **Undo.** Before each change `undo.rs` keeps what was there: the value or its absence and the first key the write created, the start type, the task's state, the time format. Only the first original of an operation is kept, so applying twice cannot overwrite it. Undo puts it back exactly and removes the keys it created while empty. The record is `debloat-undo.json` in the local data folder; Edge's undo installs it again with winget, and removed apps are offered again from the Microsoft Store.
- **Who does what.** The user's own settings (HKCU, the time format through `SetLocaleInfoW`) are changed by the app itself, as the user, so an elevation with another administrator account cannot land them in that account's profile; Explorer is restarted by the app for the same reason. Machine-wide changes, app removal for every user and new ones (`Remove-AppxPackage -AllUsers` and the provisioned package), Edge and restore points go through an administrator helper: this same program started with `--debloat-elevated-helper` over `elevated_pipe.rs` (shared with the System Cleaner; one UAC prompt per session, the helper serves only the app's pipe and the app answers only this same program). The helper checks every undo record against the catalog: only the tweak's own operations, strings from `allowed_machine_strings`, and keys on the way to the value.
- **Edge.** `setup.exe --uninstall --force-uninstall` from Edge's own uninstall entry, accepted only from Edge's folder, with `EdgeUpdateDev\AllowUninstall` and the old-Edge stub in place for the run (both removed after). EdgeUpdate stays: it also updates WebView2.
- **Restore point.** Made before the one-click Debloat (`Checkpoint-Computer`, with Windows' once-a-day limit lifted for the call and put back). System Protection is read from `SPP\Clients`; if it is off the page offers to turn it on for the Windows drive, or to go on without.

## Window size

At startup the main window is sized for the screen the cursor is on, and centered. Sizes are in physical pixels:

| Screen | Window |
|---|---|
| 4K (2160p) | 2560×1440 |
| 2K (1440p) | 1920×1080 |
| 1080p | 1280×720 |
| smaller | 90% of the usable area |

The window never exceeds 95% of the area outside the taskbar.

## Updater (Cloudflare R2 + GitHub Releases)

The old Electron app (v4.x) lives on the `old` branch and no longer receives updates; the new one starts at **7.0.0**. The old `latest.yml` on R2 stays untouched, so old installs simply see "up to date".

**Release:**

1. Bump the version in **both** `package.json` **and** `backend/Cargo.toml` (e.g. `7.0.2`) and commit.
2. `git tag v7.0.2 && git push origin main v7.0.2`
3. `.github/workflows/release.yml`:
   - checks the tag and versions match, runs `svelte-check`, and builds (also downloading Ludusavi)
   - **signs** the exe, installer and uninstaller with the certificate from the `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` secrets (`scripts/sign.ps1`)
   - uploads `MYLE.exe` to **Cloudflare R2** (`downloads.thomast.uk`, `R2_*` secrets), preserves the old `MakeYourLifeEasier-installer.exe` URL for existing links, and finally publishes `latest.json`, and checks R2 serves the exact same bytes
   - publishes the GitHub release too

To test without a release: Actions → Release → **Run workflow**. It builds and signs the same way, keeps the installer as an artifact, and doesn't upload or publish anything.

**On every launch, the splash:**

- reads `https://downloads.thomast.uk/latest.json` (`UPDATE_FEED` in `backend/src/updater.rs`); if that doesn't answer, it asks `api.github.com/repos/thomasthanos/MYLE/releases/latest`
- if a newer version is found, downloads the installer (only from `downloads.thomast.uk` or `github.com`) and checks its SHA-256 (from the feed or GitHub's digest; with no hash it won't install)
- runs the setup silently with `/S /UPDATE /LIVE` **while the app is still open**: files are swapped in with a rename (Windows allows this even for a running exe), the old ones stay as `*.myle-old`, and the new version deletes them once it starts
- opens the new version with `--just-updated` (it doesn't ask the network again, and shows "Updated to v…"), and closes as soon as its window appears; before that it drops the single-instance lock, otherwise the new copy would just hand its arguments to the old one and quit
- if the live update fails (or the app isn't running from the install folder), it falls back to the setup's progress window (`/P /UPDATE /R`), which waits for the app to close and opens the new version half a second before closing itself
- the installer reopens the new version

With no network, the app opens normally after ~2 seconds (the bar counts down).

> The SHA-256 check catches files that got corrupted or changed along the way. It doesn't protect against the GitHub/Cloudflare account itself being compromised.

### Cloudflare Pages site (separate from the updater)

`make-your-life-easier.pages.dev` is a static download/marketing site and doesn't serve the Tauri webview. Its files live in `site/`, and the root `wrangler.toml` declares `pages_build_output_dir = "./site"`. The Pages build command stays empty; it must not point at the Vite build or run `npm run web:build`.

- Main download: `https://downloads.thomast.uk/MakeYourLifeEasier-installer.exe`
- GitHub fallback: the repository's latest release
- `/installer.html` redirects to `/` for compatibility with old links
- `npm run check:site` checks required files, internal links, security headers, and stale Electron/Portable references
- The R2 objects, `latest.json`, and the release workflow are independent of the Pages deployment

## Setup and uninstall (per user, no admin)

The setup is our own: the `backend/installer` crate (Rust) with a Svelte window (`frontend/installer/`, `frontend/installer.html`) in the same dark style as the app. It builds two programs:

- **`setup.exe`**: carries the app as one solid XZ payload (`installer/src/payload.rs`). Shows the install folder, toggles for Desktop / Start menu / launch with Windows / open when finished, per-file progress, and a completion screen. On the same version it plainly says "Reinstall" and keeps settings and data. It repairs the app's own recognized shortcuts and checks their targets; the Startup shortcut launches with `--autostart`. The choices are remembered in `HKCU\Software\ThomasThanos\MakeYourLifeEasier` (`DesktopShortcut`, `StartMenuShortcut`, `StartupShortcut`) and offered again next time, minus any the user has deleted since. A shortcut Windows refuses (retried a few times, since the shell and virus scanners open new `.lnk` files at once) does not fail the install: the app is installed and the completion screen lists what is missing. A dead link, or one to an older copy of the app, under our shortcut name is taken over rather than getting a second entry beside it. If the app is running, it asks you to close it before changing files. With "Open when finished" checked, it opens the app and closes the setup once the install succeeds.
- **`uninstall.exe`**: sits next to the app and is what Windows runs from "Installed apps". It asks whether to also remove settings/data (`%APPDATA%\ThomasThanos\MakeYourLifeEasier` / `%LOCALAPPDATA%\ThomasThanos\MakeYourLifeEasier\data`, cache). While at it, it also cleans up the older `com.thomasthanos.makeyourlifeeasier` folders. Game Saves backups are never touched. Because a program can't delete its own file while running, `uninstall.exe` (like NSIS's) copies itself to a new folder in `%TEMP%` and runs from there (`installer/src/relocate.rs`): the copy does the work, and once the original has exited it deletes it and the folder too. The `/S` exit code still reaches whoever ran it. Old copies in `%TEMP%` are swept up on the next uninstall.

Install is all-or-nothing: each file is written next to the old one, and if something fails partway through, the previous version is restored. `install.json` in the folder records which files the setup put there, so update and uninstall only remove those.

Command line (the same as NSIS's, which the updater already speaks):

| Flag | What it does |
|---|---|
| `/S` | no window |
| `/P` | progress only, starts at once and closes itself (the updater runs `/P /UPDATE /R`) |
| `/UPDATE` | shortcuts stay as the user left them |
| `/R` | opens the app afterward |
| `/NS` | no shortcuts |
| `/LIVE` | (with `/S /UPDATE`) update while the app is running; the app itself reopens it |
| `/D=<folder>` | a different folder (last, unquoted); testing only, the window doesn't change the folder |
| `/PURGE` | (uninstall) also removes settings/data |

Preview the window in a browser: `npm run web:dev` and `http://localhost:1420/installer.html?demo=install` (or `=update`, `=reinstall`, `=uninstall`, `=running`, `=error`, `=launch-fail`, `=passive`).

| What | Where |
|---|---|
| Program | `%LOCALAPPDATA%\ThomasThanos\MakeYourLifeEasier\MYLE.exe` (existing installs keep this folder) |
| Settings, account, Game Saves | `%APPDATA%\ThomasThanos\MakeYourLifeEasier` |
| Cache and WebView2 (localStorage) | `%LOCALAPPDATA%\ThomasThanos\MakeYourLifeEasier\data` |
| Desktop | Windows Desktop known folder (may redirect to OneDrive) · `MYLE.lnk` |
| Start Menu | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\MYLE.lnk` |
| Launch with Windows (opt-in) | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MYLE.lnk` (with `--autostart`) |
| Registry | `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier` |
| Game Saves task | `MakeYourLifeEasier Game Saves Backup` (legacy task name preserved for existing schedules) |

Existing installs may also keep a `MakeYourLifeEasier.exe` compatibility copy. It hands normal launches to `MYLE.exe` and keeps an old updater or scheduled backup working through the transition. New installs contain only `MYLE.exe`.

Versions up to 7.0.x kept their data in `com.thomasthanos.makeyourlifeeasier` folders. The app moves them once, whole, with a single rename (`backend/src/storage.rs`). If a folder is in use (during a live update, the old version is still running), that time it uses the old one instead, and retries the move on the next launch. A half-finished move never happens, since that would corrupt the WebView2 profile.

- Starting with Windows is off unless chosen: in the setup ("Start with Windows", off for a new install and for `/S`) or in Settings, which adds or removes the same Startup shortcut and keeps the setup's remembered state in step (`backend/src/startup.rs`). Game Saves' scheduled backups do not need it: they run from their own scheduled task (`--game-saves-auto-backup`, no window).
- When the app opens from Startup (`--autostart`), the main window starts minimized to the taskbar unless "Start minimized" is off (the setup's Minimized / On screen switch, or Settings). The choice is the `StartMinimized` value in `HKCU\Software\ThomasThanos\MakeYourLifeEasier`, read in `finish_startup` (`backend/src/lib.rs`); unset means minimized.
- Uninstall also removes the Game Saves Windows Scheduled Task, and only the shortcuts that point to our own app.
- Whichever shortcuts were chosen in the setup. For each one the setup remembers whether it is wanted and whether it was made (`0` off, `1` wanted but not made yet, `2` made). `/UPDATE` (and the in-app update) tries again a wanted one that never got made; one that was made and is gone since was deleted by the user, so it is not brought back and is saved as off (the setup then offers it unticked). Updates refresh the others of ours and remove none. Uninstall turns `2` back into `1`, so a reinstall offers the same shortcuts. The first update over an install from before any of this was remembered adds the Start menu entry and turns the old app's `Run` value into a Startup shortcut.
- After an install or uninstall, `scripts/verify-install.ps1` (or `-Removed`) checks all of the above.
