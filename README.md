<p align="center">
  <picture>
    <source media="(max-width: 600px)" srcset="docs/assets/hero-mobile.svg" />
    <img src="docs/assets/hero.svg" alt="Make Your Life Easier: apps, game saves, cleanup and Windows tools in one place" width="100%" />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/thomasthanos/Make_Your_Life_Easier.A.E?display_name=tag&style=for-the-badge&color=8b83ff&labelColor=151c31" /></a>
  <a href="https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/actions/workflows/ci.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/thomasthanos/Make_Your_Life_Easier.A.E/ci.yml?branch=main&style=for-the-badge&label=build&labelColor=151c31" /></a>
  <img alt="Windows 10 and 11" src="https://img.shields.io/badge/windows-10%20%2F%2011-45c8e6?style=for-the-badge&labelColor=151c31" />
</p>

<p align="center">
  <a href="https://downloads.thomast.uk/MakeYourLifeEasier-installer.exe"><img src="docs/assets/download.svg" alt="Download Make Your Life Easier for Windows" width="380" /></a>
</p>

<p align="center">
  <a href="https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest"><img src="docs/assets/link-releases.svg" alt="Latest releases and changelog" width="90" /></a>
  <a href="docs/DEVELOPMENT.md"><img src="docs/assets/link-development.svg" alt="Development guide" width="90" /></a>
  <a href="LICENSE"><img src="docs/assets/link-license.svg" alt="License and terms" width="90" /></a>
</p>

<img src="docs/assets/divider.svg" alt="" width="100%" />

<h2 align="center">What's inside</h2>

<p align="center">
  <img src="docs/assets/features.svg" alt="Install Apps, Game Saves, Spotify Hub, Creative Suite, Windows Optimization, System Cleaner, System Maintenance, Sync &amp; Updates" width="100%" />
</p>

<h2 align="center">Install</h2>

<p align="center">
  <img src="docs/assets/install-steps.svg" alt="Download, install for your account without admin rights, and it updates itself" width="100%" />
</p>

<p align="center"><sub>If the WebView2 Runtime is missing, the setup installs it from Microsoft. Your settings and data are kept across every update.</sub></p>

<h2 align="center">How it works</h2>

<p align="center">
  <img src="docs/assets/how-it-works.svg" alt="Svelte frontend, Rust and Tauri backend, Windows tools, and updates verified with SHA-256" width="100%" />
</p>

<img src="docs/assets/divider.svg" alt="" width="100%" />

## For developers

```powershell
npm install
npm run dev      # the app with hot reload
npm run build    # installer → backend/target/release/bundle/setup/MakeYourLifeEasier.exe
```

You'll need Node.js 20+, Rust (MSVC), and the Visual Studio Build Tools. The development guide covers the structure, pages, updater and setup.

<p><a href="docs/DEVELOPMENT.md"><img src="docs/assets/link-development.svg" alt="Read the development guide" width="90" /></a></p>

## License

A proprietary project by **ThomasThanos**. You're free to use the official, unmodified builds for personal use. Copying, modifying, or redistributing the code needs written permission.

<p><a href="LICENSE"><img src="docs/assets/link-license.svg" alt="Read the full license terms" width="90" /></a></p>

<br />

<p align="center">
  <a href="https://github.com/thomasthanos"><img src="docs/assets/footer.svg" alt="Made to make the little things easier. Built with care and coffee by ThomasThanos. Visit the GitHub profile." width="100%" /></a>
</p>
