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
   - uploads `MYLE_<version>_x64-setup.exe` to **Cloudflare R2** (`downloads.thomast.uk`, `R2_*` secrets), the stable links `MYLE-installer.exe` and the legacy `MakeYourLifeEasier-installer.exe`, and finally `latest.json`, and checks R2 serves the exact same bytes
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
