class PasswordManager {
    constructor() {
        this.categories = [];
        this.passwords = [];
        this.currentCategory = 'all';
        this.currentEditingId = null;
        this.stats = {
            total: 0,
            weak: 0,
            reused: 0,
            categories: 0
        };
        // Load compact mode preference from localStorage (defaults to false)
        const storedMode = localStorage.getItem('pmCompactMode');
        this.isCompactMode = storedMode !== null ? storedMode === 'true' : false;
        this.isAuthenticated = false;

        // Optional Imgur client token used for uploading images.  If you wish to
        // upload selected images to Imgur rather than store them locally, set
        // this property or save 'imgurToken' in localStorage to your Client ID.
        this.imgurToken = null;
        
        // Initialize auth UI first
        this.authUI = new PasswordManagerAuthUI();
        this.observeCards = () => {}; // Προσωρινή κενή συνάρτηση

        // Determine the application language.  First check the saved settings in localStorage (myAppSettings.lang).
        // Fall back to the <html> lang attribute.  Accept both "gr" and "el" codes as Greek. Default to English otherwise.
        let langSetting = null;
        try {
            const settings = JSON.parse(localStorage.getItem('myAppSettings'));
            if (settings && typeof settings.lang === 'string' && settings.lang.length > 0) {
                langSetting = settings.lang.toLowerCase();
            }
        } catch (e) {
            // ignore parsing errors
        }
        const docLang = (document.documentElement.lang || 'en').toLowerCase();
        const selectedLang = langSetting || docLang;
        this.lang = (selectedLang.startsWith('gr') || selectedLang.startsWith('el')) ? 'gr' : 'en';
        // Translation table for key UI strings used in the password manager.  Extend as needed.
        this.translations = {
            en: {
                add_password_btn: '+ Add Password',
                manage_categories_btn: '🏷️ Manage Categories',
                search_placeholder: 'Search passwords, usernames, emails...',
                cancel: 'Cancel',
                save_password: '💾 Save Password',
                no_category_option: 'No Category',
                title_label: 'Title *',
                password_label: 'Password *',
                url_label: 'Website URL',
                category_label: 'Category',
                username_label: 'Username',
                notes_label: 'Notes',
                email_label: 'Email',
                title_placeholder: 'Enter service name',
                password_placeholder: 'Enter password',
                url_placeholder: 'https://example.com',
                username_placeholder: 'Enter username',
                notes_placeholder: 'Additional notes...',
                email_placeholder: 'name@domain',
                modal_add_title: 'Add New Password',
                modal_edit_title: 'Edit Password',
                all_categories: 'All',
                no_passwords_yet: 'No Passwords Yet',
                first_password_desc: 'Add your first password to secure your digital life',
                add_first_password: 'Add Your First Password'
                ,
                // Additional keys for stats, labels and various UI texts
                stats_total: 'Total Passwords',
                // Number of passwords that are considered strong
                stats_strong: 'Strong',
                stats_weak: 'Weak Passwords',
                stats_categories: 'Categories',
                stats_reused: 'Reused',
                category_no_results: 'No categories found',
                category_create_first: 'Create your first category to organize passwords',
                edit: 'Edit',
                delete: 'Delete',
                username_field: 'Username',
                email_field: 'Email',
                password_field: 'Password',
                website_field: 'Website',
                notes_field: 'Notes',
                last_updated_field: 'Last Updated',
                unknown: 'Unknown',
                no_username_email: 'No username/email',
                // Text for the bottom link on each card
                open_website: 'Visit site',
                open_in_browser: 'Open in default browser',
                copy_username: 'Copy username',
                copy_email: 'Copy email',
                copy_password: 'Copy password',
                reveal_password: 'Reveal password',
                hide_password: 'Hide password',
                strong_password_generated: 'Strong password generated!',
                copied_to_clipboard: 'Copied to clipboard!',
                failed_copy: 'Failed to copy to clipboard. Please copy manually.'
                ,
                password_manager_unlocked: 'Password Manager unlocked!'
                ,
                compact_mode: '📱 Compact Mode',
                normal_mode: '📱 Normal Mode'
                ,
                new_category_prompt: 'Enter new category name:'
            },
            gr: {
                add_password_btn: '+ Προσθήκη Κωδικού',
                manage_categories_btn: '🏷️ Διαχείριση Κατηγοριών',
                search_placeholder: 'Αναζήτηση κωδικών, usernames, emails...',
                cancel: 'Ακύρωση',
                save_password: '💾 Αποθήκευση Κωδικού',
                no_category_option: 'Χωρίς Κατηγορία',
                title_label: 'Τίτλος *',
                password_label: 'Κωδικός *',
                url_label: 'Ιστότοπος URL',
                category_label: 'Κατηγορία',
                username_label: 'Όνομα χρήστη',
                notes_label: 'Σημειώσεις',
                email_label: 'Email',
                title_placeholder: 'Όνομα υπηρεσίας',
                password_placeholder: 'Κωδικός',
                url_placeholder: 'https://example.com',
                username_placeholder: 'Όνομα χρήστη',
                notes_placeholder: 'Επιπλέον σημειώσεις...',
                email_placeholder: 'όνομα@domain',
                modal_add_title: 'Προσθήκη Νέου Κωδικού',
                modal_edit_title: 'Επεξεργασία Κωδικού',
                all_categories: 'Όλα',
                no_passwords_yet: 'Δεν υπάρχουν κωδικοί ακόμα',
                first_password_desc: 'Προσθέστε τον πρώτο σας κωδικό για να ασφαλίσετε την ψηφιακή σας ζωή',
                add_first_password: 'Προσθέστε τον πρώτο σας κωδικό'
                ,
                // Additional keys for stats, labels and various UI texts in Greek
                stats_total: 'Σύνολο Κωδικών',
                // Number of passwords that are considered strong
                stats_strong: 'Ισχυροί',
                stats_weak: 'Αδύναμοι Κωδικοί',
                stats_categories: 'Κατηγορίες',
                stats_reused: 'Επαναχρησιμοποιημένοι',
                category_no_results: 'Δεν βρέθηκαν κατηγορίες',
                category_create_first: 'Δημιουργήστε την πρώτη σας κατηγορία για να οργανώσετε κωδικούς',
                edit: 'Επεξεργασία',
                delete: 'Διαγραφή',
                username_field: 'Όνομα χρήστη',
                email_field: 'Email',
                password_field: 'Κωδικός',
                website_field: 'Ιστοσελίδα',
                notes_field: 'Σημειώσεις',
                last_updated_field: 'Τελευταία ενημέρωση',
                unknown: 'Άγνωστο',
                no_username_email: 'Χωρίς όνομα χρήστη/email',
                // Text for the bottom link on each card (Greek)
                open_website: 'Επίσκεψη ιστότοπου',
                open_in_browser: 'Άνοιγμα στον προεπιλεγμένο browser',
                copy_username: 'Αντιγραφή ονόματος χρήστη',
                copy_email: 'Αντιγραφή email',
                copy_password: 'Αντιγραφή κωδικού',
                reveal_password: 'Προβολή κωδικού',
                hide_password: 'Απόκρυψη κωδικού',
                strong_password_generated: 'Δημιουργήθηκε ισχυρός κωδικός!',
                copied_to_clipboard: 'Αντιγράφηκε στο πρόχειρο!',
                failed_copy: 'Αποτυχία αντιγραφής στο πρόχειρο. Αντιγράψτε χειροκίνητα.'
                ,
                password_manager_unlocked: 'Ο διαχειριστής κωδικών ξεκλειδώθηκε!'
                ,
                compact_mode: '📱 Συμπαγής Λειτουργία',
                normal_mode: '📱 Κανονική Λειτουργία'
                ,
                new_category_prompt: 'Εισάγετε νέα κατηγορία:'
            }
        };

        this.eventsInitialized = false;
        this.isDataLoaded = false;
        this.svgCopy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
        this.svgEye = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
        this.svgEyeOff = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="svg-icon"><path fill="currentColor" d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z"/><path fill="currentColor" d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829"/><path fill="currentColor" d="M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z"/></svg>`;

        setTimeout(() => {
            this.initializeEventListeners();
            this.initializeAuth();
            this.initializeAnimations();
            this.applyTranslations();
        }, 1000);
    }

    async initializeAuth() {
        try {
            await this.authUI.initialize();
            // Μην φορτώσεις τα δεδομένα αμέσως - περιμένει την επιτυχή πιστοποίηση
        } catch (error) {
            console.error('Auth initialization failed:', error);
        }
    }
    // Νέα μέθοδος που καλείται όταν η πιστοποίηση είναι επιτυχής
    async onAuthSuccess() {
        // Prevent reloading data multiple times if onAuthSuccess is called again.
        if (this.isDataLoaded) {
            return;
        }

        this.isAuthenticated = true;
        // Load all categories and passwords once after authentication
        await this.loadData();
        this.isDataLoaded = true;
        // Use translated notification when the password manager is unlocked
        this.showSuccess(this.t('password_manager_unlocked'));
    }

    initializeEventListeners() {
        // Prevent attaching duplicate event listeners if this method is called
        // more than once.  Duplicate listeners cause handlers (like savePassword)
        // to fire multiple times, resulting in duplicated actions and logs.
        if (this.eventsInitialized) {
            return;
        }
        this.eventsInitialized = true;

        // Password modal
        document.getElementById('addPasswordBtn').addEventListener('click', () => this.openPasswordModal());
        document.getElementById('closePasswordModal').addEventListener('click', () => this.closePasswordModal());
        document.getElementById('cancelPasswordBtn').addEventListener('click', () => this.closePasswordModal());
        document.getElementById('passwordForm').addEventListener('submit', (e) => this.savePassword(e));

        // Categories modal: Only attach listeners if the elements exist
        const manageBtn = document.getElementById('manageCategoriesBtn');
        if (manageBtn) {
            manageBtn.addEventListener('click', () => this.openCategoriesModal());
        }
        const closeCategoriesModal = document.getElementById('closeCategoriesModal');
        if (closeCategoriesModal) {
            closeCategoriesModal.addEventListener('click', () => this.closeCategoriesModal());
        }
        const closeCategoriesBtn = document.getElementById('closeCategoriesBtn');
        if (closeCategoriesBtn) {
            closeCategoriesBtn.addEventListener('click', () => this.closeCategoriesModal());
        }
        const addCategoryBtn = document.getElementById('addCategoryBtn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => this.addCategory());
        }

        // Search with debounce
        let searchTimeout;
        document.getElementById('searchInput').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.searchPasswords(e.target.value), 300);
        });

        // Password strength indicator
        document.getElementById('password').addEventListener('input', (e) => this.checkPasswordStrength(e.target.value));

        // Generate password button
        document.getElementById('password').addEventListener('focus', () => {
            this.addGeneratePasswordButton();
        });

        // Image file selection
        const imageFileInput = document.getElementById('imageFile');
        if (imageFileInput) {
            imageFileInput.addEventListener('change', (e) => this.handleImageSelection(e));
            // Bind the click on the upload box to trigger the hidden file input
            const uploadBox = document.getElementById('imageUploadBox');
            if (uploadBox) {
                uploadBox.addEventListener('click', () => {
                    // Trigger the file input when the box is clicked
                    imageFileInput.click();
                });
            }
        }

        // Auto‑fetch site logo when the user finishes entering a URL and no
        // image has been selected.  When the URL input loses focus (blur),
        // attempt to retrieve the favicon for the domain if the hidden
        // imageData input is empty.  This does not override a manually
        // uploaded image.
        const urlInput = document.getElementById('url');
        if (urlInput) {
            urlInput.addEventListener('blur', (e) => {
                const urlValue = e.target.value ? e.target.value.trim() : '';
                if (urlValue) {
                    this.fetchSiteLogo(urlValue);
                }
            });
        }

        // Compact mode toggle: use the grid toggle button in the header instead of a standalone button
        const gridToggleBtn = document.getElementById('gridToggle');
        if (gridToggleBtn) {
            gridToggleBtn.addEventListener('click', () => this.toggleCompactMode());
            // Initialize the toggle button UI with the correct label and colours
            const manager = document.querySelector('.password-manager');
            this.updateCompactToggleUI(gridToggleBtn, manager);
        }

        // Close modals on backdrop click
        document.getElementById('passwordModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closePasswordModal();
        });
        document.getElementById('categoriesModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeCategoriesModal();
        });

        // Inline add category functionality within the add password modal
        const inlineCatBtn = document.getElementById('addCategoryInline');
        const inlineWrapper = document.getElementById('inlineCategoryInputWrapper');
        const inlineNameInput = document.getElementById('inlineCategoryName');
        const inlineSaveBtn = document.getElementById('inlineCatSaveBtn');
        const inlineCancelBtn = document.getElementById('inlineCatCancelBtn');

        if (inlineCatBtn && inlineWrapper && inlineNameInput) {
            inlineCatBtn.addEventListener('click', () => {
                // Show the inline input and hide the plus button and select
                inlineCatBtn.classList.add('hidden');
                inlineWrapper.classList.remove('hidden');
                // Hide the category select so the input uses full width
                const selectEl = document.getElementById('category');
                if (selectEl) {
                    selectEl.classList.add('hidden');
                }
                inlineNameInput.value = '';
                inlineNameInput.focus();
            });
        }
        // Save new category inline
        if (inlineSaveBtn && inlineWrapper && inlineCatBtn && inlineNameInput) {
            inlineSaveBtn.addEventListener('click', async () => {
                const name = inlineNameInput.value ? inlineNameInput.value.trim() : '';
                if (!name) {
                    this.showError('Παρακαλώ εισάγετε όνομα κατηγορίας.');
                    return;
                }
                // Check for duplicates (case-insensitive)
                if (this.categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
                    this.showError('Υπάρχει ήδη κατηγορία με αυτό το όνομα.');
                    return;
                }
                try {
                    const result = await window.api.passwordManagerAddCategory(name);
                    if (result && result.success) {
                        await this.loadCategories();
                        // Find and select the new category in the modal select
                        const newCat = this.categories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
                        const selectEl = document.getElementById('category');
                        if (newCat && selectEl) selectEl.value = newCat.id;
                        this.showSuccess('Κατηγορία προστέθηκε με επιτυχία!');
                    } else {
                        this.showError('Αποτυχία προσθήκης κατηγορίας: ' + (result && result.error ? result.error : 'Άγνωστο σφάλμα'));
                    }
                } catch (error) {
                    this.showError('Σφάλμα κατά την προσθήκη κατηγορίας: ' + error.message);
                }
                // Hide the inline input and show the plus button and select again
                inlineWrapper.classList.add('hidden');
                inlineCatBtn.classList.remove('hidden');
                const selectEl = document.getElementById('category');
                if (selectEl) {
                    selectEl.classList.remove('hidden');
                }
                inlineNameInput.value = '';
            });
        }
        // Cancel adding new category inline
        if (inlineCancelBtn && inlineWrapper && inlineCatBtn && inlineNameInput) {
            inlineCancelBtn.addEventListener('click', () => {
                // Hide inline input and show the select and plus button again
                inlineWrapper.classList.add('hidden');
                inlineCatBtn.classList.remove('hidden');
                const selectEl = document.getElementById('category');
                if (selectEl) {
                    selectEl.classList.remove('hidden');
                }
                inlineNameInput.value = '';
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.openPasswordModal();
            }
            if (e.key === 'Escape') {
                this.closePasswordModal();
                this.closeCategoriesModal();
            }
        });
    }

    createCompactToggle() {
        const toggle = document.createElement('button');
        toggle.className = 'compact-toggle';
        toggle.addEventListener('click', () => this.toggleCompactMode());
        document.body.appendChild(toggle);
        // Apply initial text and styles based on saved compact mode
        const manager = document.querySelector('.password-manager');
        this.updateCompactToggleUI(toggle, manager);
    }

    toggleCompactMode() {
        this.isCompactMode = !this.isCompactMode;
        console.log('Toggling compact mode to:', this.isCompactMode);
        console.log('Current passwords count:', this.passwords.length);
        
        const manager = document.querySelector('.password-manager');
        const toggle = document.querySelector('.compact-toggle');
        
        // Update the UI based on the new state
        this.updateCompactToggleUI(toggle, manager);
        // Persist preference to localStorage
        localStorage.setItem('pmCompactMode', this.isCompactMode);
        // Re-render passwords to reflect the change
        this.renderPasswords();
    }

    /**
     * Update the compact toggle button and manager class based on the current
     * value of isCompactMode. This is used both on initialization and when
     * toggling the mode.
     * @param {HTMLElement} toggle - The toggle button element.
     * @param {HTMLElement} manager - The root password manager container.
     */
    updateCompactToggleUI(toggle, manager) {
        // Update the layout class on the root manager
        if (!toggle || !manager) return;
        if (this.isCompactMode) {
            manager.classList.add('compact');
            // When compact mode is enabled highlight the toggle with the accent colour
            toggle.classList.add('active');
        } else {
            manager.classList.remove('compact');
            toggle.classList.remove('active');
        }
        // Always set an accessible label using translations but do not display the text
        const labelKey = this.isCompactMode ? 'normal_mode' : 'compact_mode';
        toggle.setAttribute('aria-label', this.t(labelKey));
        // Ensure the grid icon markup is present on every update.  The HTML
        // structure for the icon is defined here so CSS can style the nine
        // coloured squares.  This prevents the toggle label from being
        // exposed in the UI and instead relies on the aria-label for screen
        // readers.
        if (!toggle.querySelector('.icon-grid')) {
            // Remove existing contents
            toggle.innerHTML = '';
            const icon = document.createElement('div');
            icon.className = 'icon-grid';
            // Populate nine child spans for the coloured squares
            for (let i = 0; i < 9; i++) {
                const sq = document.createElement('span');
                icon.appendChild(sq);
            }
            toggle.appendChild(icon);
        }
    }

    initializeAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animation = 'cardEntrance 0.4s ease-out forwards';
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // ΠΡΟΣΘΗΚΗ: Ορισμός της observeCards ως μέθοδο
        this.observeCards = () => {
            document.querySelectorAll('.password-card, .compact-password-card').forEach(card => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                observer.observe(card);
            });
        };

        // Προσθήκη CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes cardEntrance {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-4px); }
                75% { transform: translateX(4px); }
            }
            
            .shake {
                animation: shake 0.3s ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }

    addGeneratePasswordButton() {
        const passwordField = document.getElementById('password');
        const formGroup = passwordField.closest('.form-group');
        
        // Remove existing button if any
        const existingBtn = formGroup.querySelector('.generate-password-btn');
        if (existingBtn) {
            existingBtn.remove();
        }
        // Remove existing visibility toggle if any
        const existingToggle = formGroup.querySelector('.toggle-visibility-btn');
        if (existingToggle) {
            existingToggle.remove();
        }
        
        const generateBtn = document.createElement('button');
        generateBtn.type = 'button';
        generateBtn.className = 'button generate-password-btn';
        generateBtn.setAttribute('aria-label', 'Generate strong password');
        
        // Only the dice icon for the generator button
        generateBtn.innerHTML = '🎲';
        
        generateBtn.addEventListener('click', () => {
            this.generateStrongPassword();
        });
        
        formGroup.appendChild(generateBtn);

        // Create a toggle visibility button for the password field
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'button toggle-visibility-btn';
        toggleBtn.setAttribute('aria-label', 'Toggle password visibility');
        
        // Event listener to toggle the password input type and update icon state
        toggleBtn.addEventListener('click', () => {
            const input = document.getElementById('password');
            if (input.type === 'password') {
                input.type = 'text';
                toggleBtn.classList.add('visible');
            } else {
                input.type = 'password';
                toggleBtn.classList.remove('visible');
            }
        });
        
        formGroup.appendChild(toggleBtn);
    }

    async loadData() {
        // If the Electron preload APIs are unavailable or if we're operating with a stub
        // implementation (provided in index.html), populate the interface with
        // demonstration data.  This branch runs before any authentication logic to
        // allow viewing the UI outside of the Electron environment.  A stub
        // implementation sets `window.api.isStub = true`.
        if (!window.api || window.api.isStub) {
            console.warn('Password manager APIs are not available; using sample data for demonstration.');
            // Mark authenticated to enable interactions
            this.isAuthenticated = true;
            // Demo categories
            this.categories = [
                { id: 1, name: 'Email' },
                { id: 2, name: 'Development' },
                { id: 3, name: 'Entertainment' }
            ];
            // Demo passwords. One password (abc123) is intentionally weak.
            this.passwords = [
                {
                    id: 1,
                    category_id: 1,
                    title: 'Gmail',
                    username: 'user',
                    email: 'user@gmail.com',
                    password: 'abc123',
                    url: '',
                    notes: '',
                    updated_at: '2024-01-15'
                },
                {
                    id: 2,
                    category_id: 2,
                    title: 'GitHub',
                    username: 'developer',
                    email: 'dev@example.com',
                    password: 'Str0ngP@ssword!',
                    url: '',
                    notes: '',
                    updated_at: '2024-02-20'
                },
                {
                    id: 3,
                    category_id: 3,
                    title: 'Netflix',
                    username: 'viewer',
                    email: 'viewer@example.com',
                    password: 'Anoth3r$trong1',
                    url: '',
                    notes: '',
                    updated_at: '2024-03-10'
                },
                {
                    id: 4,
                    category_id: 2,
                    title: 'AWS Console',
                    username: 'admin',
                    email: 'admin@company.com',
                    password: 'S3cur3P@ss!',
                    url: '',
                    notes: '',
                    updated_at: '2024-01-05'
                },
                {
                    id: 5,
                    category_id: 2,
                    title: 'dfg',
                    username: 'dfg',
                    email: 'thomasthanos28@gmail.com',
                    password: 'Difficult!Pass5',
                    url: '',
                    notes: '',
                    updated_at: '2025-11-08'
                },
                {
                    id: 6,
                    category_id: 2,
                    title: 'Discord',
                    username: 'Thomas2873',
                    email: 'thomasthanos28@gmail.com',
                    password: 'B3stP@ss6$',
                    url: '',
                    notes: '',
                    updated_at: '2025-11-08'
                }
            ];
            // Attach the category name to each password for easier display
            this.passwords.forEach(p => {
                const cat = this.categories.find(c => c.id === p.category_id);
                p.category_name = cat ? cat.name : '';
                // Also restore any locally stored image for the password.  When a user
                // uploads a logo/image for a password in demo mode, it is stored
                // under the key `passwordImage-<id>`.  Without this step the image
                // would disappear on page refresh.
                const storedImg = localStorage.getItem('passwordImage-' + p.id);
                if (storedImg) {
                    p.image = storedImg;
                }
            });
            // Render demonstration data
            this.renderCategories();
            this.renderCategorySelect();
            this.calculateStats();
            this.renderPasswords();
            return;
        }

        // If using real APIs, ensure the user is authenticated before loading
        if (!this.isAuthenticated) {
            console.log('Not authenticated, skipping data load');
            return;
        }

        console.log('Loading password manager data...');

        const requiredApis = [
            'passwordManagerGetCategories',
            'passwordManagerGetPasswords',
            'passwordManagerAddPassword'
        ];

        const missingApis = requiredApis.filter(api => typeof window.api[api] !== 'function');

        if (missingApis.length > 0) {
            this.showError(`Missing password manager APIs: ${missingApis.join(', ')}`);
            return;
        }

        await this.loadCategories();
        await this.loadPasswords();
    }

    calculateStats() {
        // Calculate the total number of stored passwords
        this.stats.total = this.passwords.length;
        // Calculate number of categories
        this.stats.categories = this.categories.length;
        // Count weak passwords using the getPasswordStrength helper
        this.stats.weak = this.passwords.filter(p => this.getPasswordStrength(p.password) === 'weak').length;
        // Count strong passwords (any password that is not considered weak)
        this.stats.strong = this.passwords.filter(p => this.getPasswordStrength(p.password) !== 'weak').length;
        // Determine how many passwords are reused (same password appears more than once)
        const passwordCounts = {};
        this.passwords.forEach(p => {
            passwordCounts[p.password] = (passwordCounts[p.password] || 0) + 1;
        });
        this.stats.reused = Object.values(passwordCounts).filter(count => count > 1).length;
        // Render the updated statistics on the UI
        this.renderStats();
    }

    renderStats() {
        const container = document.getElementById('statsContainer');
        if (!container) return;
        // Build an array of statistic objects including an icon, value and translated label
        const statsArray = [
            { icon: '🔒', value: this.stats.total, label: this.t('stats_total') },
            { icon: '🛡️', value: this.stats.strong || 0, label: this.t('stats_strong') },
            { icon: '⚠️', value: this.stats.weak, label: this.t('stats_weak') },
            { icon: '📂', value: this.stats.categories, label: this.t('stats_categories') }
        ];
        // Compose the HTML for each stat card
        container.innerHTML = statsArray.map(({ icon, value, label }) => `
            <div class="stat-card">
                <div class="stat-icon">${icon}</div>
                <span class="stat-number">${value}</span>
                <span class="stat-label">${label}</span>
            </div>
        `).join('');
    }

    getPasswordStrength(password) {
        if (!password) return 'weak';
        
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        if (strength <= 2) return 'weak';
        if (strength <= 4) return 'medium';
        if (strength <= 5) return 'strong';
        return 'very-strong';
    }

    checkPasswordStrength(password) {
        const strengthBar = document.getElementById('passwordStrength');
        if (!strengthBar) return;
        
        const strength = this.getPasswordStrength(password);
        strengthBar.className = 'strength-bar';
        strengthBar.classList.add(`strength-${strength}`);
    }

    generateStrongPassword() {
        const chars = {
            uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            lowercase: 'abcdefghijklmnopqrstuvwxyz',
            numbers: '0123456789',
            symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
        };
        
        let password = '';
        password += chars.uppercase[Math.floor(Math.random() * chars.uppercase.length)];
        password += chars.lowercase[Math.floor(Math.random() * chars.lowercase.length)];
        password += chars.numbers[Math.floor(Math.random() * chars.numbers.length)];
        password += chars.symbols[Math.floor(Math.random() * chars.symbols.length)];
        
        const allChars = chars.uppercase + chars.lowercase + chars.numbers + chars.symbols;
        for (let i = password.length; i < 16; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        password = password.split('').sort(() => Math.random() - 0.5).join('');
        
        document.getElementById('password').value = password;
        this.checkPasswordStrength(password);
        // Use translated success message for password generation
        this.showSuccess(this.t('strong_password_generated'));
    }

    async loadCategories() {
        try {
            const result = await window.api.passwordManagerGetCategories();
            if (result.success) {
                this.categories = result.categories;
                this.renderCategories();
                this.renderCategorySelect();
            } else {
                this.showError('Failed to load categories: ' + result.error);
            }
        } catch (error) {
            this.showError('Error loading categories: ' + error.message);
        }
    }

    async loadPasswords(categoryId = 'all') {
        try {
            const result = await window.api.passwordManagerGetPasswords(categoryId);
            if (result.success) {
                this.passwords = result.passwords;
            // Attach any locally stored images back to the passwords, but only if the DB didn't provide one
            this.passwords.forEach(p => {
                if (!p.image) {
                    const storedImg = localStorage.getItem('passwordImage-' + p.id);
                    if (storedImg) {
                        p.image = storedImg;
                    }
                }
            });
                this.renderPasswords();
                this.calculateStats();
            } else {
                this.showError('Failed to load passwords: ' + result.error);
            }
        } catch (error) {
            this.showError('Error loading passwords: ' + error.message);
        }
    }

    renderCategories() {
        const container = document.getElementById('categoriesContainer');
        container.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.className = `category-btn ${this.currentCategory === 'all' ? 'active' : ''}`;
        // Use translated label for the "All" button if available
        const allLabel = typeof this.t === 'function' ? this.t('all_categories') : 'All';
        allBtn.innerHTML = `<span>🌐 ${allLabel}</span>`;
        allBtn.addEventListener('click', () => this.filterByCategory('all'));
        container.appendChild(allBtn);

        this.categories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = `category-btn ${this.currentCategory === category.id ? 'active' : ''}`;
            btn.innerHTML = `<span>${this.escapeHtml(category.name)}</span>`;
            btn.addEventListener('click', () => this.filterByCategory(category.id));
            container.appendChild(btn);
        });
    }

    renderCategorySelect() {
        const select = document.getElementById('category');
        // Set the first option using translated "No Category" if available
        const noCat = typeof this.t === 'function' ? this.t('no_category_option') : 'No Category';
        select.innerHTML = `<option value="">${noCat}</option>`;
        
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            select.appendChild(option);
        });
    }

renderPasswords() {
    console.log('Rendering passwords, compact mode:', this.isCompactMode);
    const grid = document.getElementById('passwordsGrid');
    
    if (this.passwords.length === 0) {
        const noPasswords = typeof this.t === 'function' ? this.t('no_passwords_yet') : 'No Passwords Yet';
        const firstDesc = typeof this.t === 'function' ? this.t('first_password_desc') : 'Add your first password to secure your digital life';
        const firstBtn = typeof this.t === 'function' ? this.t('add_first_password') : 'Add Your First Password';
        grid.innerHTML = `
            <div class="empty-state">
                <i>🔒</i>
                <h3>${noPasswords}</h3>
                <p>${firstDesc}</p>
                <button class="button" onclick="pm.openPasswordModal()" style="margin-top: 1rem;">
                    ${firstBtn}
                </button>
            </div>
        `;
        return;
    }

    // COMPACT MODE
        // Define reusable SVG icons for copy, eye (reveal), vertical ellipsis, edit and delete.
        const svgCopy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
        const svgEye = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
        const svgDots = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><circle cx="12" cy="5" r="1.5" fill="currentColor"></circle><circle cx="12" cy="12" r="1.5" fill="currentColor"></circle><circle cx="12" cy="19" r="1.5" fill="currentColor"></circle></svg>`;
        const svgEdit = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.004 1.004 0 0 0 0-1.42l-2.34-2.34a1.004 1.004 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.83-1.82z"/></svg>`;
        const svgDelete = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zm3.46-9.12l1.41-1.41L12 10.59l1.12-1.12 1.42 1.42L13.41 12l1.13 1.12-1.42 1.42L12 13.41l-1.12 1.13-1.42-1.42L10.59 12l-1.13-1.12zm7.54-7.88V4H7V2h5.5l1-1h5v1h-3.54z"/></svg>`;

        // Inline user and mail icons for username/email rows.  These icons provide
        // a visual cue indicating the purpose of each field, similar to input
        // adornments in the provided design reference.  They are defined here
        // alongside other inline icons to keep them scoped to the render method
        // and avoid polluting the class scope.
        const svgUser = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.31 0-10 1.67-10 5v3h20v-3c0-3.33-6.69-5-10-5z"/></svg>`;
        const svgMail = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>`;

        // A lock icon to visually identify the password row.  Displayed to the
        // left of the obscured/visible password value.  The design uses a
        // minimal padlock shape that blends well with the rest of the icons.
        const svgLock = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-5 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-3-7V7a3 3 0 0 1 6 0v2H9z"/></svg>`;

        if (this.isCompactMode) {
        // Render a simplified card with only the service title, category, password row, and bottom row
        grid.innerHTML = this.passwords.map(password => {
            const title = this.escapeHtml(password.title);
            // Determine the category name on the fly to ensure it exists even in demo mode
            let categoryName = '';
            if (password.category_name) {
                categoryName = this.escapeHtml(password.category_name);
            } else {
                const catObj = this.categories.find(c => c.id === password.category_id);
                categoryName = catObj ? this.escapeHtml(catObj.name) : '';
            }
            const updatedDate = password.updated_at ? new Date(password.updated_at).toLocaleDateString() : '—';
            // Pull username/email for compact display (prefer email if present)
            const username = password.username ? this.escapeHtml(password.username) : '';
            const email = password.email ? this.escapeHtml(password.email) : '';
            const infoValue = email || username;
            const infoIcon = email ? svgMail : (username ? svgUser : '');
            const infoField = email ? 'email' : (username ? 'username' : '');
            const infoTitle = email ? this.t('copy_email') : (username ? this.t('copy_username') : '');
            // Determine if we should show the visit link
            let visitLink = '';
            if (password.url) {
                let displayUrl = '';
                try {
                    const urlObj = new URL(password.url);
                    displayUrl = urlObj.hostname.replace('www.', '');
                } catch (e) {
                    displayUrl = password.url;
                }
                visitLink = `<a href="#" onclick="pm.openExternal('${this.escapeHtml(password.url)}')" title="${this.t('open_in_browser')}">${this.t('open_website') || 'Visit site'}</a>`;
            }
            // Determine image or fallback initial for the service
            let imageHtml = '';
            const imgSrc = this.getImageForPassword(password.id);
            if (imgSrc) {
                imageHtml = `<img src="${imgSrc}" class="card-image" alt="" />`;
            } else {
                const initial = title.trim().charAt(0).toUpperCase();
                imageHtml = `<div class="card-image initial">${initial}</div>`;
            }
                return `
            <div class="compact-password-card" data-password-id="${password.id}">
                <div class="compact-header">
                    <div class="compact-main">
                        ${imageHtml}
                        <div class="compact-headings">
                            <h3 class="compact-title">${title}</h3>
                            ${categoryName ? `<div class="compact-category-footer">${categoryName}</div>` : ''}
                        </div>
                    </div>
                    <div class="compact-actions">
                        <button class="menu-btn" onclick="pm.toggleActionMenu(event, this)" title="${this.t('options') || 'Options'}">${svgDots}</button>
                        <div class="actions-menu">
                            <button class="action-item edit" onclick="pm.editPassword(${password.id})" title="${this.t('edit')}">${svgEdit} <span>${this.t('edit')}</span></button>
                            <button class="action-item delete" onclick="pm.deletePassword(${password.id})" title="${this.t('delete')}">${svgDelete} <span>${this.t('delete')}</span></button>
                        </div>
                    </div>
                </div>
                ${infoValue ? `<div class="compact-info-line">
                    <span class="info-icon">${infoIcon}</span>
                    <span class="info-value">${infoValue}</span>
                    <button class="compact-copy-btn" onclick="pm.copyField(${password.id}, '${infoField}')" title="${infoTitle}">${svgCopy}</button>
                </div>` : ''}
                <div class="compact-password-row">
                    <span class="password-icon">${svgLock}</span>
                    <span class="compact-text compact-password-hidden">••••••••</span>
                    <!-- Reveal (eye) button toggles password visibility -->
                    <button class="compact-reveal-btn" onclick="pm.togglePassword(this, ${password.id})" title="${this.t('reveal_password')}">${svgEye}</button>
                    <!-- Copy button to copy the password to clipboard -->
                    <button class="compact-copy-btn" onclick="pm.copyField(${password.id}, 'password')" title="${this.t('copy_password')}">${svgCopy}</button>
                </div>
                <div class="compact-bottom">
                    ${visitLink}
                    <span class="compact-date">${updatedDate}</span>
                </div>
            </div>
            `;
        }).join('');
    } else {
        // NORMAL MODE
        // Render cards with service title, category, username/email lines, password row, and bottom row
        grid.innerHTML = this.passwords.map(password => {
            const title = this.escapeHtml(password.title);
            // Determine the category name on the fly to ensure it exists even in demo mode
            let categoryName = '';
            if (password.category_name) {
                categoryName = this.escapeHtml(password.category_name);
            } else {
                const catObj = this.categories.find(c => c.id === password.category_id);
                categoryName = catObj ? this.escapeHtml(catObj.name) : '';
            }
            const updatedDate = password.updated_at ? new Date(password.updated_at).toLocaleDateString() : '—';
            const username = password.username ? this.escapeHtml(password.username) : '';
            const email = password.email ? this.escapeHtml(password.email) : '';
            let visitLink = '';
            if (password.url) {
                let displayUrl = '';
                try {
                    const urlObj = new URL(password.url);
                    displayUrl = urlObj.hostname.replace('www.', '');
                } catch (e) {
                    displayUrl = password.url;
                }
                visitLink = `<a href="#" onclick="pm.openExternal('${this.escapeHtml(password.url)}')" title="${this.t('open_in_browser')}">${this.t('open_website') || 'Visit site'}</a>`;
            }
            // Determine image or fallback initial for the service
            let imageHtml = '';
            const imgSrc = this.getImageForPassword(password.id);
            if (imgSrc) {
                imageHtml = `<img src="${imgSrc}" class="card-image" alt="" />`;
            } else {
                const initial = title.trim().charAt(0).toUpperCase();
                imageHtml = `<div class="card-image initial">${initial}</div>`;
            }
            return `
            <div class="password-card" data-password-id="${password.id}">
                <div class="password-header">
                    <div class="password-main">
                        ${imageHtml}
                        <div class="password-headings">
                            <h3 class="password-title">${title}</h3>
                            ${categoryName ? `<div class="password-category-footer">${categoryName}</div>` : ''}
                        </div>
                    </div>
                    <div class="password-actions">
                        <!-- Menu trigger button with vertical ellipsis -->
                        <button class="menu-btn" onclick="pm.toggleActionMenu(event, this)" title="${this.t('options') || 'Options'}">${svgDots}</button>
                        <!-- Hidden actions dropdown (edit/delete) -->
                        <div class="actions-menu">
                            <button class="action-item edit" onclick="pm.editPassword(${password.id})" title="${this.t('edit')}">${svgEdit} <span>${this.t('edit')}</span></button>
                            <button class="action-item delete" onclick="pm.deletePassword(${password.id})" title="${this.t('delete')}">${svgDelete} <span>${this.t('delete')}</span></button>
                        </div>
                    </div>
                </div>
                ${username ? `<div class="password-info-line">
                    <span class="info-icon">${svgUser}</span>
                    <span class="info-value">${username}</span>
                    <button class="copy-info-btn" onclick="pm.copyField(${password.id}, 'username')" title="${this.t('copy_username')}">${svgCopy}</button>
                </div>` : ''}
                ${email ? `<div class="password-info-line">
                    <span class="info-icon">${svgMail}</span>
                    <span class="info-value">${email}</span>
                    <button class="copy-info-btn" onclick="pm.copyField(${password.id}, 'email')" title="${this.t('copy_email')}">${svgCopy}</button>
                </div>` : ''}
                <div class="password-row">
                    <span class="password-icon">${svgLock}</span>
                    <span class="password-text password-hidden">••••••••</span>
                    <!-- Reveal (eye) button toggles password visibility -->
                    <button class="reveal-btn" onclick="pm.togglePassword(this, ${password.id})" title="${this.t('reveal_password')}">${svgEye}</button>
                    <!-- Copy button to copy the password to clipboard -->
                    <button class="copy-password-btn" onclick="pm.copyField(${password.id}, 'password')" title="${this.t('copy_password')}">${svgCopy}</button>
                </div>
                <div class="password-bottom">
                    ${visitLink}
                    <span class="updated-date">${updatedDate}</span>
                </div>
            </div>
            `;
        }).join('');
    }
    // After rendering, apply entrance animations
    this.observeCards();
}

