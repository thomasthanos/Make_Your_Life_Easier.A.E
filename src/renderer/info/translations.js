const translations = {
  en: {
    nav: {
      menu: 'Menu',
      install: 'Install',
      crack: 'Apps',
      maintain: 'Maintain',
      activate: 'Activate',
      bios: 'BIOS',
      spicetify: 'Spicetify',
      titus: 'Titus',
      debloat: 'Debloat'
    },
    sections: {
      'section-menu': {
        title: 'Menu, Language & Help',
        whatTitle: 'What does it do?',
        whatDesc: 'The top menu gives quick access to the app language, the help/info panel, and the compact sidebar layout.',
        features: `
          <ul>
            <li>Switch the app between English and Greek with the EN/GR button.</li>
            <li>Open this help panel again from the info button.</li>
            <li>Collapse or expand the sidebar from the title-bar arrow.</li>
            <li>Close the dropdown automatically by clicking outside it.</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Click the menu button in the title bar.',
          'Use EN/GR to change the app language instantly.',
          'Use the info button to reopen this guide.',
          'Use the sidebar arrow when you want more space for the main page.'
        ],
        warning: 'Language changes are saved locally and applied when the app refreshes its pages.'
      },
      'section-install': {
        title: 'Install Apps',
        whatTitle: 'What does it do?',
        whatDesc: 'Search, select, install, uninstall, and manage common apps from one categorized installer page.',
        features: `
          <ul>
            <li>Categorized app list for browsers, games, media, development, security, hardware, and utilities.</li>
            <li>Search box with fast filtering across all available apps.</li>
            <li>Multi-select install and uninstall actions.</li>
            <li>Check Installed marks apps that already exist on the PC.</li>
            <li>Import and export selected app lists as JSON.</li>
            <li>Custom download entries are mixed with winget packages where needed.</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Search for an app or browse the categories.',
          'Select one or more apps.',
          'Use Check Installed if you want the app to detect what is already installed.',
          'Click Install Selected or Uninstall Selected.',
          'Optionally export your selected list and import it again later.'
        ],
        warning: 'Internet access is required. Some installers may request administrator permissions.'
      },
      'section-activate': {
        title: 'Activation & Auto Login',
        whatTitle: 'What does it do?',
        whatDesc: 'Provides quick launch cards for the configured Windows activation script and the Auto Login setup tool.',
        features: `
          <ul>
            <li>Downloads and runs the activation script from the configured source.</li>
            <li>Downloads and runs the Auto Login helper.</li>
            <li>Shows download progress directly on the button.</li>
            <li>Restores the button state after the tool starts.</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Open the Activate page.',
          'Choose Activate Windows or Auto Login.',
          'Wait for the download to finish.',
          'Approve administrator prompts if Windows asks.',
          'Follow the external tool or script window.'
        ],
        warning: 'These actions can change Windows settings. Use them only when you understand the result.'
      },
      'section-maintain': {
        title: 'System Maintenance',
        whatTitle: 'What does it do?',
        whatDesc: 'Groups cleanup, network, repair, diagnostic, and updater tools into one maintenance dashboard.',
        features: `
          <ul>
            <li>Cleanup: temp files, Recycle Bin, Windows cache, thumbnails, error reports, and Disk Cleanup.</li>
            <li>Network: flush DNS, release/renew IP, Bluetooth repair, and network reset.</li>
            <li>Repair: SFC, DISM, check disk, and restart Windows audio services.</li>
            <li>Tools: download and run Patch My PC for third-party app updates.</li>
            <li>Toasts and short status feedback show success or failure.</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Pick the maintenance section you need.',
          'Click the card action for the specific task.',
          'Approve administrator permissions when required.',
          'Wait for the toast or status message.',
          'Restart Windows after repair or reset tasks if needed.'
        ],
        warning: 'Repair, network reset, cache cleanup, and disk tools can affect active apps. Save your work first.'
      },
      'section-crack': {
        title: 'Configured App Downloads',
        whatTitle: 'What does it do?',
        whatDesc: 'Manages your configured direct-download app packages with progress tracking, extraction, and launch helpers.',
        features: `
          <ul>
            <li>Shows configured software cards with download buttons.</li>
            <li>Tracks download progress even if you switch pages.</li>
            <li>Extracts archives when needed.</li>
            <li>Finds and opens installer files after extraction.</li>
            <li>Includes special handling for packages that need a follow-up executable.</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Choose the configured package you want.',
          'Start the download from its card.',
          'Wait for download and extraction.',
          'Follow any installer that opens.',
          'Use only packages you are allowed to install.'
        ],
        warning: 'Only download and install software you have the right to use.'
      },
      'section-spicetify': {
        title: 'Spicetify Spotify',
        whatTitle: 'What does it do?',
        whatDesc: 'Installs, removes, or fully cleans Spotify customization tools from the Spicetify page.',
        features: `
          <ul>
            <li>Install Spicetify for Spotify themes and customizations.</li>
            <li>Uninstall Spicetify and restore Spotify behavior.</li>
            <li>Full uninstall option for removing Spotify more aggressively.</li>
            <li>Shows command output and toast feedback for each action.</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Close Spotify before making changes.',
          'Choose Install Spicetify, Uninstall Spicetify, or Full Uninstall Spotify.',
          'Wait for the action to finish.',
          'Restart Spotify after installation or removal.',
          'Check the output area if something fails.'
        ],
        warning: 'Close Spotify first to avoid locked files or incomplete changes.'
      },
      'section-titus': {
        title: 'Chris Titus Toolbox',
        whatTitle: 'What does it do?',
        whatDesc: 'Launches the Chris Titus Windows Utility in PowerShell and links to the project page.',
        features: `
          <ul>
            <li>Runs the Chris Titus Windows utility command.</li>
            <li>Opens a new PowerShell window when the Electron bridge is available.</li>
            <li>Provides a GitHub button for the original project.</li>
            <li>Useful for advanced debloat, privacy, update, and software tasks.</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Open the Titus page.',
          'Click Launch Tool.',
          'Follow the PowerShell window instructions.',
          'Use the GitHub button if you want to inspect the source.',
          'Restart Windows after major changes.'
        ],
        warning: 'This is an advanced external toolbox. Review choices before applying them.'
      },
      'section-bios': {
        title: 'BIOS / UEFI',
        whatTitle: 'What does it do?',
        whatDesc: 'Shows a confirmation dialog and restarts the PC directly into BIOS/UEFI settings.',
        features: `
          <ul>
            <li>Explains what will happen before restarting.</li>
            <li>Uses a confirmation dialog to prevent accidental restart.</li>
            <li>Runs the restart-to-firmware command through the app API.</li>
            <li>Returns to the first page if you cancel.</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Save your work and close active programs.',
          'Open the BIOS page.',
          'Read the confirmation dialog.',
          'Click Restart to BIOS only when you are ready.',
          'Change only BIOS/UEFI settings you understand.'
        ],
        warning: 'Your PC will restart immediately after confirmation.'
      },
      'section-debloat': {
        title: 'Debloat',
        whatTitle: 'What does it do?',
        whatDesc: 'Downloads or launches the Sparkle debloat utility for Windows cleanup, optimization, and privacy tweaks.',
        features: `
          <ul>
            <li>Checks whether the Sparkle utility is already available.</li>
            <li>Downloads Sparkle when needed and tracks progress.</li>
            <li>Processes the downloaded package before launch.</li>
            <li>Runs the utility for Windows debloat and optimization tasks.</li>
            <li>Shows warnings because the tool can remove apps and change system settings.</li>
          </ul>
        `,
        howTitle: 'How to use it?',
        steps: [
          'Open the Debloat page.',
          'Read the warning text carefully.',
          'Click the run button.',
          'Wait for download or launch.',
          'Choose debloat options carefully inside the external utility.'
        ],
        warning: 'Create a restore point before heavy debloat or privacy changes.'
      }
    }
  },
  gr: {
    nav: {
      menu: 'Μενού',
      install: 'Εγκατάσταση',
      crack: 'Apps',
      maintain: 'Συντήρηση',
      activate: 'Ενεργοποίηση',
      bios: 'BIOS',
      spicetify: 'Spicetify',
      titus: 'Titus',
      debloat: 'Debloat'
    },
    sections: {
      'section-menu': {
        title: 'Μενού, Γλώσσα & Βοήθεια',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Το επάνω μενού δίνει γρήγορη πρόσβαση στη γλώσσα της εφαρμογής, στο info panel και στη συμπτυγμένη πλαϊνή μπάρα.',
        features: `
          <ul>
            <li>Αλλάζει την εφαρμογή ανάμεσα σε English και Ελληνικά με το EN/GR.</li>
            <li>Ανοίγει ξανά αυτό το help/info panel από το κουμπί info.</li>
            <li>Κάνει collapse ή expand το sidebar από το βελάκι στη title bar.</li>
            <li>Κλείνει αυτόματα το dropdown όταν κάνεις κλικ έξω από αυτό.</li>
          </ul>
        `,
        howTitle: 'Πώς το χρησιμοποιείς;',
        steps: [
          'Πάτα το κουμπί μενού στη title bar.',
          'Πάτα EN/GR για να αλλάξεις γλώσσα άμεσα.',
          'Πάτα το info για να ανοίξεις ξανά αυτόν τον οδηγό.',
          'Πάτα το βελάκι του sidebar όταν θέλεις περισσότερο χώρο στο κεντρικό panel.'
        ],
        warning: 'Η επιλογή γλώσσας αποθηκεύεται τοπικά και εφαρμόζεται όταν ανανεώνονται οι σελίδες της εφαρμογής.'
      },
      'section-install': {
        title: 'Εγκατάσταση Εφαρμογών',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Αναζήτηση, επιλογή, εγκατάσταση, απεγκατάσταση και διαχείριση εφαρμογών από μία κατηγοριοποιημένη σελίδα.',
        features: `
          <ul>
            <li>Κατηγορίες για browsers, games, media, development, security, hardware και utilities.</li>
            <li>Γρήγορη αναζήτηση και φιλτράρισμα σε όλες τις διαθέσιμες εφαρμογές.</li>
            <li>Multi-select για εγκατάσταση ή απεγκατάσταση πολλών εφαρμογών.</li>
            <li>Check Installed για να σημειώνει τι υπάρχει ήδη στον υπολογιστή.</li>
            <li>Import και export λιστών επιλογής σε JSON.</li>
            <li>Υποστηρίζει winget packages και custom download entries όπου χρειάζεται.</li>
          </ul>
        `,
        howTitle: 'Πώς το χρησιμοποιείς;',
        steps: [
          'Ψάξε εφαρμογή ή άνοιξε την κατηγορία που θέλεις.',
          'Επίλεξε μία ή περισσότερες εφαρμογές.',
          'Πάτα Check Installed αν θέλεις έλεγχο για ήδη εγκατεστημένες εφαρμογές.',
          'Πάτα Install Selected ή Uninstall Selected.',
          'Προαιρετικά κάνε export τη λίστα σου και import αργότερα.'
        ],
        warning: 'Χρειάζεται internet. Μερικοί installers μπορεί να ζητήσουν δικαιώματα διαχειριστή.'
      },
      'section-activate': {
        title: 'Ενεργοποίηση & Auto Login',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Δίνει γρήγορες κάρτες για το Windows activation script και το Auto Login setup tool που έχεις ρυθμίσει.',
        features: `
          <ul>
            <li>Κατεβάζει και τρέχει το activation script από την καθορισμένη πηγή.</li>
            <li>Κατεβάζει και τρέχει το Auto Login helper.</li>
            <li>Δείχνει progress κατεβάσματος πάνω στο κουμπί.</li>
            <li>Επαναφέρει την κατάσταση του κουμπιού όταν ξεκινήσει το εργαλείο.</li>
          </ul>
        `,
        howTitle: 'Πώς το χρησιμοποιείς;',
        steps: [
          'Άνοιξε τη σελίδα Activate.',
          'Διάλεξε Activate Windows ή Auto Login.',
          'Περίμενε να ολοκληρωθεί το download.',
          'Δώσε δικαιώματα διαχειριστή αν τα ζητήσει το Windows.',
          'Ακολούθησε το εξωτερικό tool ή script window.'
        ],
        warning: 'Αυτές οι ενέργειες αλλάζουν ρυθμίσεις Windows. Χρησιμοποίησέ τες μόνο όταν ξέρεις τι κάνουν.'
      },
      'section-maintain': {
        title: 'Συντήρηση Συστήματος',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Μαζεύει εργαλεία cleanup, network, repair, diagnostics και updates σε ένα maintenance dashboard.',
        features: `
          <ul>
            <li>Cleanup: temp files, Recycle Bin, Windows cache, thumbnails, error reports και Disk Cleanup.</li>
            <li>Network: flush DNS, release/renew IP, Bluetooth repair και network reset.</li>
            <li>Repair: SFC, DISM, check disk και επανεκκίνηση Windows audio services.</li>
            <li>Tools: download και run του Patch My PC για ενημέρωση third-party εφαρμογών.</li>
            <li>Toasts και μικρά status messages δείχνουν επιτυχία ή αποτυχία.</li>
          </ul>
        `,
        howTitle: 'Πώς το χρησιμοποιείς;',
        steps: [
          'Διάλεξε το maintenance section που χρειάζεσαι.',
          'Πάτα την ενέργεια στην αντίστοιχη κάρτα.',
          'Δώσε δικαιώματα διαχειριστή όπου ζητηθούν.',
          'Περίμενε το toast ή status message.',
          'Κάνε restart μετά από repair ή reset εργασίες αν χρειάζεται.'
        ],
        warning: 'Repair, network reset, cache cleanup και disk tools μπορούν να επηρεάσουν ανοιχτές εφαρμογές. Αποθήκευσε τη δουλειά σου πρώτα.'
      },
      'section-crack': {
        title: 'Configured App Downloads',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Διαχειρίζεται τα direct-download app packages που έχεις ρυθμίσει, με progress tracking, extraction και launch helpers.',
        features: `
          <ul>
            <li>Δείχνει configured software cards με download buttons.</li>
            <li>Κρατάει download progress ακόμα και αν αλλάξεις σελίδα.</li>
            <li>Κάνει extraction σε archives όπου χρειάζεται.</li>
            <li>Βρίσκει και ανοίγει installers μετά το extraction.</li>
            <li>Υποστηρίζει ειδικά follow-up executables για packages που τα χρειάζονται.</li>
          </ul>
        `,
        howTitle: 'Πώς το χρησιμοποιείς;',
        steps: [
          'Διάλεξε το configured package που θέλεις.',
          'Ξεκίνα το download από την κάρτα του.',
          'Περίμενε το download και το extraction.',
          'Ακολούθησε τον installer που θα ανοίξει.',
          'Χρησιμοποίησε μόνο packages που έχεις δικαίωμα να εγκαταστήσεις.'
        ],
        warning: 'Κατέβαζε και εγκαθιστούσε μόνο λογισμικό που έχεις δικαίωμα να χρησιμοποιείς.'
      },
      'section-spicetify': {
        title: 'Spicetify Spotify',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Εγκαθιστά, αφαιρεί ή καθαρίζει πλήρως Spotify customization tools από τη σελίδα Spicetify.',
        features: `
          <ul>
            <li>Install Spicetify για themes και customizations στο Spotify.</li>
            <li>Uninstall Spicetify για επαναφορά της συμπεριφοράς του Spotify.</li>
            <li>Full uninstall option για πιο επιθετική αφαίρεση Spotify.</li>
            <li>Δείχνει command output και toast feedback για κάθε ενέργεια.</li>
          </ul>
        `,
        howTitle: 'Πώς το χρησιμοποιείς;',
        steps: [
          'Κλείσε το Spotify πριν κάνεις αλλαγές.',
          'Διάλεξε Install Spicetify, Uninstall Spicetify ή Full Uninstall Spotify.',
          'Περίμενε να τελειώσει η ενέργεια.',
          'Άνοιξε ξανά το Spotify μετά την εγκατάσταση ή αφαίρεση.',
          'Δες το output area αν κάτι αποτύχει.'
        ],
        warning: 'Κλείσε πρώτα το Spotify για να μη μείνουν locked files ή μισές αλλαγές.'
      },
      'section-titus': {
        title: 'Chris Titus Toolbox',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Τρέχει το Chris Titus Windows Utility σε PowerShell και δίνει σύνδεσμο για το project page.',
        features: `
          <ul>
            <li>Τρέχει το command του Chris Titus Windows utility.</li>
            <li>Ανοίγει νέο PowerShell window όταν υπάρχει διαθέσιμο Electron bridge.</li>
            <li>Έχει GitHub button για το original project.</li>
            <li>Χρήσιμο για advanced debloat, privacy, update και software tasks.</li>
          </ul>
        `,
        howTitle: 'Πώς το χρησιμοποιείς;',
        steps: [
          'Άνοιξε τη σελίδα Titus.',
          'Πάτα Launch Tool.',
          'Ακολούθησε τις οδηγίες στο PowerShell window.',
          'Πάτα GitHub αν θέλεις να δεις την πηγή.',
          'Κάνε restart μετά από μεγάλες αλλαγές.'
        ],
        warning: 'Είναι advanced εξωτερικό toolbox. Έλεγξε τις επιλογές πριν τις εφαρμόσεις.'
      },
      'section-bios': {
        title: 'BIOS / UEFI',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Δείχνει confirmation dialog και κάνει restart τον υπολογιστή απευθείας σε BIOS/UEFI settings.',
        features: `
          <ul>
            <li>Εξηγεί τι θα συμβεί πριν γίνει restart.</li>
            <li>Χρησιμοποιεί confirmation dialog για να μη γίνει κατά λάθος restart.</li>
            <li>Τρέχει το restart-to-firmware command μέσω του app API.</li>
            <li>Επιστρέφει στην πρώτη σελίδα αν κάνεις cancel.</li>
          </ul>
        `,
        howTitle: 'Πώς το χρησιμοποιείς;',
        steps: [
          'Αποθήκευσε τη δουλειά σου και κλείσε ανοιχτά προγράμματα.',
          'Άνοιξε τη σελίδα BIOS.',
          'Διάβασε το confirmation dialog.',
          'Πάτα Restart to BIOS μόνο όταν είσαι έτοιμος.',
          'Άλλαξε μόνο BIOS/UEFI ρυθμίσεις που καταλαβαίνεις.'
        ],
        warning: 'Ο υπολογιστής θα κάνει restart αμέσως μετά την επιβεβαίωση.'
      },
      'section-debloat': {
        title: 'Debloat',
        whatTitle: 'Τι κάνει;',
        whatDesc: 'Κατεβάζει ή ανοίγει το Sparkle debloat utility για Windows cleanup, optimization και privacy tweaks.',
        features: `
          <ul>
            <li>Ελέγχει αν το Sparkle utility υπάρχει ήδη.</li>
            <li>Κατεβάζει το Sparkle όταν χρειάζεται και δείχνει progress.</li>
            <li>Επεξεργάζεται το downloaded package πριν το launch.</li>
            <li>Τρέχει το utility για Windows debloat και optimization tasks.</li>
            <li>Δείχνει warning γιατί το εργαλείο μπορεί να αφαιρέσει apps και να αλλάξει system settings.</li>
          </ul>
        `,
        howTitle: 'Πώς το χρησιμοποιείς;',
        steps: [
          'Άνοιξε τη σελίδα Debloat.',
          'Διάβασε προσεκτικά το warning text.',
          'Πάτα το run button.',
          'Περίμενε το download ή το launch.',
          'Διάλεξε προσεκτικά options μέσα στο εξωτερικό utility.'
        ],
        warning: 'Φτιάξε restore point πριν από βαριές debloat ή privacy αλλαγές.'
      }
    }
  }
};
