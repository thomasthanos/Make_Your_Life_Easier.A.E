## ✨ Release Notes — v2.2.0

A cleaner, faster, more consistent app.

**Highlights**
- Fresh **Sidebar UI** (soft gradient, blur, subtle shadow)
- Smooth **hover/active** states + a tiny **pulse dot** on the active item
- One **Lucide** icon set across the app (color follows your theme)

**Fixes**
- Correct app **version** now shows in the sidebar
- Tidier **header/content** spacing
- Old CSS conflicts removed

**UX & Performance**
- Softer hover backgrounds, unified accent colors
- Inline SVGs → smaller bundle, fewer sidebar reflows

**Accessibility**
- Better contrast
- Active item marked with `aria-current="page"`

---

<details>
<summary><strong>Details (tech notes, upgrade steps, known issues)</strong></summary>

### Install / Upgrade
- Grab **Installer** or **Portable** from the Assets of this release  
- For Portable, close the app before replacing files  
- Icon colors follow `currentColor` → tweak with `--accent-color` (works in light/dark)

### Developers
- Icons: **Lucide** (stroke inherits `currentColor`), scale via CSS only
- Chris Titus page uses **scoped styles** → no global CSS bleed
- PowerShell launcher includes **clipboard fallback** if Electron bridge is missing
- APIs unchanged: `runCommand`, `openExternal`

</details>