    async openExternal(url) {
        // Always open in default system browser, not in-app browser
        if (window.api && typeof window.api.openExternal === 'function') {
            await window.api.openExternal(url);
        } else {
            // Fallback that always opens in default browser
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    filterByCategory(categoryId) {
        this.currentCategory = categoryId;
        this.renderCategories();
        this.loadPasswords(categoryId);
    }

    openPasswordModal(passwordId = null) {
        this.currentEditingId = passwordId;
        const modal = document.getElementById('passwordModal');
        const title = document.getElementById('passwordModalTitle');
        const form = document.getElementById('passwordForm');

        if (passwordId) {
            // Set translated edit title if translation function is available
            title.textContent = typeof this.t === 'function' ? this.t('modal_edit_title') : 'Edit Password';
            this.fillPasswordForm(passwordId);
            // Show existing image preview when editing
            const password = this.passwords.find(p => p.id === passwordId);
            if (password) {
                this.setUploadBoxImage(password.image || null);
            }
        } else {
            // Set translated add title if translation function is available
            title.textContent = typeof this.t === 'function' ? this.t('modal_add_title') : 'Add New Password';
            form.reset();
            document.getElementById('passwordId').value = '';
            document.getElementById('passwordStrength').className = 'strength-bar';

            // Reset image inputs for new passwords
            const imgData = document.getElementById('imageData');
            if (imgData) imgData.value = '';
            const imgFile = document.getElementById('imageFile');
            if (imgFile) imgFile.value = '';

            // Reset the upload box to show the placeholder
            this.setUploadBoxImage(null);
        }

        modal.classList.add('active');
        document.getElementById('title').focus();
        
        // Προσθήκη του κουμπιού αμέσως
        setTimeout(() => this.addGeneratePasswordButton(), 100);
    }

    closePasswordModal() {
        document.getElementById('passwordModal').classList.remove('active');
        document.getElementById('passwordForm').reset();
        this.currentEditingId = null;
        
        const generateBtn = document.querySelector('.generate-password-btn');
        if (generateBtn) {
            generateBtn.remove();
        }
        const toggleBtn = document.querySelector('.toggle-visibility-btn');
        if (toggleBtn) {
            toggleBtn.remove();
        }
    }

    /**
     * Translate a given key using the current language.  Falls back to English if the key
     * or language is missing.
     * @param {string} key
     * @returns {string}
     */
    t(key) {
        if (this.translations && this.translations[this.lang] && this.translations[this.lang][key]) {
            return this.translations[this.lang][key];
        }
        return (this.translations && this.translations.en && this.translations.en[key]) || key;
    }

    /**
     * Apply translated text to various static UI elements.  This method should be called
     * after the DOM is ready (e.g. after event listeners are attached).
     */
    applyTranslations() {
        try {
            // Update button labels
            const addBtnSpan = document.querySelector('#addPasswordBtn span');
            if (addBtnSpan) addBtnSpan.textContent = this.t('add_password_btn');
            const manageCatSpan = document.querySelector('#manageCategoriesBtn span');
            if (manageCatSpan) manageCatSpan.textContent = this.t('manage_categories_btn');

            // Update search placeholder
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.placeholder = this.t('search_placeholder');

            // Update modal titles and buttons
            const passwordModalTitle = document.getElementById('passwordModalTitle');
            if (passwordModalTitle) passwordModalTitle.textContent = this.t('modal_add_title');
            const cancelBtn = document.getElementById('cancelPasswordBtn');
            if (cancelBtn) cancelBtn.textContent = this.t('cancel');
            const saveBtnSpan = document.querySelector('#savePasswordBtn span');
            if (saveBtnSpan) saveBtnSpan.textContent = this.t('save_password');

            // Update form labels
            const labelMap = {
                'title': 'title_label',
                'password': 'password_label',
                'url': 'url_label',
                'category': 'category_label',
                'username': 'username_label',
                'notes': 'notes_label',
                'email': 'email_label'
            };
            for (const inputId in labelMap) {
                const label = document.querySelector(`label[for='${inputId}']`);
                if (label) label.textContent = this.t(labelMap[inputId]);
            }

            // Update placeholders for inputs
            const placeholderMap = {
                'title': 'title_placeholder',
                'password': 'password_placeholder',
                'url': 'url_placeholder',
                'username': 'username_placeholder',
                'notes': 'notes_placeholder',
                'email': 'email_placeholder'
            };
            for (const inputId in placeholderMap) {
                const input = document.getElementById(inputId);
                if (input) input.placeholder = this.t(placeholderMap[inputId]);
            }

            // Update category select first option
            const categorySelect = document.getElementById('category');
            if (categorySelect) {
                const firstOption = categorySelect.querySelector('option[value=""]');
                if (firstOption) firstOption.textContent = this.t('no_category_option');
            }
        } catch (err) {
            console.error('Error applying translations:', err);
        }
    }

    async fillPasswordForm(passwordId) {
        const password = this.passwords.find(p => p.id === passwordId);
        if (!password) return;

        document.getElementById('passwordId').value = password.id;
        document.getElementById('title').value = password.title;
        document.getElementById('category').value = password.category_id || '';
        document.getElementById('username').value = password.username || '';
        document.getElementById('email').value = password.email || '';
        document.getElementById('password').value = password.password;
        document.getElementById('url').value = password.url || '';
        document.getElementById('notes').value = password.notes || '';

        // If an image is stored, prefill hidden input
        const imgData = document.getElementById('imageData');
        if (imgData) imgData.value = password.image || '';

        // Clear any previously selected file in the file input
        const imgFile = document.getElementById('imageFile');
        if (imgFile) imgFile.value = '';
        
        this.checkPasswordStrength(password.password);
    }

async savePassword(e) {
    e.preventDefault();

    if (!window.api || typeof window.api.passwordManagerAddPassword !== 'function') {
        this.showError('Password manager is not available.');
        return;
    }

        const passwordData = {
        title: document.getElementById('title').value.trim(),
        category_id: document.getElementById('category').value || null,
        username: document.getElementById('username').value.trim(), // ΑΦΗΣΤΕ ΑΥΤΟ ΧΩΡΙΣ null
        email: document.getElementById('email').value.trim(), // ΑΦΗΣΤΕ ΑΥΤΟ ΧΩΡΙΣ null
        password: document.getElementById('password').value,
        url: document.getElementById('url').value.trim() || null,
        notes: document.getElementById('notes').value.trim() || null,
        // Persist the image data/URL if provided
        image: document.getElementById('imageData') ? document.getElementById('imageData').value || null : null
    };

    console.log('Saving password data:', {
        title: passwordData.title,
        username: passwordData.username, // DEBUG
        passwordLength: passwordData.password ? passwordData.password.length : 0
    });

    // Validation: Title is required
    if (!passwordData.title) {
        this.showError('Title is required.');
        document.getElementById('title').classList.add('shake');
        setTimeout(() => document.getElementById('title').classList.remove('shake'), 500);
        return;
    }

    // Validation: Password is required
    if (!passwordData.password) {
        this.showError('Password is required.');
        document.getElementById('password').classList.add('shake');
        setTimeout(() => document.getElementById('password').classList.remove('shake'), 500);
        return;
    }

    // Validation: Password cannot be only whitespace
    if (passwordData.password.trim().length === 0) {
        this.showError('Password cannot be empty.');
        document.getElementById('password').classList.add('shake');
        setTimeout(() => document.getElementById('password').classList.remove('shake'), 500);
        return;
    }

    const emailVal = document.getElementById('email').value.trim();
    if (emailVal && !this.isValidEmailUnicode(emailVal)) {
        this.showError('Invalid email format.');
        document.getElementById('email').classList.add('shake');
        setTimeout(() => document.getElementById('email').classList.remove('shake'), 500);
        return;
    }

    try {
        let result;
        const saveBtn = document.getElementById('savePasswordBtn');
        const originalText = saveBtn.innerHTML;
        
        saveBtn.innerHTML = '<span class="loading"></span> Saving...';
        saveBtn.disabled = true;

        if (this.currentEditingId) {
            result = await window.api.passwordManagerUpdatePassword(this.currentEditingId, passwordData);
        } else {
            result = await window.api.passwordManagerAddPassword(passwordData);
        }

        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;

        if (result.success) {
            // We might be in editing mode; capture the current editing id **before** closing the modal,
            // because `closePasswordModal()` resets `this.currentEditingId` to null.  We need this value
            // later to correctly store/update the image.
            const editingId = this.currentEditingId;
            // Close the modal immediately to give user feedback
            this.closePasswordModal();

            // Determine the ID to use for storing the image before reloading.
            // If editing, it's the previously captured editingId; if adding, we will infer after load.
            let storedId = editingId || null;

            // If editing an existing password and an image is provided, persist the image immediately so
            // the upcoming load picks it up.  This also updates the in-memory password to reflect the new
            // image until reload.
            if (storedId && passwordData.image) {
                // Update the existing password object in memory so it re-renders immediately.
                const existing = this.passwords.find(p => p.id === storedId);
                if (existing) {
                    existing.image = passwordData.image;
                }
            }

            // Reload passwords for the current category (from API or demo data)
            await this.loadPasswords(this.currentCategory);

            // If adding a new password (no storedId) and an image is provided, determine the new ID.
            // We assume the new password appears at the end of the list returned by the API; if your API
            // sorts differently, this logic may need adjustment.
            if (!storedId && passwordData.image) {
                const lastPassword = this.passwords[this.passwords.length - 1];
                if (lastPassword) {
                    storedId = lastPassword.id;
                    // Update the password object's image property
                    lastPassword.image = passwordData.image;
                }
            }

            // After persisting the image, ensure the rendered cards show the latest images
            // by updating each password's image property from localStorage
            this.passwords.forEach(p => {
                const img = localStorage.getItem('passwordImage-' + p.id);
                if (img) {
                    p.image = img;
                }
            });
            // Re-render the grid to reflect any updated images immediately
            this.renderPasswords();
            this.calculateStats();

            // After re-rendering, update the specific card's image immediately if we know which password was saved
            if (passwordData.image && storedId) {
                this.updatePasswordImageInUI(storedId, passwordData.image);
            }

            // Show a success message. Use editingId instead of this.currentEditingId because the latter
            // was reset when we closed the modal.
            this.showSuccess(`Password ${editingId ? 'updated' : 'saved'} successfully!`);
        } else {
            this.showError('Failed to save password: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Save password error:', error);
        this.showError('Error saving password: ' + error.message);
        
        const saveBtn = document.getElementById('savePasswordBtn');
        saveBtn.innerHTML = '<span>💾 Save Password</span>';
        saveBtn.disabled = false;
    }
}

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    editPassword(passwordId) {
        this.openPasswordModal(passwordId);
    }
    // passwordmanager.js — helpers (βάλε τα μέσα στην κλάση PasswordManager)
    isAscii(str) { return /^[\x00-\x7F]*$/.test(str); }

    // Πολύ απλός Unicode email έλεγχος: ένα @, μη κενά μέρη, domain με labels χωρισμένα με τελείες.
    // Επιτρέπει ελληνικά/Unicode και στο local-part και στο domain (IDN).
    isValidEmailUnicode(value) {
    if (!value) return true; // άδειο = οκ (το email δεν είναι required)
    const parts = value.split('@');
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    if (!local || !domain) return false;
    // domain: labels με γράμματα/αριθμούς/παύλες (Unicode), χωρισμένα με τελείες
    const label = /^[\p{L}\p{M}\p{N}]+(?:[\p{L}\p{M}\p{N}-]*[\p{L}\p{M}\p{N}])?$/u;
    const labels = domain.split('.');
    if (labels.some(l => !l || !label.test(l))) return false;
    // local: οτιδήποτε εκτός από κενό/χωρίς @/χωρίς κενό διάστημα
    if (/[^\S\r\n]/.test(local)) return false;
    return true;
    }

    /**
     * Prompt the user with a custom confirmation dialog before deleting a
     * password record. If the user confirms, proceed to delete the
     * password via the API and refresh the list. Uses a glass-themed modal
     * instead of the default browser confirm to better integrate with the
     * overall UI.
     *
     * @param {number|string} passwordId The ID of the password to delete
     */
    async deletePassword(passwordId) {
        // Retrieve the password object to display its title in the confirm
        const password = this.passwords.find(p => p.id === passwordId);
        const confirmed = await this.showDeleteConfirm(password);
        if (!confirmed) return;

        try {
            const result = await window.api.passwordManagerDeletePassword(passwordId);
            if (result.success) {
                await this.loadPasswords(this.currentCategory);
                // Use translation helper if available
                const msg = typeof this.t === 'function' ? this.t('deleted_successfully') : 'Password deleted successfully!';
                this.showSuccess(msg);
            } else {
                const errMsg = typeof this.t === 'function' ? this.t('delete_failed') : 'Failed to delete password: ';
                this.showError(errMsg + result.error);
            }
        } catch (error) {
            const errMsg = typeof this.t === 'function' ? this.t('delete_error') : 'Error deleting password: ';
            this.showError(errMsg + error.message);
        }
    }

    /**
     * Display a modal asking the user to confirm deletion of a password.
     * The modal shows the password's title in the message to provide
     * context. Returns a Promise that resolves to true if the user
     * confirms, or false otherwise.
     *
     * @param {Object} password The password record to be deleted
     * @returns {Promise<boolean>} Resolves with true if confirmed, false otherwise
     */
    showDeleteConfirm(password) {
        return new Promise(resolve => {
            const modal = document.getElementById('deleteConfirmModal');
            const closeBtn = document.getElementById('deleteConfirmClose');
            const cancelBtn = document.getElementById('deleteCancelBtn');
            const confirmBtn = document.getElementById('deleteConfirmBtn');
            const titleEl = document.getElementById('deleteConfirmTitle');
            const messageEl = document.getElementById('deleteConfirmMessage');

            // Populate title and message using the password information and translations.
            // If a translation is unavailable (often returned as the key itself),
            // fall back to a sensible default in Greek.
            const defaultTitle = 'Επιβεβαίωση Διαγραφής';
            const defaultMsg = `Είστε σίγουροι ότι θέλετε να διαγράψετε τον κωδικό «${password?.title ?? ''}»; Η ενέργεια δεν μπορεί να αναιρεθεί.`;
            let translatedTitle = null;
            let translatedMsg = null;
            if (typeof this.t === 'function') {
                const maybeTitle = this.t('delete_confirm_title');
                // Only use translation if it exists and is different from the key
                if (maybeTitle && maybeTitle !== 'delete_confirm_title') {
                    translatedTitle = maybeTitle;
                }
                // Try to get a message with interpolation if provided by the translation system
                const maybeMsg = this.t('delete_confirm_message', { title: password?.title });
                if (maybeMsg && maybeMsg !== 'delete_confirm_message') {
                    translatedMsg = maybeMsg;
                }
            }
            titleEl.textContent = translatedTitle || defaultTitle;
            messageEl.textContent = translatedMsg || defaultMsg;

            // Show the modal
            modal.classList.add('active');

            // Helper to clean up listeners and hide modal
            const cleanup = () => {
                modal.classList.remove('active');
                // Remove event listeners to avoid multiple bindings
                closeBtn.removeEventListener('click', onCancel);
                cancelBtn.removeEventListener('click', onCancel);
                confirmBtn.removeEventListener('click', onConfirm);
            };

            const onCancel = () => {
                cleanup();
                resolve(false);
            };

            const onConfirm = () => {
                cleanup();
                resolve(true);
            };

            closeBtn.addEventListener('click', onCancel);
            cancelBtn.addEventListener('click', onCancel);
            confirmBtn.addEventListener('click', onConfirm);
        });
    }

    /**
     * Update the upload box UI to display either a placeholder or an image preview.
     * When a URL is provided, the placeholder is hidden and a preview image is
     * shown. When no URL is provided, any existing preview is removed and the
     * placeholder is restored.
     *
     * @param {string|null} url The image URL or data URI to display, or null to reset
     */
    setUploadBoxImage(url) {
        const uploadBox = document.getElementById('imageUploadBox');
        if (!uploadBox) return;
        const placeholder = uploadBox.querySelector('.upload-placeholder');
        let previewImg = uploadBox.querySelector('.upload-preview');
        if (url) {
            // Hide placeholder
            if (placeholder) placeholder.style.display = 'none';
            // Create preview image if it doesn't exist
            if (!previewImg) {
                previewImg = document.createElement('img');
                previewImg.className = 'upload-preview';
                uploadBox.appendChild(previewImg);
            }
            previewImg.src = url;
            previewImg.alt = 'Image preview';
        } else {
            // Remove preview image if present
            if (previewImg) {
                previewImg.remove();
            }
            // Show placeholder
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
        }
    }

    async searchPasswords(query) {
        // If the query is empty, reload passwords for the current category.
        if (!query.trim()) {
            await this.loadPasswords(this.currentCategory);
            return;
        }

        // For search, reload all passwords for the current category and then
        // filter on the client side.  This avoids relying on the backend to
        // search across encrypted fields.  Sensitive fields are available in
        // this.passwords after decryption via the API.
        try {
            // Always fetch fresh data from the current category before filtering
            const result = await window.api.passwordManagerGetPasswords(this.currentCategory);
            if (result.success) {
                const allPasswords = result.passwords;
                const lower = query.toLowerCase();
                // Filter by title, username, email, url, or notes.  Any missing
                // property is treated as empty string.
                this.passwords = allPasswords.filter(p => {
                    return [p.title, p.username, p.email, p.url, p.notes]
                        .map(v => (v || '').toString().toLowerCase())
                        .some(field => field.includes(lower));
                });
                this.renderPasswords();
            } else {
                this.showError('Search failed: ' + result.error);
            }
        } catch (error) {
            this.showError('Error searching: ' + error.message);
        }
    }

    /**
     * Retrieve stored image for a password from localStorage.  If no image is
     * stored, returns null.
     * @param {number|string} id
     * @returns {string|null}
     */
    getImageForPassword(id) {
        // First check if the password object has an image property (from the database).
        const pwObj = this.passwords ? this.passwords.find(p => p.id === id) : null;
        if (pwObj && pwObj.image) {
            return pwObj.image;
        }
        // Fallback to localStorage for backward compatibility
        try {
            const img = localStorage.getItem('passwordImage-' + id);
            return img || null;
        } catch (ex) {
            return null;
        }
    }

    /**
     * Handle image selection from the file input.  The selected file is either
     * uploaded to Imgur (if an API token is available) or converted to a data
     * URI and stored in the hidden #imageData input.  If the upload fails or no
     * token is provided, the local data URI will be used.
     *
     * @param {Event} e
     */
    async handleImageSelection(e) {
        const file = e.target && e.target.files && e.target.files[0];
        if (!file) return;

        // Hidden input where the image (data URI or uploaded URL) will be stored
        const hiddenInput = document.getElementById('imageData');
        if (!hiddenInput) return;

        // Read the file as a Data URL for preview/fallback
        const reader = new FileReader();
        reader.onload = async () => {
            let imageUrl = reader.result; // default to data URI for local preview and fallback

            // Attempt to upload to Imgur if a token or client ID is available.  Some users
            // may configure their own Imgur client ID via `this.imgurToken` or save it
            // under 'imgurToken' in localStorage.  If none is set, a default client ID
            // string can be provided.  If uploading fails for any reason (e.g. network
            // issues or invalid token), we silently fall back to using the local data URI.
            // Look for a user‑supplied Imgur client token or ID.  Do not fall back
            // to a hard‑coded default here.  If none is provided, skip the upload
            // entirely and simply use the local Data URI.  This avoids hitting
            // Imgur with anonymous requests that often result in errors (e.g. 429).
            const token = this.imgurToken || localStorage.getItem('imgurToken');
            if (token) {
                try {
                    const formData = new FormData();
                    formData.append('image', file);

                    const res = await fetch('https://api.imgur.com/3/image', {
                        method: 'POST',
                        headers: {
                            Authorization: token.startsWith('Client-ID') ? token : 'Client-ID ' + token
                        },
                        body: formData
                    });

                    const data = await res.json();
                    if (data && data.success && data.data && data.data.link) {
                        imageUrl = data.data.link;
                    } else {
                        console.warn('Imgur upload failed, using data URI instead:', data);
                    }
                } catch (err) {
                    console.error('Error uploading to Imgur:', err);
                    // Use data URI fallback
                }
            }

            // Persist the resulting URL/data URI in the hidden input and update the preview
            hiddenInput.value = imageUrl;
            this.setUploadBoxImage(imageUrl);
        };
        reader.readAsDataURL(file);
    }

    /**
     * Attempt to automatically fetch a favicon or logo for the given website
     * URL when the user has not manually selected an image.  This helper
     * extracts the hostname from the provided URL and constructs a link to
     * Google's favicon API (or any similar service) to retrieve a 128×128 icon.
     * If the hidden image input (#imageData) is already populated (e.g.
     * because the user uploaded a file), the function does nothing.  On
     * success it sets the hidden input's value to the remote URL and updates
     * the upload box preview.
     *
     * @param {string} urlString The website URL provided by the user
     */
    async fetchSiteLogo(urlString) {
        if (!urlString) return;
        // Do not override a user‑selected image
        const hiddenInput = document.getElementById('imageData');
        if (!hiddenInput || (hiddenInput.value && hiddenInput.value.trim() !== '')) {
            return;
        }
        try {
            const urlObj = new URL(urlString);
            const domain = urlObj.hostname;
            // Construct the URL to fetch the favicon.  Google’s favicon API
            // returns a PNG icon for the specified domain and size.  Other
            // services such as Clearbit (https://logo.clearbit.com/) could also
            // be used here.
            const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
            // Directly set the hidden input and preview to the remote URL.  We
            // intentionally avoid fetching the image here because browsers will
            // handle caching and CORS on the <img> element.  If the URL
            // resolves to a valid image, the preview will show it; otherwise
            // the default placeholder remains.
            hiddenInput.value = logoUrl;
            this.setUploadBoxImage(logoUrl);
        } catch (err) {
            console.error('Error fetching site logo:', err);
        }
    }

    openCategoriesModal() {
        this.renderCategoriesList();
        document.getElementById('categoriesModal').classList.add('active');
        document.getElementById('newCategoryName').focus();
    }

    closeCategoriesModal() {
        document.getElementById('categoriesModal').classList.remove('active');
        document.getElementById('newCategoryName').value = '';
    }

    renderCategoriesList() {
        const container = document.getElementById('categoriesList');
        container.innerHTML = '';

        if (this.categories.length === 0) {
            // Use translated strings for empty categories message
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--sidebar-text); opacity: 0.7;">
                    <p>${this.t('category_no_results')}</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">${this.t('category_create_first')}</p>
                </div>
            `;
            return;
        }

        this.categories.forEach(category => {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
                <input type="text" value="${this.escapeHtml(category.name)}" class="form-input category-name" data-id="${category.id}" style="flex: 1;">
                <button class="button button-secondary icon-btn" onclick="pm.updateCategory(${category.id})" aria-label="Edit category">
                    <span class="icon">✏️</span>
                </button>
                <button class="button button-danger icon-btn" onclick="pm.deleteCategory(${category.id})" aria-label="Delete category">
                    <span class="icon">🗑️</span>
                </button>
            `;
            container.appendChild(item);
        });
    }

    async addCategory() {
        const nameInput = document.getElementById('newCategoryName');
        const name = nameInput.value.trim();

        if (!name) {
            this.showError('Please enter a category name');
            nameInput.classList.add('shake');
            setTimeout(() => nameInput.classList.remove('shake'), 500);
            return;
        }

        if (this.categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
            this.showError('A category with this name already exists.');
            nameInput.classList.add('shake');
            setTimeout(() => nameInput.classList.remove('shake'), 500);
            return;
        }

        try {
            const result = await window.api.passwordManagerAddCategory(name);
            if (result.success) {
                nameInput.value = '';
                await this.loadCategories();
                this.renderCategoriesList();
                this.showSuccess('Category added successfully!');
            } else {
                this.showError('Failed to add category: ' + result.error);
            }
        } catch (error) {
            this.showError('Error adding category: ' + error.message);
        }
    }

    async updateCategory(categoryId) {
        const input = document.querySelector(`.category-name[data-id="${categoryId}"]`);
        const name = input.value.trim();

        if (!name) {
            this.showError('Category name cannot be empty');
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 500);
            return;
        }

        try {
            const result = await window.api.passwordManagerUpdateCategory(categoryId, name);
            if (result.success) {
                await this.loadCategories();
                this.renderCategoriesList();
                this.showSuccess('Category updated successfully!');
            } else {
                this.showError('Failed to update category: ' + result.error);
            }
        } catch (error) {
            this.showError('Error updating category: ' + error.message);
        }
    }

