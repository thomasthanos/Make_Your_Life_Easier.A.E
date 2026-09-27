# Make Your Life Easier

Βάση για desktop εφαρμογή Windows: **Tauri 2** (Rust + WebView2) με **Svelte 5 + TypeScript + Vite**.
Σκούρο UI σε στυλ 3D glass, custom titlebar, sidebar που ανοιγοκλείνει, splash για updates σε στυλ Discord (GitHub Releases) και one-click installer. Το installer περιλαμβάνει επίσης το pinned Ludusavi engine και offline manifest για τη σελίδα Game Saves, επομένως το τελικό μέγεθος εξαρτάται από αυτά τα bundled resources.

## Εργαλεία (μία φορά)

- Node.js 20+
- Rust (stable MSVC): `winget install Rustlang.Rustup`
- Visual Studio 2022 Build Tools με το workload «Desktop development with C++»
- Το WebView2 υπάρχει ήδη στα Windows 10/11. Το NSIS το κατεβάζει μόνο του το Tauri.

## Εντολές

```bash
npm install
npm run prepare:game-saves  # κατεβάζει/επαληθεύει τα pinned Game Saves resources
npm run tauri dev      # ανάπτυξη με hot reload
npm run check          # έλεγχος τύπων (Svelte + TS)
cd src-tauri && cargo test --locked
npm run tauri build    # release exe + installer στο src-tauri/target/release/bundle/nsis/
```

Το `npm run tauri ...` εκτελεί αυτόματα το `prepare:game-saves`. Το script χρησιμοποιεί SHA-256 μέσω .NET ώστε να λειτουργεί και σε παλαιότερο Windows PowerShell όπου δεν υπάρχει το `Get-FileHash`.

Για να δεις το splash να «κατεβάζει» update χωρίς πραγματικό release (λειτουργεί μόνο σε dev):

```powershell
$env:MYLE_UPDATER_DEMO = "1"; npm run tauri dev        # ψεύτικο download
$env:MYLE_UPDATER_DEMO = "offline"; npm run tauri dev  # ψεύτικο σφάλμα δικτύου
```

Ή σκέτο στον browser, με `npm run dev` και `http://localhost:1420/splash.html?demo=update` (ή `=offline`, `=latest`).

Το εικονίδιο (ο hooded coder) ζει στο `app-icon.svg`. Μετά από αλλαγή του, ξαναφτιάξε τα PNG/ICO με `npx tauri icon app-icon.svg` και κράτα από το `src-tauri/icons/` μόνο όσα δηλώνει το `tauri.conf.json`. Το λογότυπο μέσα στην εφαρμογή (`src/lib/components/Logo.svelte`) και η κινούμενη εκδοχή του splash (`src/splash/CoderScene.svelte`) διαβάζουν τα ίδια σχήματα από το `src/lib/brand.ts`, οπότε άλλαξέ τα και εκεί.

## Δομή

```
src/
  app/App.svelte              layout: titlebar + sidebar + content
  app/shell/                  Titlebar, Sidebar, ContentArea
  app/pages/registry.ts       ← εδώ προσθέτεις σελίδες
  app/pages/install-apps/     σελίδα Install Apps (winget)
  app/pages/game-saves/       Game Saves UI, state και typed IPC
  lib/toast.svelte.ts         ειδοποιήσεις (toast.success/info/error)
  lib/confirm.svelte.ts       await confirm({...})
  splash/                     οθόνη updater (κινούμενο λογότυπο, κατάσταση, progress, ταχύτητα)
  lib/brand.ts                σχήματα του εικονιδίου (Logo.svelte + splash)
  lib/updater.ts              typed γέφυρα προς τον Rust updater
  styles/tokens.css           χρώματα, μεγέθη, κινήσεις
  styles/glass.css            .glass / .surface
src-tauri/
  src/game_saves/             scan, backup, restore, settings και scheduling
  resources/ludusavi/         pinned engine, manifest, license και notices
  src/window_sizing.rs        αυτόματο μέγεθος παραθύρου
  src/updater.rs              GitHub Releases updater
  src/lib.rs                  εκκίνηση, splash → main
  windows/installer.nsi       custom NSIS template (αλλαγές με "; MYLE:")
  tauri.conf.json             όνομα, έκδοση, παράθυρα, installer
scripts/
  bootstrap-game-saves.ps1    λήψη και SHA-256 verification των pinned resources
```

