# Generated Ludusavi resources

Run `./scripts/bootstrap-game-saves.ps1` from the repository root before a
local Tauri build. The script downloads the pinned Windows x64 release of
Ludusavi, its legal notices, and a pinned manifest snapshot; verifies every
artifact with SHA-256; and writes the generated files beside this README.

The generated executable, manifest, license, and notices are intentionally
ignored by Git. Update their versions and hashes only in the bootstrap script.
