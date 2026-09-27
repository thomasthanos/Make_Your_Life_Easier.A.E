# Make Your Life Easier · για developers

Όλες οι λεπτομέρειες για build, δομή, σελίδες, updater και setup. Για την εφαρμογή την ίδια, δες το [README](../README.md).

## Ανάπτυξη

### Απαιτήσεις

- Node.js 20+
- Rust stable με MSVC: `winget install Rustlang.Rustup`
- Visual Studio 2022 Build Tools με το workload `Desktop development with C++`
- Windows 10/11 και WebView2 Runtime

### Βασικές εντολές

~~~powershell
npm install
npm run dev       # εφαρμογή με hot reload
npm run build     # πλήρες Windows setup
npm run check     # svelte-check, TypeScript και site checks
npm test          # Rust tests για εφαρμογή και setup
npm run lint      # cargo clippy -D warnings
~~~

| Script | Τι κάνει |
| --- | --- |
| <code>build</code> | Ολόκληρο setup: backend/target/release/bundle/setup/MakeYourLifeEasier.exe |
| <code>build:app</code> | Release exe της εφαρμογής, χωρίς setup |
| <code>verify:install</code> | Ελέγχει εγκατάσταση ή, με <code>-- -Removed</code>, απεγκατάσταση |
| <code>web:dev</code> / <code>web:build</code> | Vite της εφαρμογής· το <code>web:dev</code> ανοίγει και τοπικό preview |
| <code>web:setup</code> | Χτίζει το UI του setup/uninstaller |
| <code>prepare:game-saves</code> | Κατεβάζει και επαληθεύει τα pinned Game Saves resources |

Κάθε push στο main και κάθε pull request περνά από το .github/workflows/ci.yml: frontend checks, Rust lint/tests και Windows smoke test εγκατάστασης. Το setup κάθε CI run μένει ως artifact για 7 ημέρες.

Τα dev, build, build:app και tauri τρέχουν αυτόματα το prepare:game-saves. Για preview του installer άνοιξε npm run web:dev και το http://localhost:1420/installer.html?demo=reinstall.

Το κύριο εικονίδιο βρίσκεται στο backend/icons/app-icon.svg. Τα app logo και splash μοιράζονται τα σχήματα του frontend/lib/brand.ts.

## Δομή

```
.github/workflows/            ci.yml (κάθε push/PR), release.yml (tag v*), keepalive.yml
scripts/
  build-setup.ps1             ολόκληρο το setup (npm run build)
  bootstrap-game-saves.ps1    λήψη και SHA-256 verification των pinned resources
  sign.ps1                    υπογραφή exe (release.yml)
  smoke-test-setup.ps1        σιωπηλό install → update → uninstall με ελέγχους (CI)
  verify-install.ps1          έλεγχος μιας εγκατάστασης
  check-site.mjs              έλεγχος του site/
site/                         στατικό download site (Cloudflare Pages, wrangler.toml)
frontend/                     frontend (Svelte 5 + TS), root του Vite
  index.html                  κύριο παράθυρο → main.ts → app/
  splash.html                 παράθυρο updater → splash.ts → splash/
  installer.html              παράθυρο setup/uninstaller → installer/
  app/App.svelte              layout: titlebar + sidebar + content
  app/shell/                  Titlebar, Sidebar, ContentArea
  app/pages/registry.ts       ← εδώ προσθέτεις σελίδες
  app/pages/<σελίδα>/         μία σελίδα ανά φάκελο (UI, state, typed IPC)
  app/account/                σύνδεση Discord/Google και sync ρυθμίσεων
  installer/                  το παράθυρο του setup/uninstaller (Svelte)
  splash/                     οθόνη updater (κινούμενο λογότυπο, κατάσταση, progress)
  lib/                        κοινά: toast, confirm, updater, brand, components/
  styles/                     tokens.css (χρώματα, μεγέθη, κινήσεις), glass.css
  public/                     στατικά αρχεία που ταξιδεύουν με την εφαρμογή (icons/)
backend/                      backend (Rust + Tauri)
  src/lib.rs                  εκκίνηση, splash → main
  src/<λειτουργία>/           apps, game_saves, cleaner, spotify_hub, account, …
  src/updater.rs              updater (feed στο R2, εφεδρεία τα GitHub Releases)
  installer/                  setup.exe + uninstall.exe (Rust, δικό τους Tauri παράθυρο)
  icons/                      app-icon.svg (η πηγή) και τα PNG/ICO που βγαίνουν από αυτό
  resources/                  ό,τι μπαίνει δίπλα στο exe (Ludusavi, Spicetify)
  tauri.conf.json             όνομα, έκδοση, παράθυρα, resources (και για το setup)
vite.config.ts                ένα config για όλα: `vite build` → backend/target/web/, `--mode setup` → backend/target/web-setup/
```