### Νέα σελίδα

1. Φτιάξε το `src/app/pages/MyPage.svelte` και ξεκίνα με `<PageHeader title="…" />`.
2. Πρόσθεσε μία γραμμή στο `registry.ts`: `{ id: "my-page", label: "My page", icon: SomeIcon, component: MyPage }`.

Τα icons είναι από το [Lucide](https://lucide.dev/icons), π.χ. `import Star from "@lucide/svelte/icons/star"`.
Αν θέλεις κάρτες μέσα σε σελίδα, χρησιμοποίησε την κλάση `.surface` και όχι την `.glass`: blur μέσα σε blur κοστίζει.

## Σελίδα «Install Apps»

App store πάνω από το **winget**, στον φάκελο `src/app/pages/install-apps/` (frontend) και `src-tauri/src/apps/` (Rust).

| Αρχείο | Περιεχόμενο |
|---|---|
| `data/apps.json` | Η σταθερή λίστα (winget IDs, site, `selfUpdating`, `iconDomain`/`icon`) και τα **app packs** |
| `src-tauri/catalog/custom-apps.json` | Οι «ειδικές» εφαρμογές εκτός winget: resolver (`github` / `page` / `static`), τύπος εγκατάστασης (`installer` / `portable` / `zip`), ανίχνευση, `activate` |
| `categories.ts` | Λέξεις-κλειδιά για τις αυτόματες κατηγορίες (override με `"category"` στο JSON) |

- Η κατάσταση (πράσινο = εγκατεστημένη, μπλε = update, γκρι = όχι) προέρχεται από το `winget list`. Οι ειδικές εφαρμογές ανιχνεύονται από το registry ή από κάποιο αρχείο.
- Όσες είναι `selfUpdating` δεν μετράνε ποτέ στα updates.
- **Αναζήτηση:**
  - ψάχνει πρώτα στη λίστα
  - αν δεν βρει τίποτα, ψάχνει ζωντανά στο winget («More from catalog»)
  - ό,τι τσεκάρεις από εκεί μένει «Pinned»
- **Εγκατάσταση με winget**, με τρεις προσπάθειες:
  1. `--silent`
  2. χωρίς `--silent`
  3. `--scope user`
- **Hash mismatch:**
  - η εφαρμογή ρωτά πρώτα
  - αν δεχτείς, ένα UAC ανοίγει προσωρινά το `InstallerHashOverride`, εγκαθιστά και το ξανακλείνει
- **Ειδικές εφαρμογές:** ο resolver βρίσκει το πιο πρόσφατο link (cache 6 ωρών). Αν το GitHub δίνει SHA-256, ελέγχεται.
- **Ασφάλεια:** το UI στέλνει μόνο IDs. Τα URLs και οι εντολές υπάρχουν μόνο στο JSON που είναι μέσα στο binary.
- **Vencord / BetterDiscord:**
  - Το Install κατεβάζει το επίσημο εργαλείο (`VencordInstallerCli.exe` / `bdcli.exe`) και «πειράζει» αμέσως το Discord Stable.
  - Η κατάσταση βγαίνει από τα αρχεία στο `%LOCALAPPDATA%\Discord\app-*\resources` (πιο πρόσφατο `app-*`).
  - Αν ένα update του Discord σβήσει το patch, εμφανίζεται το κουμπί «Patch Discord».
  - Τα δύο δηλώνουν `conflicts` μεταξύ τους, οπότε η εγκατάσταση του ενός ζητά επιβεβαίωση όταν το άλλο είναι ενεργό.

## Σελίδα «Creative Hub»

Κάρτες για **δικά σου** πακέτα (zip ή installer): κατέβασμα με πρόοδο, αποσυμπίεση, εκτέλεση setup και σβήσιμο των προσωρινών αρχείων.
Frontend: `src/app/pages/creative-hub/`. Backend: `src-tauri/src/apps/creative.rs`.

Η λίστα είναι **μόνο** το `src-tauri/catalog/creative-apps.json`, που μπαίνει μέσα στο exe κατά το build. Ο χρήστης δεν μπορεί να την αλλάξει: κάθε αλλαγή θέλει νέο build.

```jsonc
{
  "id": "creative.video",
  "name": "…", "description": "…", "category": "Video",
  "sizeHint": 1500000000,          // προαιρετικό, για ένδειξη μεγέθους
  "digest": "sha256:…",            // προαιρετικό, ελέγχεται πριν το setup
  "source": { "type": "gdrive", "fileId": "ID_ΑΠΟ_ΤΟ_LINK", "fileName": "suite.zip" },
  "setup": { "type": "zip", "run": "setup.exe", "args": [] }
}
```

- `source`: `gdrive` (file id **ή ολόκληρο το link** του Drive), `static` (οποιοδήποτε https URL: R2, B2, Dropbox, δικός σου server), `github`, `page`.
- `setup`:
  - `zip`: ξεπακετάρει και τρέχει το `run` (αν λείπει, βρίσκει μόνο του το `setup.exe`/`.msi`). Με `"onlyRun": true` βγάζει **μόνο** αυτό το αρχείο από το zip, χρήσιμο όταν το zip έχει ολόκληρο project.
  - `installer`: τρέχει σκέτο exe/msi.
  - `extract`: μόνο ξεπακετάρισμα στο `to` (default `%USERPROFILE%\Downloads\<όνομα>`).
  - `"password": "…"` για κλειδωμένα zip (AES ή κλασικό).
- `icon` (προαιρετικό):
  - `"/icons/app.svg"` για αρχείο μέσα στο `public/icons/`, που ταξιδεύει με την εφαρμογή
  - `"https://…"` για εικόνα από το διαδίκτυο
  - διαδρομή αρχείου, π.χ. `%USERPROFILE%\Pictures\logo.png`, που τη διαβάζει το backend (μόνο τοπικά)
  - Προτίμησε **SVG** για λογότυπα, ή **PNG/WebP** 256×256 με διαφάνεια. Δεκτά: svg, png, webp, jpg, gif, avif, ico, έως 4 MB.
- **Πού πάνε τα αρχεία:** το πακέτο κατεβαίνει στο `%USERPROFILE%\Downloads\` και ξεπακετάρεται στο `%USERPROFILE%\Downloads\<όνομα>\`. Ο installer τρέχει από εκεί και, αν ζητήσει δικαιώματα admin, βγαίνει το UAC.
- **Καθάρισμα:** το κατεβασμένο αρχείο και ο φάκελος που ξεπακετάρεται για installer διαγράφονται **όταν κλείνει η εφαρμογή**, όχι νωρίτερα. Έτσι ένας installer που ξαναξεκινά τον εαυτό του δεν μένει χωρίς αρχεία. Ο προορισμός του `extract` (π.χ. φωτογραφίες) **δεν** διαγράφεται.
- Πρόοδος με ποσοστό υπάρχει και στο κατέβασμα και στο ξεπακετάρισμα, μαζί με το όνομα του αρχείου.
- Αν το `run` δεν ταιριάζει με κανένα αρχείο μέσα στο zip, το μήνυμα λάθους δείχνει ποια `.exe`/`.msi` περιέχει το πακέτο. Αν το JSON σου έχει λάθος, εμφανίζεται μήνυμα με τη γραμμή, αντί να αγνοείται σιωπηλά.

### Google Drive

Χρησιμοποιείται το direct endpoint `https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t`,
που παρακάμπτει τη σελίδα «δεν μπορούμε να σαρώσουμε το αρχείο».

- Το αρχείο πρέπει να είναι κοινόχρηστο ως **«Anyone with the link»**.
- Το Google Drive έχει **ημερήσιο όριο λήψεων ανά αρχείο**. Όταν το πιάσει, επιστρέφει ιστοσελίδα αντί για αρχείο, και η εφαρμογή το εμφανίζει ως σαφές σφάλμα. Δεν παρακάμπτεται από την εφαρμογή.
- Για μεγάλα/πολυκατεβασμένα πακέτα, προτιμότερα είναι τα **Cloudflare R2** (χωρίς χρέωση egress), **Backblaze B2** ή τα **GitHub Releases** (έως 2 GB/αρχείο), με `"source": { "type": "static", "url": "…" }`.

## Σελίδα «Game Saves»

Η σελίδα βρίσκεται μετά το Install Apps και χρησιμοποιεί bundled **Ludusavi v0.31.0** με ξεχωριστό config directory, ώστε να μην αλλάζει τυχόν προσωπική εγκατάσταση Ludusavi του χρήστη.

- Το κανονικό scan είναι offline (`--no-manifest-update`) και αναγνωρίζει τα saves της pinned βάσης μαζί με custom games του χρήστη.
- Το `Update database` είναι η μόνη ρητή ενέργεια που επικοινωνεί με το manifest source. Αν η λήψη ή η επικύρωση αποτύχει, διατηρείται ατομικά η προηγούμενη βάση.
- Τα backups είναι ZIP/Deflate level 6, με τρία πλήρη snapshots ανά παιχνίδι και χωρίς differential snapshots.
- Το restore κάνει νέο preview, ζητά επιβεβαίωση και κρατά safety copy για επτά ημέρες. Το τελευταίο restore μπορεί να αναιρεθεί από το `Undo last restore`.
- Το frontend στέλνει opaque IDs. Οι τίτλοι περνούν στο Ludusavi μέσω stdin και όχι ως αυθαίρετα command arguments.
- Οι ρυθμίσεις αποθηκεύονται ατομικά στο app data, μαζί με launcher roots, custom games, exclusions, path mappings, database metadata και το τελευταίο scheduled αποτέλεσμα.
- Το Daily/Weekly auto-backup δημιουργεί per-user Windows Scheduled Task με `StartWhenAvailable`, χωρίς elevation και χωρίς wake-from-sleep. Το `Off` και το uninstall αφαιρούν το task.
- Τα OneDrive, Dropbox και Google Drive shortcuts επιλέγουν μόνο τοπικούς συγχρονιζόμενους φακέλους· δεν χρησιμοποιούνται cloud APIs.

Τα generated binaries/manifest αγνοούνται από το Git. Σε νέο checkout τρέξε `npm run prepare:game-saves`. Οι pinned URLs και SHA-256 τιμές βρίσκονται στο `scripts/bootstrap-game-saves.ps1`, ενώ οι άδειες/attributions μπαίνουν στο installer από το `src-tauri/resources/ludusavi/`.

## Μέγεθος παραθύρου

Στην εκκίνηση το κύριο παράθυρο παίρνει μέγεθος ανάλογα με την οθόνη όπου βρίσκεται ο κέρσορας, και κεντράρεται. Τα μεγέθη είναι σε physical pixels:

| Οθόνη | Παράθυρο |
|---|---|
| 4K (2160p) | 2560×1440 |
| 2K (1440p) | 1920×1080 |
| 1080p | 1280×720 |
| μικρότερη | 90% της ωφέλιμης περιοχής |

Το παράθυρο δεν ξεπερνά ποτέ το 95% της περιοχής εκτός taskbar.

## Updater (Cloudflare R2 + GitHub Releases)

Η παλιά Electron εφαρμογή (v4.x) ζει στο branch `old` και δεν παίρνει πια updates· η νέα ξεκινά από το **7.0.0**. Το `latest.yml` της παλιάς στο R2 μένει ανέγγιχτο, άρα οι παλιές εγκαταστάσεις απλώς βλέπουν «up to date».

**Release:**

1. Ανέβασε την έκδοση **και** στο `package.json` **και** στο `src-tauri/Cargo.toml` (π.χ. `7.0.1`) και κάνε commit.
2. `git tag v7.0.1 && git push origin main v7.0.1`
3. Το `.github/workflows/release.yml`:
   - ελέγχει ότι tag και εκδόσεις ταιριάζουν, τρέχει `svelte-check` και χτίζει (κατεβάζει και το Ludusavi)
   - **υπογράφει** exe, installer και uninstaller με το πιστοποιητικό των secrets `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` (`scripts/sign.ps1`)
   - ανεβάζει στο **Cloudflare R2** (`downloads.thomast.uk`, secrets `R2_*`) τον `MakeYourLifeEasier_7.0.1_x64-setup.exe`, το σταθερό link `MakeYourLifeEasier-installer.exe` και στο τέλος το `latest.json`, και ελέγχει ότι το R2 σερβίρει ακριβώς τα ίδια bytes
   - δημοσιεύει και το GitHub release

Για δοκιμή χωρίς release: Actions → Release → **Run workflow**. Χτίζει και υπογράφει το ίδιο, κρατά τον installer ως artifact και δεν ανεβάζει/δημοσιεύει τίποτα.

**Σε κάθε εκκίνηση, το splash:**

- διαβάζει το `https://downloads.thomast.uk/latest.json` (`UPDATE_FEED` στο `src-tauri/src/updater.rs`)· αν δεν απαντά, ρωτά το `api.github.com/repos/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest`
- αν βρει νεότερη έκδοση, κατεβάζει τον installer (μόνο από `downloads.thomast.uk` ή `github.com`) και ελέγχει το SHA-256 του (από το feed ή από το digest του GitHub· χωρίς hash δεν εγκαθιστά)
- τον τρέχει σιωπηλά (`/S /UPDATE /R`) και κλείνει
- ο installer ξανανοίγει τη νέα έκδοση

Αν δεν υπάρχει δίκτυο, η εφαρμογή ανοίγει κανονικά μετά από ~2 δευτερόλεπτα (η μπάρα μετρά αντίστροφα).

> Ο έλεγχος SHA-256 πιάνει αρχεία που χάλασαν ή άλλαξαν στη διαδρομή. Δεν προστατεύει αν παραβιαστεί ο ίδιος ο λογαριασμός GitHub/Cloudflare.

### Cloudflare Pages site (ξεχωριστό από το updater)

Το `make-your-life-easier.pages.dev` είναι στατικό download/marketing site και δεν σερβίρει το Tauri webview. Τα αρχεία του βρίσκονται στο `site/`, ενώ το root `wrangler.toml` δηλώνει `pages_build_output_dir = "./site"`. Το Pages build command μένει κενό· δεν πρέπει να δείχνει στο Vite `dist/` ούτε να τρέχει `npm run build`.

- Κύριο download: `https://downloads.thomast.uk/MakeYourLifeEasier-installer.exe`
- GitHub fallback: το latest release του repository
- Το `/installer.html` ανακατευθύνεται στο `/` για συμβατότητα με παλιούς συνδέσμους
- `npm run check:site` ελέγχει τα required αρχεία, internal links, security headers και παλιές Electron/Portable αναφορές
- Τα R2 objects, το `latest.json` και το release workflow είναι ανεξάρτητα από το Pages deployment

## Εγκατάσταση (one-click, ανά χρήστη, χωρίς admin)

| Τι | Πού |
|---|---|
| Πρόγραμμα | `%LOCALAPPDATA%\ThomasThanos\MakeYourLifeEasier\MakeYourLifeEasier.exe` |
| Desktop | `%USERPROFILE%\Desktop\Make Your Life Easier.lnk` |
| Start Menu | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Make Your Life Easier.lnk` |
| Εκκίνηση με τα Windows | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Make Your Life Easier.lnk` (με `--autostart`) |
| Registry | `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier` |
| Game Saves task | `MakeYourLifeEasier Game Saves Backup` (μόνο όταν το schedule είναι Daily/Weekly) |

- Όταν η εφαρμογή ανοίγει από το Startup (`--autostart`), το κύριο παράθυρο ξεκινά ελαχιστοποιημένο στο taskbar. Αυτό ρυθμίζεται στο `finish_startup` (`src-tauri/src/lib.rs`).
- Το uninstall αφαιρεί και το Windows Scheduled Task του Game Saves.
- Μετά από εγκατάσταση ή απεγκατάσταση, το `scripts/verify-install.ps1` (ή `-Removed`) ελέγχει όλα τα παραπάνω.
