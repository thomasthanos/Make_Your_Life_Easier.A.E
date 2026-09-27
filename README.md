<p align="center">
  <img src="docs/assets/hero.svg" alt="Make Your Life Easier: εφαρμογές, game saves, καθαρισμός και εργαλεία Windows σε ένα μέρος" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/thomasthanos/Make_Your_Life_Easier.A.E?display_name=tag&style=for-the-badge&color=8b83ff&labelColor=151c31" /></a>
  <a href="https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/actions/workflows/ci.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/thomasthanos/Make_Your_Life_Easier.A.E/ci.yml?branch=main&style=for-the-badge&label=build&labelColor=151c31" /></a>
  <img alt="Windows 10 and 11" src="https://img.shields.io/badge/windows-10%20%2F%2011-45c8e6?style=for-the-badge&labelColor=151c31" />
</p>

<p align="center">
  <a href="https://downloads.thomast.uk/MakeYourLifeEasier-installer.exe"><img src="docs/assets/download.svg" alt="Κατέβασε το Make Your Life Easier για Windows" width="380" /></a>
</p>

<p align="center">
  <sub><a href="https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest">Όλες οι εκδόσεις</a> &nbsp;·&nbsp; <a href="docs/DEVELOPMENT.md">Για developers</a> &nbsp;·&nbsp; <a href="LICENSE">Άδεια</a></sub>
</p>

<img src="docs/assets/divider.svg" alt="" width="100%" />

<h2 align="center">Τι έχει μέσα</h2>

<p align="center">
  <img src="docs/assets/features.svg" alt="Install Apps, Game Saves, Spotify Hub, Creative Hub, Windows Optimization, System Cleaner, System Maintenance, Sync &amp; Updates" width="100%" />
</p>

<h2 align="center">Εγκατάσταση</h2>

<p align="center">
  <img src="docs/assets/install-steps.svg" alt="Κατέβασε, εγκατάστησε για τον λογαριασμό σου χωρίς admin, και ενημερώνεται μόνο του" width="100%" />
</p>

<p align="center"><sub>Αν λείπει το WebView2 Runtime, το setup το εγκαθιστά από τη Microsoft. Οι ρυθμίσεις και τα δεδομένα σου μένουν σε κάθε update.</sub></p>

<h2 align="center">Πώς δουλεύει</h2>

<p align="center">
  <img src="docs/assets/how-it-works.svg" alt="Svelte frontend, Rust και Tauri backend, εργαλεία Windows, και updates με έλεγχο SHA-256" width="100%" />
</p>

<img src="docs/assets/divider.svg" alt="" width="100%" />

## Για developers

```powershell
npm install
npm run dev      # η εφαρμογή με hot reload
npm run build    # installer → backend/target/release/bundle/setup/MakeYourLifeEasier.exe
```

Χρειάζεσαι Node.js 20+, Rust (MSVC) και τα Visual Studio Build Tools. Δομή, σελίδες, updater και setup: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Άδεια

Ιδιόκτητο έργο του **ThomasThanos**. Μπορείς να χρησιμοποιείς δωρεάν τα επίσημα, αμετάβλητα builds για προσωπική χρήση. Αντιγραφή, τροποποίηση ή αναδημοσίευση του κώδικα χρειάζεται γραπτή άδεια. Πλήρεις όροι στο [LICENSE](LICENSE).

<br />

<p align="center">
  <img src="backend/icons/app-icon.svg" alt="" width="56" /><br />
  <sub>Φτιαγμένο με ☕ από τον <a href="https://github.com/thomasthanos">ThomasThanos</a></sub>
</p>