Δεν είναι στο git: το `node_modules/` (npm) και το `backend/target/`, όπου πάνε **όλα** τα builds: Rust, Vite (`web/`, `web-setup/`) και το setup (`release/bundle/setup/`).

### Νέα σελίδα

1. Φτιάξε το `frontend/app/pages/MyPage.svelte` και ξεκίνα με `<PageHeader title="…" />`.
2. Πρόσθεσε μία γραμμή στο `registry.ts`: `{ id: "my-page", label: "My page", icon: SomeIcon, component: MyPage }`.

Τα icons είναι από το [Lucide](https://lucide.dev/icons), π.χ. `import Star from "@lucide/svelte/icons/star"`.
Αν θέλεις κάρτες μέσα σε σελίδα, χρησιμοποίησε την κλάση `.surface` και όχι την `.glass`: blur μέσα σε blur κοστίζει.

## Σελίδα «Install Apps»

App store πάνω από το **winget**, στον φάκελο `frontend/app/pages/install-apps/` (frontend) και `backend/src/apps/` (Rust).

| Αρχείο | Περιεχόμενο |
|---|---|
| `data/apps.json` | Η σταθερή λίστα (winget IDs, site, `selfUpdating`, `iconDomain`/`icon`) και τα **app packs** |
| `backend/catalog/custom-apps.json` | Οι «ειδικές» εφαρμογές εκτός winget: resolver (`github` / `page` / `static`), τύπος εγκατάστασης (`installer` / `portable` / `zip`), ανίχνευση, `activate` |
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
Frontend: `frontend/app/pages/creative-hub/`. Backend: `backend/src/apps/creative.rs`.

Η λίστα είναι **μόνο** το `backend/catalog/creative-apps.json`, που μπαίνει μέσα στο exe κατά το build. Ο χρήστης δεν μπορεί να την αλλάξει: κάθε αλλαγή θέλει νέο build.

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
  - `"/icons/app.svg"` για αρχείο μέσα στο `frontend/public/icons/`, που ταξιδεύει με την εφαρμογή
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
- **Backup στο cloud**: κουμπιά για Dropbox, Google Drive, MEGA και OneDrive. Με το πάτημα φτιάχνεται ο φάκελος `<cloud>\Make Your Life Easier\Game Saves Backups` και γίνεται ο φάκελος των backups (ποτέ η ρίζα του cloud). Χρησιμοποιούνται μόνο οι τοπικοί συγχρονιζόμενοι φάκελοι των εφαρμογών τους, χωρίς cloud APIs ή λογαριασμούς:
  - **Dropbox**: `info.json` στο `%LOCALAPPDATA%` ή `%APPDATA%\Dropbox` (personal και business), αλλιώς `%USERPROFILE%\Dropbox`.
  - **Google Drive**: ο δίσκος του Drive for desktop (ρυθμίσεις του στο registry ή δίσκος με όνομα «Google Drive») και το «My Drive» μέσα του σε όποια γλώσσα, ή ο φάκελος mirror στο προφίλ.
  - **MEGA**: οι ρυθμίσεις του είναι κρυπτογραφημένες, οπότε ψάχνεται `MEGA` / `MEGAsync` στο προφίλ και στα Documents.
  - **OneDrive**: οι μεταβλητές `OneDrive*` των Windows.
  - Αν μια υπηρεσία δεν βρεθεί, το κουμπί της ζητά τον φάκελό της και φτιάχνει μέσα τον φάκελο των backups. Τα προηγούμενα backups μένουν στον παλιό φάκελο.

Τα generated binaries/manifest αγνοούνται από το Git. Σε νέο checkout τρέξε `npm run prepare:game-saves`. Οι pinned URLs και SHA-256 τιμές βρίσκονται στο `scripts/bootstrap-game-saves.ps1`, ενώ οι άδειες/attributions μπαίνουν στο installer από το `backend/resources/ludusavi/`.

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

1. Ανέβασε την έκδοση **και** στο `package.json` **και** στο `backend/Cargo.toml` (π.χ. `7.0.2`) και κάνε commit.
2. `git tag v7.0.2 && git push origin main v7.0.2`
3. Το `.github/workflows/release.yml`:
   - ελέγχει ότι tag και εκδόσεις ταιριάζουν, τρέχει `svelte-check` και χτίζει (κατεβάζει και το Ludusavi)
   - **υπογράφει** exe, installer και uninstaller με το πιστοποιητικό των secrets `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` (`scripts/sign.ps1`)
   - ανεβάζει στο **Cloudflare R2** (`downloads.thomast.uk`, secrets `R2_*`) τον `MakeYourLifeEasier_7.0.2_x64-setup.exe`, το σταθερό link `MakeYourLifeEasier-installer.exe` και στο τέλος το `latest.json`, και ελέγχει ότι το R2 σερβίρει ακριβώς τα ίδια bytes
   - δημοσιεύει και το GitHub release

Για δοκιμή χωρίς release: Actions → Release → **Run workflow**. Χτίζει και υπογράφει το ίδιο, κρατά τον installer ως artifact και δεν ανεβάζει/δημοσιεύει τίποτα.

**Σε κάθε εκκίνηση, το splash:**

- διαβάζει το `https://downloads.thomast.uk/latest.json` (`UPDATE_FEED` στο `backend/src/updater.rs`)· αν δεν απαντά, ρωτά το `api.github.com/repos/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest`
- αν βρει νεότερη έκδοση, κατεβάζει τον installer (μόνο από `downloads.thomast.uk` ή `github.com`) και ελέγχει το SHA-256 του (από το feed ή από το digest του GitHub· χωρίς hash δεν εγκαθιστά)
- τον τρέχει σιωπηλά (`/S /UPDATE /R`) και κλείνει
- ο installer ξανανοίγει τη νέα έκδοση

Αν δεν υπάρχει δίκτυο, η εφαρμογή ανοίγει κανονικά μετά από ~2 δευτερόλεπτα (η μπάρα μετρά αντίστροφα).

> Ο έλεγχος SHA-256 πιάνει αρχεία που χάλασαν ή άλλαξαν στη διαδρομή. Δεν προστατεύει αν παραβιαστεί ο ίδιος ο λογαριασμός GitHub/Cloudflare.

### Cloudflare Pages site (ξεχωριστό από το updater)

Το `make-your-life-easier.pages.dev` είναι στατικό download/marketing site και δεν σερβίρει το Tauri webview. Τα αρχεία του βρίσκονται στο `site/`, ενώ το root `wrangler.toml` δηλώνει `pages_build_output_dir = "./site"`. Το Pages build command μένει κενό· δεν πρέπει να δείχνει στο build του Vite ούτε να τρέχει `npm run web:build`.

- Κύριο download: `https://downloads.thomast.uk/MakeYourLifeEasier-installer.exe`
- GitHub fallback: το latest release του repository
- Το `/installer.html` ανακατευθύνεται στο `/` για συμβατότητα με παλιούς συνδέσμους
- `npm run check:site` ελέγχει τα required αρχεία, internal links, security headers και παλιές Electron/Portable αναφορές
- Τα R2 objects, το `latest.json` και το release workflow είναι ανεξάρτητα από το Pages deployment

## Setup και uninstall (ανά χρήστη, χωρίς admin)

Το setup είναι δικό μας: το crate `backend/installer` (Rust) με παράθυρο Svelte (`frontend/installer/`, `frontend/installer.html`) στο ίδιο σκούρο στυλ με την εφαρμογή. Βγάζει δύο προγράμματα:

- **`setup.exe`**: κουβαλά την εφαρμογή ως ένα συμπαγές XZ payload (`installer/src/payload.rs`). Δείχνει φάκελο εγκατάστασης, διακόπτες για Desktop / Start menu / εκκίνηση με τα Windows / άνοιγμα στο τέλος, πρόοδο ανά αρχείο και οθόνη ολοκλήρωσης. Στην ίδια έκδοση εμφανίζει καθαρά «Reinstall» και διατηρεί ρυθμίσεις και δεδομένα. Επιδιορθώνει τα αναγνωρισμένα shortcuts της εφαρμογής και ελέγχει τους προορισμούς τους· το Startup shortcut ξεκινά με `--autostart`. Αν η εφαρμογή τρέχει, ζητά να την κλείσεις πριν αλλάξει αρχεία. Με επιλεγμένο το «Open when finished», ανοίγει την εφαρμογή και κλείνει το setup μετά την επιτυχή εγκατάσταση.
- **`uninstall.exe`**: μπαίνει δίπλα στην εφαρμογή και το τρέχουν τα Windows από τα «Installed apps». Ρωτά αν θα σβηστούν **και** οι ρυθμίσεις/δεδομένα (`%APPDATA%` / `%LOCALAPPDATA%\com.thomasthanos.makeyourlifeeasier`, cache). Τα backups του Game Saves δεν αγγίζονται ποτέ. Επειδή ένα πρόγραμμα δεν μπορεί να σβήσει το αρχείο του όσο τρέχει, το `uninstall.exe` (όπως και του NSIS) αντιγράφεται σε νέο φάκελο στο `%TEMP%` και τρέχει από εκεί (`installer/src/relocate.rs`): το αντίγραφο κάνει τη δουλειά, και όταν κλείσει το αρχικό σβήνει κι αυτό και τον φάκελο. Το exit code του `/S` φτάνει κανονικά σε όποιον το έτρεξε. Τα παλιά αντίγραφα στο `%TEMP%` σβήνονται στο επόμενο uninstall.

Η εγκατάσταση είναι «όλα ή τίποτα»: κάθε αρχείο γράφεται δίπλα στο παλιό, και αν κάτι αποτύχει στη μέση επιστρέφει η προηγούμενη έκδοση. Το `install.json` στον φάκελο λέει ποια αρχεία έβαλε το setup, ώστε update και uninstall να σβήνουν μόνο αυτά.

Γραμμή εντολών (ίδια με του NSIS, που τη μιλά ήδη ο updater):

| Flag | Τι κάνει |
|---|---|
| `/S` | χωρίς παράθυρο (ο updater τρέχει `/S /UPDATE /R`) |
| `/P` | μόνο πρόοδος, ξεκινά αμέσως και κλείνει μόνο του |
| `/UPDATE` | τα shortcuts μένουν όπως τα άφησε ο χρήστης |
| `/R` | ανοίγει την εφαρμογή μετά |
| `/NS` | χωρίς shortcuts |
| `/D=<φάκελος>` | άλλος φάκελος (τελευταίο, χωρίς εισαγωγικά)· μόνο για δοκιμές, το παράθυρο δεν αλλάζει φάκελο |
| `/PURGE` | (uninstall) σβήνει και ρυθμίσεις/δεδομένα |

Προεπισκόπηση του παραθύρου στον browser: `npm run web:dev` και `http://localhost:1420/installer.html?demo=install` (ή `=update`, `=reinstall`, `=uninstall`, `=running`, `=error`, `=launch-fail`, `=passive`).

| Τι | Πού |
|---|---|
| Πρόγραμμα | `%LOCALAPPDATA%\ThomasThanos\MakeYourLifeEasier\MakeYourLifeEasier.exe` |
| Desktop | Windows Desktop known folder (μπορεί να ανακατευθύνεται στο OneDrive) · `Make Your Life Easier.lnk` |
| Start Menu | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Make Your Life Easier.lnk` |
| Εκκίνηση με τα Windows | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Make Your Life Easier.lnk` (με `--autostart`) |
| Registry | `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier` |
| Game Saves task | `MakeYourLifeEasier Game Saves Backup` (μόνο όταν το schedule είναι Daily/Weekly) |

- Όταν η εφαρμογή ανοίγει από το Startup (`--autostart`), το κύριο παράθυρο ξεκινά ελαχιστοποιημένο στο taskbar. Αυτό ρυθμίζεται στο `finish_startup` (`backend/src/lib.rs`).
- Το uninstall αφαιρεί και το Windows Scheduled Task του Game Saves, και μόνο τα shortcuts που δείχνουν στη δική μας εφαρμογή.
- Όποια shortcuts επιλέχτηκαν στο setup· το `/UPDATE` δεν ξαναφτιάχνει όσα έσβησε ο χρήστης.
- Μετά από εγκατάσταση ή απεγκατάσταση, το `scripts/verify-install.ps1` (ή `-Removed`) ελέγχει όλα τα παραπάνω.
