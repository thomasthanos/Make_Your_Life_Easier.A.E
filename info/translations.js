const translations = {
  en: {
    nav: {
      settings: 'Settings',
      install: 'Install',
      crack: 'Crack',
      maintain: 'Maintain',
      activate: 'Activate',
      bios: 'BIOS',
      spicetify: 'Spicetify',
      passwords: 'Passwords',
      titus: 'Titus',
      debloat: 'Debloat',
      dlc: 'DLC'
    },
    sections: {
      'section-install': {
        title: 'Install Apps',
        whatTitle: 'What does it do?',
        whatDesc: 'Automatically installs popular programs with one click! The application downloads and installs safe versions without viruses or bloatware.',
        features: `
          <strong>Available programs:</strong>
          <ul>
            <li>📱 Discord & Discord PTB</li>
            <li>🎵 Spotify</li>
            <li>🎮 Epic Games Launcher</li>
            <li>🕹️ Ubisoft Connect</li>
            <li>🛠️ Advanced Installer</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Select the programs you want (check the boxes)',
          'Click "Download Selected"',
          'Wait for the download to complete',
          'Follow the installation instructions',
          'Ready! The programs are installed automatically'
        ],
        warning: '⚠️ <strong>Internet connection required</strong>'
      },
      'section-activate': {
        title: 'Activate Windows & Auto Login',
        whatTitle: 'What does it do?',
        whatDesc: 'Activates your Windows and sets up automatic login without a password.',
        features: `
          <strong>Advantages:</strong>
          <ul>
            <li>✅ Remove "Activate Windows" messages</li>
            <li>🚀 Automatic system login</li>
            <li>⚡ Faster startup</li>
            <li>🔧 Full access to all Windows features</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Click "Download & Activate Windows"',
          'Grant administrator permissions when prompted',
          'Wait for the process to complete',
          'Restart your computer',
          'Enable Auto Login for automatic sign-in'
        ],
        warning: '⚠️ <strong>Administrator rights required</strong>'
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
      'section-dlc': {
        title: 'DLC Unlocker',
        whatTitle: 'What does it do?',
        whatDesc: 'Unlocks additional content for games.',
        features: `
          <strong>Available unlockers:</strong>
          <ul>
            <li>🎮 <strong>Sims 4 Installer</strong> - Complete DLC package</li>
            <li>⚡ <strong>EA Unlocker</strong> - Unlock for all EA games</li>
          </ul>
          <strong>Includes:</strong>
          <ul>
            <li>📦 All expansions</li>
            <li>🎒 Cosmetic items</li>
            <li>⚡ Game features</li>
            <li>🔓 Bonus content</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Select the unlocker (Sims or EA)',
          'Click "DOWNLOAD [UNLOCKER]"',
          'Wait for download and extraction',
          'Follow the installer instructions',
          'Open the game and enjoy the DLCs!'
        ],
        warning: '⚠️ <strong>Base game installation required</strong>'
      },
      'section-passwords': {
        title: 'Password Manager',
        whatTitle: 'What does it do?',
        whatDesc: 'Secure storage and management of passwords.',
        features: `
          <strong>Security features:</strong>
          <ul>
            <li>🔐 <strong>Military-grade encryption</strong></li>
            <li>💾 <strong>Local storage</strong> (no cloud)</li>
            <li>⚡ <strong>One-click autofill</strong></li>
            <li>🔍 <strong>Encrypted search</strong></li>
            <li>🛡️ <strong>Zero-knowledge architecture</strong></li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Click "Open Password Manager"',
          'Create a master password',
          'Add your passwords',
          'Use auto-fill to log in',
          'Regularly back up your vault'
        ],
        warning: '💡 <strong>Don\'t forget the master password - it cannot be recovered!</strong>'
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
        title: 'BIOS Settings',
        whatTitle: 'What does it do?',
        whatDesc: 'Restarts into BIOS/UEFI to configure hardware.',
        features: `
          <strong>Common BIOS settings:</strong>
          <ul>
            <li>⚡ <strong>Boot order</strong> - Boot sequence</li>
            <li>💾 <strong>RAM settings</strong> - Memory settings</li>
            <li>🔋 <strong>Power management</strong> - Power management</li>
            <li>🖥️ <strong>CPU settings</strong> - Processor settings</li>
            <li>💨 <strong>Fan control</strong> - Fan control</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Save all your work',
          'Close all applications',
          'Click "Restart to BIOS"',
          'Wait for restart',
          'Configure the desired settings in BIOS'
        ],
        warning: '⚠️ <strong>Wrong settings can cause problems!</strong>'
      },
      'section-debloat': {
        title: 'Debloat Windows',
        whatTitle: 'What does it do?',
        whatDesc: 'Cleans and optimizes Windows using the Raphi script.',
        features: `
          <strong>Bloatware removal:</strong>
          <ul>
            <li>🗑️ <strong>Preinstalled applications</strong></li>
            <li>📱 <strong>Windows suggestions</strong></li>
            <li>🔍 <strong>Bing web search</strong></li>
            <li>📢 <strong>Telemetry & ads</strong></li>
            <li>🎯 <strong>Unnecessary services</strong></li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Click "Run Debloat Script"',
          'Grant administrator permissions',
          'Wait for the script to execute',
          'Follow the on-screen instructions',
          'Restart the system'
        ],
        warning: '⚠️ <strong>Make backup before - changes may not be reversible!</strong>'
      },
      'section-settings': {
        title: 'Application Settings',
        whatTitle: 'What does it do?',
        whatDesc: 'Customizes the application to your preferences.',
        features: `
          <strong>Available settings:</strong>
          <ul>
            <li>🌍 <strong>Language</strong> (English/Ελληνικά)</li>
            <li>🎨 <strong>Theme</strong> (Light/Dark)</li>
            <li>ℹ️ <strong>Application information</strong></li>
            <li>🔄 <strong>Auto-updates</strong></li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Select your preferred language',
          'Change theme from the header button',
          'Press "Save" to save',
          'Click the ℹ️ for information',
          'Enjoy your personalized experience!'
        ],
        warning: '💡 <strong>Changes are applied immediately</strong>'
      }
    }
  },
  gr: {
    nav: {
      settings: 'Ρυθμίσεις',
      install: 'Εγκατάσταση',
      crack: 'Crack',
      maintain: 'Συντήρηση',
      activate: 'Ενεργοποίηση',
      bios: 'BIOS',
      spicetify: 'Spicetify',
      passwords: 'Κωδικοί',
      titus: 'Titus',
      debloat: 'Αφαίρεση',
      dlc: 'DLC'
    },
    sections: {
      'section-install': {
        title: 'Εγκατάσταση Εφαρμογών',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Αυτόματη εγκατάσταση δημοφιλών προγραμμάτων με ένα κλικ! Η εφαρμογή κατεβάζει και εγκαθιστά ασφαλείς εκδόσεις χωρίς ιούς ή bloatware.',
        features: `
          <strong>Διαθέσιμα προγράμματα:</strong>
          <ul>
            <li>📱 Discord & Discord PTB</li>
            <li>🎵 Spotify</li>
            <li>🎮 Epic Games Launcher</li>
            <li>🕹️ Ubisoft Connect</li>
            <li>🛠️ Advanced Installer</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Επίλεξε τα προγράμματα που θέλεις (βάλε tick)',
          'Πάτα "Download Selected"',
          'Περίμενε να ολοκληρωθεί η λήψη',
          'Ακολούθησε τις οδηγίες εγκατάστασης',
          'Έτοιμο! Τα προγράμματα εγκαταστάθηκαν αυτόματα'
        ],
        warning: '⚠️ <strong>Απαιτείται σύνδεση στο internet</strong>'
      },
      'section-activate': {
        title: 'Ενεργοποίηση Windows & Auto Login',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Ενεργοποιεί το Windows σου και ρυθμίζει αυτόματη σύνδεση χωρίς κωδικό.',
        features: `
          <strong>Πλεονεκτήματα:</strong>
          <ul>
            <li>✅ Διαγραφή μηνυμάτων "Activate Windows"</li>
            <li>🚀 Αυτόματη είσοδος στο σύστημα</li>
            <li>⚡ Γρηγορότερη εκκίνηση</li>
            <li>🔧 Πλήρης πρόσβαση σε όλες τις λειτουργίες Windows</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Κάνε κλικ στο "Download & Activate Windows"',
          'Δώσε δικαιώματα διαχειριστή όταν ζητηθεί',
          'Περίμενε να ολοκληρωθεί η διαδικασία',
          'Επανεκκίνησε τον υπολογιστή σου',
          'Ενεργοποίησε το Auto Login για αυτόματη σύνδεση'
        ],
        warning: '⚠️ <strong>Απαιτούνται δικαιώματα διαχειριστή</strong>'
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
      'section-dlc': {
        title: 'DLC Unlocker',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Ξεκλειδώνει πρόσθετο περιεχόμενο για παιχνίδια.',
        features: `
          <strong>Διαθέσιμα unlockers:</strong>
          <ul>
            <li>🎮 <strong>Sims 4 Installer</strong> - Πλήρες DLC package</li>
            <li>⚡ <strong>EA Unlocker</strong> - Ξεκλείδωμα για όλα τα EA games</li>
          </ul>
          <strong>Περιλαμβάνει:</strong>
          <ul>
            <li>📦 Όλες τις επεκτάσεις</li>
            <li>🎒 Cosmetic items</li>
            <li>⚡ Game features</li>
            <li>🔓 Bonus content</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Επίλεξε το unlocker (Sims ή EA)',
          'Κάνε κλικ "DOWNLOAD [UNLOCKER]"',
          'Περίμενε λήψη και εξαγωγή',
          'Ακολούθησε τις οδηγίες του installer',
          'Άνοιξε το παιχνίδι και απόλαυσε τα DLCs!'
        ],
        warning: '⚠️ <strong>Απαιτείται το βασικό παιχνίδι εγκατεστημένο</strong>'
      },
      'section-passwords': {
        title: 'Διαχειριστής Κωδικών',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Ασφαλής αποθήκευση και διαχείριση κωδικών πρόσβασης.',
        features: `
          <strong>Χαρακτηριστικά ασφαλείας:</strong>
          <ul>
            <li>🔐 <strong>Military-grade encryption</strong></li>
            <li>💾 <strong>Τοπική αποθήκευση</strong> (όχι cloud)</li>
            <li>⚡ <strong>One-click autofill</strong></li>
            <li>🔍 <strong>Encrypted search</strong></li>
            <li>🛡️ <strong>Zero-knowledge architecture</strong></li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Κάνε κλικ "Open Password Manager"',
          'Δημιούργησε master password',
          'Πρόσθεσε τους κωδικούς σου',
          'Χρησιμοποίησε auto-fill για σύνδεση',
          'Κάνε backup τακτικά το vault σου'
        ],
        warning: '💡 <strong>Μην ξεχάσεις το master password - δεν μπορεί να ανακτηθεί!</strong>'
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
        title: 'BIOS Settings',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Επανεκκίνηση στο BIOS/UEFI για ρύθμιση hardware.',
        features: `
          <strong>Συνήθεις ρυθμίσεις BIOS:</strong>
          <ul>
            <li>⚡ <strong>Boot order</strong> - Σειρά εκκίνησης</li>
            <li>💾 <strong>RAM settings</strong> - Ρυθμίσεις μνήμης</li>
            <li>🔋 <strong>Power management</strong> - Διαχείριση ενέργειας</li>
            <li>🖥️ <strong>CPU settings</strong> - Ρυθμίσεις επεξεργαστή</li>
            <li>💨 <strong>Fan control</strong> - Έλεγχος ανεμιστήρων</li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Αποθήκευσε όλη σου την εργασία',
          'Κλείσε όλες τις εφαρμογές',
          'Κάνε κλικ "Restart to BIOS"',
          'Περίμενε επανεκκίνηση',
          'Ρύθμισε τις επιθυμητές ρυθμίσεις στο BIOS'
        ],
        warning: '⚠️ <strong>Λάθος ρυθμίσεις μπορεί να προκαλέσουν προβλήματα!</strong>'
      },
      'section-debloat': {
        title: 'Debloat Windows',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Καθαρισμός και βελτιστοποίηση Windows με το Raphi script.',
        features: `
          <strong>Αφαίρεση bloatware:</strong>
          <ul>
            <li>🗑️ <strong>Προεγκατεστημένες εφαρμογές</strong></li>
            <li>📱 <strong>Windows suggestions</strong></li>
            <li>🔍 <strong>Bing web search</strong></li>
            <li>📢 <strong>Telemetry & ads</strong></li>
            <li>🎯 <strong>Unnecessary services</strong></li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Κάνε κλικ "Run Debloat Script"',
          'Δώσε δικαιώματα διαχειριστή',
          'Περίμενε εκτέλεση του script',
          'Ακολούθησε τις οδηγίες στην οθόνη',
          'Επανεκκίνησε το σύστημα'
        ],
        warning: '⚠️ <strong>Κάνε backup πριν - οι αλλαγές μπορεί να μην είναι αναστρέψιμες!</strong>'
      },
      'section-settings': {
        title: 'Ρυθμίσεις Εφαρμογής',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Προσαρμογή της εφαρμογής στις προτιμήσεις σου.',
        features: `
          <strong>Διαθέσιμες ρυθμίσεις:</strong>
          <ul>
            <li>🌍 <strong>Γλώσσα</strong> (English/Ελληνικά)</li>
            <li>🎨 <strong>Θέμα</strong> (Light/Dark)</li>
            <li>ℹ️ <strong>Πληροφορίες εφαρμογής</strong></li>
            <li>🔄 <strong>Auto-updates</strong></li>
          </ul>
        `,
        howTitle: 'Οδηγίες Χρήσης',
        steps: [
          'Επίλεξε τη γλώσσα που προτιμάς',
          'Αλλαγή θέματος από το κουμπί στην κεφαλίδα',
          'Πάτα "Save" για αποθήκευση',
          'Κάνε κλικ στο ℹ️ για πληροφορίες',
          'Απόλαυσε την προσωποποιημένη σου εμπειρία!'
        ],
        warning: '💡 <strong>Οι αλλαγές εφαρμόζονται αμέσως</strong>'
      }
    }
  }
};