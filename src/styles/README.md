# CSS Modules Structure

Το CSS του project έχει οργανωθεί σε modules για καλύτερη συντήρηση.

## Δομή Αρχείων

```
src/styles/
├── _variables.css      # CSS Variables & Theme Setup (colors, glass effects, layout vars)
├── _base.css           # Base Styles & Reset, Scrollbars
├── _layout.css         # Layout Components (#app, #main, #header, #content)
├── _titlebar.css       # Title Bar Styles (custom title bar, controls, toggles)
├── _sidebar.css        # Sidebar Styles (header, footer, version badge)
├── _user-info.css      # User Info Component (login card, logout menu)
├── _navigation.css     # Navigation & Menu (#menu-list)
├── _cards.css          # Cards & Content (card, app-card, install-grid, tables)
├── _buttons.css        # Buttons & Controls (button, action-btn, variants)
├── _forms.css          # Form Elements (inputs, checkbox, toggle, select, radio)
├── _status.css         # Status & Feedback (status-pre, progress)
├── _toast.css          # Toast Notifications
├── _errors.css         # Error Cards & Alerts
├── _modals.css         # Modals & Overlays (modal, bios dialog, loading)
├── _changelog.css      # Changelog Modal
├── _update.css         # Update Components (update card, update button)
├── _special-components.css  # Tutorial Cards, CTT Card
├── _dlc.css            # DLC Scope Components
├── _password-manager.css    # Password Manager Card
├── _animations.css     # Animations & Transitions (@keyframes)
├── _responsive.css     # Responsive Design (@media queries)
└── _utilities.css      # Utility Classes (.hidden, .flex, etc.)
```

## Χρήση

### Με CSS @import (για browsers)
Το `styles.css` χρησιμοποιεί `@import` για να φορτώσει τα modules.

### Με Node.js Build Script
Για Electron apps ή production, τρέξτε:
```bash
node build-css.js
```
Αυτό θα δημιουργήσει ένα concatenated `styles.css` χωρίς imports.

## Κανόνες

1. **Κάθε module ξεκινά με `_`** - Δείχνει ότι είναι partial και δεν πρέπει να χρησιμοποιηθεί μόνο του
2. **Variables πρώτα** - Το `_variables.css` πρέπει να φορτώνεται πρώτο
3. **Animations μετά** - Το `_animations.css` ορίζει keyframes που χρησιμοποιούνται αλλού
4. **Responsive τελευταίο** - Τα media queries πρέπει να είναι στο τέλος

## Editing

Για να αλλάξετε styles:
1. Βρείτε το σχετικό module
2. Κάντε τις αλλαγές
3. Τρέξτε `node build-css.js` αν χρησιμοποιείτε το build script
