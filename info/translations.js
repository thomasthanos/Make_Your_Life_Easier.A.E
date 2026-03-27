const translations = {
  en: {
    nav: {
      menu: 'Menu',
      install: 'Install',
      crack: 'Crack',
      maintain: 'Maintain',
      activate: 'Activate',
      bios: 'BIOS',
      spicetify: 'Spicetify',
      passwords: 'Passwords',
      titus: 'Titus',
      debloat: 'Debloat'
    },
    sections: {
      'section-menu': {
        title: 'Title Bar Menu',
        whatTitle: 'What does it do?',
        whatDesc: 'Quick access to language switch and this info panel.',
        features: `
          <ul>
            <li>🎨 Dark mode interface</li>
            <li>🌍 Switch language (EN/GR)</li>
            <li>ℹ️ Open the info/help panel</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Open the title bar menu',
          'Choose language',
          'Click ℹ️ to reopen this panel anytime'
        ],
        warning: ''
      },
      'section-install': {
        title: 'Install Apps (winget)',
        whatTitle: 'What does it do?',
        whatDesc: 'Uses winget to search and install apps. Multi-select, search, and import/export lists via JSON.',
        features: `
          <ul>
            <li>🪟 Uses winget (official feeds) with silent installs</li>
            <li>🎯 Multi-select + queue with progress and retries</li>
            <li>🔍 Search and filter packages before installing</li>
            <li>📦 Import/Export selections as JSON</li>
            <li>📜 Per-app logs and status toasts</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Search or select the apps you want',
          'Optionally import a JSON list',
          'Click "Install Selected"',
          'Watch progress/logs in the app',
          'Launch apps if needed after completion'
        ],
        warning: '⚠️ Internet + winget required (the app will prompt/install winget if missing).'
      },
      'section-activate': {
        title: 'Activate + Auto Login',
        whatTitle: 'What does it do?',
        whatDesc: 'Runs activation and sets automatic login for your account.',
        features: `
          <ul>
            <li>✅ Windows activation script</li>
            <li>🔓 Enables auto login</li>
            <li>🚀 Faster boot experience</li>
            <li>🛠️ Restores full Windows features</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Click "Activate Windows"',
          'Allow admin rights when prompted',
          'Wait for the script to finish',
          'Restart the PC',
          'Enable/confirm Auto Login'
        ],
        warning: '⚠️ Administrator rights required.'
      },
      'section-maintain': {
        title: 'System Maintenance',
        whatTitle: 'What does it do?',
        whatDesc: 'Optimizes and cleans your system for better performance.',
        features: `
          <strong>Available tools:</strong>
          <ul>
            <li>🗑️ <strong>Clean temporary files</strong> (TEMP, %TEMP%, Prefetch)</li>
            <li>🔧 <strong>SFC Scan</strong> - Repair system files</li>
            <li>🔄 <strong>DISM Repair</strong> - Repair Windows image</li>
            <li>📦 <strong>Patch My PC</strong> - Automatic application updates</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Select the tool you want to run',
          'Click the corresponding button',
          'Grant administrator permissions if requested',
          'Wait for the process to finish',
          'Restart to apply the changes'
        ],
        warning: '⚠️ <strong>Make backup before important changes</strong>'
      },
      'section-crack': {
        title: 'Crack Installer',
        whatTitle: 'What does it do?',
        whatDesc: 'Installs professional software with full functionality.',
        features: `
          <strong>Available programs:</strong>
          <ul>
            <li>🎨 <strong>Adobe Photoshop</strong> - image editing</li>
            <li>🎬 <strong>Adobe Premiere</strong> - video editing</li>
            <li>✏️ <strong>Adobe Illustrator</strong> - vector graphics</li>
            <li>🖼️ <strong>Clip Studio Paint</strong> - digital painting</li>
            <li>📊 <strong>Microsoft Office</strong> - office work</li>
            <li>🎵 <strong>Adobe Media Encoder</strong> - encoding</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Select the program you want',
          'Click "Download [Program]"',
          'Wait for download and extraction',
          'Follow the installation instructions',
          'For Clip Studio: Use "Replace EXE" after installation'
        ],
        warning: '⚠️ <strong>For educational purposes only</strong>'
      },
      'section-passwords': {
        title: 'Password Manager',
        whatTitle: 'What does it do?',
        whatDesc: 'Secure local vault with categories, search, and optional import/export.',
        features: `
          <ul>
            <li>🔐 Encrypted local storage (no cloud)</li>
            <li>🗂️ Categories and search</li>
            <li>📥 Import/Export vault</li>
            <li>⚡ Quick access to credentials</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Open the Password Manager',
          'Create a master password',
          'Add categories and passwords',
          'Use search/quick copy to fill logins',
          'Export a backup regularly'
        ],
        warning: '💡 Keep the master password safe — it cannot be recovered.'
      },
      'section-spicetify': {
        title: 'Spicetify',
        whatTitle: 'What does it do?',
        whatDesc: 'Customizes Spotify with themes and extensions.',
        features: `
          <strong>Features:</strong>
          <ul>
            <li>🎭 <strong>Themes</strong> - Change appearance</li>
            <li>🔧 <strong>Extensions</strong> - New functions</li>
            <li>⚡ <strong>Custom apps</strong> - Additional features</li>
            <li>🎛️ <strong>UI modifications</strong> - Interface customization</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Click "Install Spicetify"',
          'Wait for the installation',
          'Restart Spotify',
          'Select themes from the marketplace',
          'Enjoy your personalized Spotify!'
        ],
        warning: '⚠️ <strong>Close Spotify before installation</strong>'
      },
      'section-titus': {
        title: 'Chris Titus Toolbox',
        whatTitle: 'What does it do?',
        whatDesc: 'Complete Windows optimization tool by Chris Titus.',
        features: `
          <strong>Functions:</strong>
          <ul>
            <li>🧹 <strong>Debloat Windows</strong> - Remove bloatware</li>
            <li>🔒 <strong>Privacy settings</strong> - Improve privacy</li>
            <li>⚡ <strong>Performance tweaks</strong> - Optimize performance</li>
            <li>📦 <strong>Software installation</strong> - Install essential programs</li>
            <li>🛡️ <strong>Security enhancements</strong> - Improve security</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Click "Launch Tool"',
          'PowerShell opens with the script',
          'Select the functions you want',
          'Monitor the execution',
          'Restart to apply the changes'
        ],
        warning: '⚠️ <strong>Administrator rights required</strong>'
      },
      'section-bios': {
        title: 'BIOS',
        whatTitle: 'What does it do?',
        whatDesc: 'Restarts directly into BIOS/UEFI settings.',
        features: `
          <ul>
            <li>⚡ One-click restart to BIOS/UEFI</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Save your work',
          'Click "Restart to BIOS"',
          'Configure settings in BIOS/UEFI'
        ],
        warning: '⚠️ Only change BIOS settings you understand.'
      },
      'section-debloat': {
        title: 'Debloat App',
        whatTitle: 'What does it do?',
        whatDesc: 'GUI debloat experience with toggles and safer defaults.',
        features: `
          <ul>
            <li>🧹 App-based debloat (no raw script prompts)</li>
            <li>🎚️ Toggle modules and presets</li>
            <li>💾 Restore point recommendation</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Open the Debloat app',
          'Pick profile or toggle modules',
          'Run the cleanup',
          'Restart if prompted'
        ],
        warning: '⚠️ Create/keep a restore point before heavy changes.'
      },
    }
  },
  gr: {
    nav: {
      menu: 'Μενού',
      install: 'Εγκατάσταση',
      crack: 'Crack',
      maintain: 'Συντήρηση',
      activate: 'Ενεργοποίηση',
      bios: 'BIOS',
      spicetify: 'Spicetify',
      passwords: 'Κωδικοί',
      titus: 'Titus',
      debloat: 'Αφαίρεση'
    },
    sections: {
      'section-menu': {
        title: 'Μενού Γραμμής Τίτλου',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Γρήγορη πρόσβαση σε αλλαγή θέματος, γλώσσας και το info panel.',
        features: `
          <ul>
            <li>🎨 Εναλλαγή Dark mode</li>
            <li>🌍 Αλλαγή γλώσσας (EN/GR)</li>
            <li>ℹ️ Άνοιγμα του info/help panel</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Άνοιξε το μενού στη γραμμή τίτλου',
          'Επίλεξε θέμα ή γλώσσα',
          'Πάτα ℹ️ για να ξαναδείς το panel'
        ],
        warning: ''
      },
      'section-install': {
        title: 'Εγκατάσταση (winget)',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Χρησιμοποιεί winget για αναζήτηση/εγκατάσταση εφαρμογών. Multi-select, search, import/export JSON.',
        features: `
          <ul>
            <li>🪟 Winget (επίσημα feeds) με silent installs</li>
            <li>🎯 Multi-select + ουρά με progress/retries</li>
            <li>🔍 Αναζήτηση/φίλτρα πριν την εγκατάσταση</li>
            <li>📦 Import/Export λίστας σε JSON</li>
            <li>📜 Logs ανά εφαρμογή και ειδοποιήσεις</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Ψάξε ή επίλεξε τις εφαρμογές',
          'Προαιρετικά κάνε import JSON λίστας',
          'Πάτα "Install Selected"',
          'Παρακολούθησε progress/logs',
          'Άνοιξε τις εφαρμογές αν χρειάζεται'
        ],
        warning: '⚠️ Απαιτείται internet + winget (θα γίνει prompt/εγκατάσταση αν λείπει).'
      },
      'section-activate': {
        title: 'Ενεργοποίηση + Auto Login',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Τρέχει ενεργοποίηση και ρυθμίζει αυτόματη σύνδεση στον λογαριασμό σου.',
        features: `
          <ul>
            <li>✅ Script ενεργοποίησης Windows</li>
            <li>🔓 Ενεργοποίηση αυτόματης εισόδου</li>
            <li>🚀 Πιο γρήγορη εκκίνηση</li>
            <li>🛠️ Πλήρη features Windows</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Πάτα "Activate Windows"',
          'Δώσε δικαιώματα διαχειριστή',
          'Περίμενε να τελειώσει το script',
          'Κάνε επανεκκίνηση',
          'Επιβεβαίωσε/άνοιξε Auto Login'
        ],
        warning: '⚠️ Απαιτούνται δικαιώματα διαχειριστή.'
      },
      'section-maintain': {
        title: 'Συντήρηση Συστήματος',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Βελτιστοποιεί και καθαρίζει το σύστημά σου για καλύτερη απόδοση.',
        features: `
          <strong>Διαθέσιμα εργαλεία:</strong>
          <ul>
            <li>🗑️ <strong>Καθαρισμός προσωρινών αρχείων</strong> (TEMP, %TEMP%, Prefetch)</li>
            <li>🔧 <strong>SFC Scan</strong> - Επισκευή συστηματικών αρχείων</li>
            <li>🔄 <strong>DISM Repair</strong> - Επισκευή εικόνας Windows</li>
            <li>📦 <strong>Patch My PC</strong> - Αυτόματες ενημερώσεις εφαρμογών</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Επίλεξε το εργαλείο που θέλεις να εκτελέσεις',
          'Κάνε κλικ στο αντίστοιχο κουμπί',
          'Δώσε δικαιώματα διαχειριστή αν ζητηθεί',
          'Περίμενε να ολοκληρωθεί η διαδικασία',
          'Επανεκκίνησε για να εφαρμοστούν οι αλλαγές'
        ],
        warning: '⚠️ <strong>Κάνε backup πριν από σημαντικές αλλαγές</strong>'
      },
      'section-crack': {
        title: 'Crack Installer',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Εγκαθιστά επαγγελματικό λογισμικό με πλήρη λειτουργικότητα.',
        features: `
          <strong>Διαθέσιμα προγράμματα:</strong>
          <ul>
            <li>🎨 <strong>Adobe Photoshop</strong> - επεξεργασία εικόνας</li>
            <li>🎬 <strong>Adobe Premiere</strong> - επεξεργασία βίντεο</li>
            <li>✏️ <strong>Adobe Illustrator</strong> - διανυσματική γραφική</li>
            <li>🖼️ <strong>Clip Studio Paint</strong> - ψηφιακή ζωγραφική</li>
            <li>📊 <strong>Microsoft Office</strong> - γραφεία εργασίας</li>
            <li>🎵 <strong>Adobe Media Encoder</strong> - κωδικοποίηση</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Επίλεξε το πρόγραμμα που θέλεις',
          'Κάνε κλικ "Download [Πρόγραμμα]"',
          'Περίμενε λήψη και εξαγωγή',
          'Ακολούθησε τις οδηγίες εγκατάστασης',
          'Για Clip Studio: Χρησιμοποίησε το "Replace EXE" μετά την εγκατάσταση'
        ],
        warning: '⚠️ <strong>Χρήση για εκπαιδευτικούς σκοπούς</strong>'
      },
      'section-passwords': {
        title: 'Διαχειριστής Κωδικών',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Ασφαλές τοπικό vault με κατηγορίες, αναζήτηση και import/export.',
        features: `
          <ul>
            <li>🔐 Κρυπτογράφηση, τοπική αποθήκευση</li>
            <li>🗂️ Κατηγορίες και αναζήτηση</li>
            <li>📥 Import/Export του vault</li>
            <li>⚡ Γρήγορη αντιγραφή/χρήση κωδικών</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Άνοιξε το Password Manager',
          'Φτιάξε master password',
          'Πρόσθεσε κατηγορίες και κωδικούς',
          'Χρησιμοποίησε αναζήτηση/quick copy',
          'Κάνε export για backup'
        ],
        warning: '💡 Κράτα ασφαλές το master password — δεν ανακτάται.'
      },
      'section-spicetify': {
        title: 'Spicetify',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Προσαρμογή του Spotify με themes και extensions.',
        features: `
          <strong>Δυνατότητες:</strong>
          <ul>
            <li>🎭 <strong>Themes</strong> - Αλλαγή εμφάνισης</li>
            <li>🔧 <strong>Extensions</strong> - Νέες λειτουργίες</li>
            <li>⚡ <strong>Custom apps</strong> - Επιπλέον features</li>
            <li>🎛️ <strong>UI modifications</strong> - Προσαρμογή διεπαφής</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Κάνε κλικ "Install Spicetify"',
          'Περίμενε την εγκατάσταση',
          'Επανεκκίνησε το Spotify',
          'Επίλεξε themes από το marketplace',
          'Απόλαυσε το προσωποποιημένο σου Spotify!'
        ],
        warning: '⚠️ <strong>Κλείσε το Spotify πριν την εγκατάσταση</strong>'
      },
      'section-titus': {
        title: 'Chris Titus Toolbox',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Ολοκληρωμένο εργαλείο βελτιστοποίησης Windows από τον Chris Titus.',
        features: `
          <strong>Λειτουργίες:</strong>
          <ul>
            <li>🧹 <strong>Debloat Windows</strong> - Αφαίρεση bloatware</li>
            <li>🔒 <strong>Privacy settings</strong> - Βελτίωση απορρήτου</li>
            <li>⚡ <strong>Performance tweaks</strong> - Βελτιστοποίηση απόδοσης</li>
            <li>📦 <strong>Software installation</strong> - Εγκατάσταση απαραίτητων προγραμμάτων</li>
            <li>🛡️ <strong>Security enhancements</strong> - Βελτίωση ασφαλείας</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Κάνε κλικ "Launch Tool"',
          'Ανοίγει PowerShell με το script',
          'Επίλεξε τις λειτουργίες που θέλεις',
          'Παρακολούθησε την εκτέλεση',
          'Επανεκκίνησε για να εφαρμοστούν οι αλλαγές'
        ],
        warning: '⚠️ <strong>Απαιτούνται δικαιώματα διαχειριστή</strong>'
      },
      'section-bios': {
        title: 'BIOS',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Επανεκκινεί απευθείας σε BIOS/UEFI.',
        features: `
          <ul>
            <li>⚡ Επανεκκίνηση με ένα κλικ σε BIOS/UEFI</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Αποθήκευσε την εργασία σου',
          'Κάνε κλικ "Restart to BIOS"',
          'Ρύθμισε ό,τι χρειάζεσαι στο BIOS/UEFI'
        ],
        warning: '⚠️ Άλλαξε μόνο ρυθμίσεις που γνωρίζεις.'
      },
      'section-debloat': {
        title: 'Debloat App',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Debloat μέσω εφαρμογής με toggles και ασφαλέστερα προφίλ.',
        features: `
          <ul>
            <li>🧹 Debloat μέσα από GUI (όχι ωμές εντολές)</li>
            <li>🎚️ Toggles/προφίλ για modules</li>
            <li>💾 Σύσταση για restore point</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Άνοιξε την Debloat εφαρμογή',
          'Επίλεξε προφίλ ή toggles',
          'Τρέξε το cleanup',
          'Κάνε restart αν ζητηθεί'
        ],
        warning: '⚠️ Κράτα restore point πριν από βαριές αλλαγές.'
      },
    }
  }
};