    async deleteCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        if (!confirm(`Are you sure you want to delete the category "${category.name}"? Passwords in this category will be moved to "No Category".`)) return;

        try {
            const result = await window.api.passwordManagerDeleteCategory(categoryId);
            if (result.success) {
                await this.loadCategories();
                this.renderCategoriesList();
                await this.loadPasswords(this.currentCategory);
                this.showSuccess('Category deleted successfully!');
            } else {
                this.showError('Failed to delete category: ' + result.error);
            }
        } catch (error) {
            this.showError('Error deleting category: ' + error.message);
        }
    }

    /**
     * Show the inline category input inside the add password modal.
     * This method toggles visibility of the hidden input and hides the plus button.
     * The actual save/cancel logic is handled via event listeners initialized
     * in initializeEventListeners().
     */
    promptAddCategoryInline() {
        // Toggle visibility of inline category input
        const plusBtn = document.getElementById('addCategoryInline');
        const wrapper = document.getElementById('inlineCategoryInputWrapper');
        const nameInput = document.getElementById('inlineCategoryName');
        if (plusBtn && wrapper) {
            plusBtn.classList.add('hidden');
            wrapper.classList.remove('hidden');
            if (nameInput) {
                nameInput.value = '';
                nameInput.focus();
            }
        }
    }

    togglePassword(button, passwordId) {
        const password = this.passwords.find(p => p.id === passwordId);
        if (!password) return;

        // Find the container that holds the password text.  In the redesigned
        // layout, the password toggle button sits within a row element rather
        // than a .password-value/.compact-value container, so look for the
        // closest password row instead.
        const valueContainer = button.closest('.password-row, .compact-password-row');
        if (!valueContainer) {
            console.error('Could not find password row for password toggle');
            return;
        }

        // Find the text element within that container
        const textElement = valueContainer.querySelector('.password-text, .compact-text');
        if (!textElement) {
            console.error('Could not find text element for password toggle');
            return;
        }

        // Determine which hidden class to use based on current mode
        const hiddenClass = this.isCompactMode ? 'compact-password-hidden' : 'password-hidden';

        // Toggle state: if hidden, show; if visible, hide
        if (textElement.classList.contains(hiddenClass)) {
            // Show the plain text password
            textElement.textContent = password.password;
            textElement.classList.remove(hiddenClass);
            // Swap to the eye‑off icon to indicate the password can be hidden
            button.innerHTML = this.svgEyeOff;
            button.title = this.t('hide_password');
            // Automatically hide again after 30 seconds
            setTimeout(() => {
                // Only proceed if the password is still visible
                if (!textElement.classList.contains(hiddenClass)) {
                    textElement.textContent = '••••••••';
                    textElement.classList.add(hiddenClass);
                    button.innerHTML = this.svgEye;
                    button.title = this.t('reveal_password');
                }
            }, 30000);
        } else {
            // Hide the password and restore bullet characters
            textElement.textContent = '••••••••';
            textElement.classList.add(hiddenClass);
            button.innerHTML = this.svgEye;
            button.title = this.t('reveal_password');
        }
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess(this.t('copied_to_clipboard'));
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showSuccess(this.t('copied_to_clipboard'));
            } catch (fallbackError) {
                this.showError(this.t('failed_copy'));
            }
            document.body.removeChild(textArea);
        }
    }

    /**
     * Copy a specified field from a password record to the clipboard.  This
     * helper finds the password object by its id and then copies the
     * requested field (e.g. 'username', 'email', 'password') if it exists.
     * Using this indirection avoids exposing the raw value in the HTML and
     * keeps the copy logic centralized.
     *
     * @param {number|string} passwordId The ID of the password record
     * @param {string} field The field name to copy ('username', 'email', 'password')
     */
    copyField(passwordId, field) {
        const pwd = this.passwords.find(p => p.id === passwordId);
        if (pwd && pwd[field]) {
            this.copyToClipboard(pwd[field]);
        }
    }

    /**
     * Toggle the visibility of the actions dropdown menu for edit/delete.
     * When a menu is opened, all other open menus are closed. Clicking
     * outside of the menu will close it automatically.
     * @param {Event} event The click event
     * @param {HTMLElement} btn The button that triggered the menu
     */
    toggleActionMenu(event, btn) {
        event.stopPropagation();
        // The next sibling of the button is the actions menu
        const menu = btn.nextElementSibling;
        if (!menu) return;
        const isVisible = menu.classList.contains('show');
        // Hide all other open menus
        document.querySelectorAll('.actions-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });
        // Toggle this menu
        if (isVisible) {
            menu.classList.remove('show');
        } else {
            menu.classList.add('show');
            // Attach one-time listener to close when clicking outside
            const onClickOutside = (e) => {
                if (!menu.contains(e.target) && e.target !== btn) {
                    menu.classList.remove('show');
                    document.removeEventListener('click', onClickOutside);
                }
            };
            document.addEventListener('click', onClickOutside);
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Display a toast-like notification message near the top right of the
     * viewport. The notification includes a colored accent bar, an icon
     * corresponding to the type (success, error, info) and a close button.
     * Only one notification is displayed at a time; any existing toast
     * messages are removed before the new one is shown. Notifications
     * automatically disappear after a short delay or when the user clicks
     * the close button.
     *
     * @param {string} message The message to display to the user
     * @param {'success' | 'error' | 'info'} type The notification type
     */
    showNotification(message, type = 'info') {
        // Remove any existing notifications so only one is visible at a time
        document.querySelectorAll('.notification').forEach(el => el.remove());

        // Create a wrapper container if it doesn't already exist. This
        // container anchors notifications at the top-right of the viewport
        let container = document.querySelector('.notifications-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notifications-container';
            document.body.appendChild(container);
        }

        // Create the notification element with appropriate type class
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        const icons = {
            success: { char: '✔', colorClass: 'icon-success' },
            error:   { char: '✖', colorClass: 'icon-error' },
            info:    { char: 'ℹ', colorClass: 'icon-info' }
        };
        const { char, colorClass } = icons[type] || icons.info;

        notification.innerHTML = `
            <div class="notification-inner">
                <div class="icon-wrapper ${colorClass}">${char}</div>
                <div class="message-wrapper">${this.escapeHtml(message)}</div>
                <button class="notification-close" aria-label="Close">×</button>
            </div>
        `;

        // Append the notification to the container
        container.appendChild(notification);

        // Hook up the close button to remove the notification
        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                notification.remove();
            });
        }

        // Automatically remove the notification after 4 seconds
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    /**
     * Immediately update the displayed image for a given password card in the UI.  This helper
     * searches for the card by its data attribute (data-password-id) and either updates the
     * existing <img> element's src or replaces an initial placeholder div with a proper <img>.
     *
     * @param {number|string} passwordId The ID of the password whose card should be updated.
     * @param {string} imageUrl The URL or data URI of the image to display.
     */
    updatePasswordImageInUI(passwordId, imageUrl) {
        if (!passwordId || !imageUrl) return;
        const passwordCard = document.querySelector(`[data-password-id="${passwordId}"]`);
        if (passwordCard) {
            const imgElement = passwordCard.querySelector('.card-image');
            if (imgElement) {
                if (imgElement.tagName === 'IMG') {
                    imgElement.src = imageUrl;
                } else {
                    // Replace a div with initial letter with an img element
                    const newImg = document.createElement('img');
                    newImg.className = 'card-image';
                    newImg.src = imageUrl;
                    newImg.alt = '';
                    imgElement.replaceWith(newImg);
                }
            }
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.pm = new PasswordManager();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PasswordManager;
}