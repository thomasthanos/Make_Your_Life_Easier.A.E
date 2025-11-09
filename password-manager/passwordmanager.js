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
        const storedMode = localStorage.getItem('pmCompactMode');
        this.isCompactMode = storedMode !== null ? storedMode === 'true' : false;
        this.isAuthenticated = false;

        this.imgurToken = null;
        
        this.authUI = new PasswordManagerAuthUI();
        this.observeCards = () => {};

        let langSetting = null;
        try {
            const settings = JSON.parse(localStorage.getItem('myAppSettings'));
            if (settings && typeof settings.lang === 'string' && settings.lang.length > 0) {
                langSetting = settings.lang.toLowerCase();
            }
        } catch (e) {
        }
        const docLang = (document.documentElement.lang || 'en').toLowerCase();
        const selectedLang = langSetting || docLang;
        this.lang = (selectedLang.startsWith('gr') || selectedLang.startsWith('el')) ? 'gr' : 'en';
        
        this.translations = {
            en: {
                add_password_btn: '+ Add Password',
                manage_categories_btn: '🏷️ Manage Categories',
                search_placeholder: 'Search passwords, usernames, emails...',
                cancel: 'Cancel',
                save_password: '💾 Save Password',
                no_category_option: 'No Category',
                title_label: 'Title',
                password_label: 'Password',
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
                add_first_password: 'Add Your First Password',
                stats_total: 'Total Passwords',
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
                open_website: 'Visit site',
                open_in_browser: 'Open in default browser',
                copy_username: 'Copy username',
                copy_email: 'Copy email',
                copy_password: 'Copy password',
                reveal_password: 'Reveal password',
                hide_password: 'Hide password',
                strong_password_generated: 'Strong password generated!',
                copied_to_clipboard: 'Copied to clipboard!',
                failed_copy: 'Failed to copy to clipboard. Please copy manually.',
                password_manager_unlocked: 'Password Manager unlocked!',
                compact_mode: '📱 Compact Mode',
                normal_mode: '📱 Normal Mode',
                new_category_prompt: 'Enter new category name:',
                username_or_email_required: 'Either Username or Email is required.',
                invalid_email_format: 'Invalid email format.',
                url_required: 'Website URL is required.'
            },
            gr: {
                add_password_btn: '+ Προσθήκη Κωδικού',
                manage_categories_btn: '🏷️ Διαχείριση Κατηγοριών',
                search_placeholder: 'Αναζήτηση κωδικών, usernames, emails...',
                cancel: 'Ακύρωση',
                save_password: '💾 Αποθήκευση Κωδικού',
                no_category_option: 'Χωρίς Κατηγορία',
                title_label: 'Τίτλος',
                password_label: 'Κωδικός',
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
                add_first_password: 'Προσθέστε τον πρώτο σας κωδικό',
                stats_total: 'Σύνολο Κωδικών',
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
                open_website: 'Επίσκεψη ιστότοπου',
                open_in_browser: 'Άνοιγμα στον προεπιλεγμένο browser',
                copy_username: 'Αντιγραφή ονόματος χρήστη',
                copy_email: 'Αντιγραφή email',
                copy_password: 'Αντιγραφή κωδικού',
                reveal_password: 'Προβολή κωδικού',
                hide_password: 'Απόκρυψη κωδικού',
                strong_password_generated: 'Δημιουργήθηκε ισχυρός κωδικός!',
                copied_to_clipboard: 'Αντιγράφηκε στο πρόχειρο!',
                failed_copy: 'Αποτυχία αντιγραφής στο πρόχειρο. Αντιγράψτε χειροκίνητα.',
                password_manager_unlocked: 'Ο διαχειριστής κωδικών ξεκλειδώθηκε!',
                compact_mode: '📱 Συμπαγής Λειτουργία',
                normal_mode: '📱 Κανονική Λειτουργία',
                new_category_prompt: 'Εισάγετε νέα κατηγορία:',
                username_or_email_required: 'Το πεδίο "Όνομα χρήστη" ή "Email" είναι υποχρεωτικό.',
                invalid_email_format: 'Μη έγκυρη μορφή email.',
                url_required: 'Το πεδίο Ιστότοπος είναι υποχρεωτικό.'
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
        } catch (error) {
            console.error('Auth initialization failed:', error);
        }
    }

    async onAuthSuccess() {
        if (this.isDataLoaded) {
            return;
        }

        this.isAuthenticated = true;
        await this.loadData();
        this.isDataLoaded = true;
        this.showSuccess(this.t('password_manager_unlocked'));
    }

    initializeEventListeners() {
        if (this.eventsInitialized) {
            return;
        }
        this.eventsInitialized = true;

        document.getElementById('addPasswordBtn').addEventListener('click', () => this.openPasswordModal());
        document.getElementById('closePasswordModal').addEventListener('click', () => this.closePasswordModal());
        document.getElementById('cancelPasswordBtn').addEventListener('click', () => this.closePasswordModal());
        document.getElementById('passwordForm').addEventListener('submit', (e) => this.savePassword(e));

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

        let searchTimeout;
        document.getElementById('searchInput').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.searchPasswords(e.target.value), 300);
        });

        document.getElementById('password').addEventListener('input', (e) => this.checkPasswordStrength(e.target.value));

        document.getElementById('password').addEventListener('focus', () => {
            this.addGeneratePasswordButton();
        });

        const imageFileInput = document.getElementById('imageFile');
        if (imageFileInput) {
            imageFileInput.addEventListener('change', (e) => this.handleImageSelection(e));
            const uploadBox = document.getElementById('imageUploadBox');
            if (uploadBox) {
                uploadBox.addEventListener('click', () => {
                    imageFileInput.click();
                });
            }
        }

        const urlInput = document.getElementById('url');
        if (urlInput) {
            urlInput.addEventListener('blur', (e) => {
                const urlValue = e.target.value ? e.target.value.trim() : '';
                if (urlValue) {
                    this.fetchSiteLogo(urlValue);
                }
            });
        }

        const gridToggleBtn = document.getElementById('gridToggle');
        if (gridToggleBtn) {
            gridToggleBtn.addEventListener('click', () => this.toggleCompactMode());
            const manager = document.querySelector('.password-manager');
            this.updateCompactToggleUI(gridToggleBtn, manager);
        }

        document.getElementById('categoriesModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeCategoriesModal();
        });

        document.getElementById('passwordModal').addEventListener('click', (e) => {
        });

        const inlineCatBtn = document.getElementById('addCategoryInline');
        const inlineWrapper = document.getElementById('inlineCategoryInputWrapper');
        const inlineNameInput = document.getElementById('inlineCategoryName');
        const inlineSaveBtn = document.getElementById('inlineCatSaveBtn');
        const inlineCancelBtn = document.getElementById('inlineCatCancelBtn');

        if (inlineCatBtn && inlineWrapper && inlineNameInput) {
            inlineCatBtn.addEventListener('click', () => {
                inlineCatBtn.classList.add('hidden');
                inlineWrapper.classList.remove('hidden');
                const selectEl = document.getElementById('category');
                if (selectEl) {
                    selectEl.classList.add('hidden');
                    const customSelect = document.getElementById('customCategorySelect');
                    if (customSelect) {
                        customSelect.classList.add('hidden');
                    }
                }
                inlineNameInput.value = '';
                inlineNameInput.focus();
            });
        }

        if (inlineSaveBtn && inlineWrapper && inlineCatBtn && inlineNameInput) {
            inlineSaveBtn.addEventListener('click', async () => {
                const name = inlineNameInput.value ? inlineNameInput.value.trim() : '';
                if (!name) {
                    this.showError('Παρακαλώ εισάγετε όνομα κατηγορίας.');
                    return;
                }
                if (this.categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
                    this.showError('Υπάρχει ήδη κατηγορία με αυτό το όνομα.');
                    return;
                }
                try {
                    const result = await window.api.passwordManagerAddCategory(name);
                    if (result && result.success) {
                        await this.loadCategories();
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
                inlineWrapper.classList.add('hidden');
                inlineCatBtn.classList.remove('hidden');
                const selectEl = document.getElementById('category');
                if (selectEl) {
                    selectEl.classList.remove('hidden');
                    const customSelect = document.getElementById('customCategorySelect');
                    if (customSelect) {
                        customSelect.classList.remove('hidden');
                    }
                }
                inlineNameInput.value = '';
            });
        }

        if (inlineCancelBtn && inlineWrapper && inlineCatBtn && inlineNameInput) {
            inlineCancelBtn.addEventListener('click', () => {
                inlineWrapper.classList.add('hidden');
                inlineCatBtn.classList.remove('hidden');
                const selectEl = document.getElementById('category');
                if (selectEl) {
                    selectEl.classList.remove('hidden');
                    const customSelect = document.getElementById('customCategorySelect');
                    if (customSelect) {
                        customSelect.classList.remove('hidden');
                    }
                }
                inlineNameInput.value = '';
            });
        }

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
        const manager = document.querySelector('.password-manager');
        this.updateCompactToggleUI(toggle, manager);
    }

    toggleCompactMode() {
        this.isCompactMode = !this.isCompactMode;
        console.log('Toggling compact mode to:', this.isCompactMode);
        console.log('Current passwords count:', this.passwords.length);
        
        const manager = document.querySelector('.password-manager');
        const toggle = document.querySelector('.compact-toggle');
        
        this.updateCompactToggleUI(toggle, manager);
        localStorage.setItem('pmCompactMode', this.isCompactMode);
        this.renderPasswords();
    }

    updateCompactToggleUI(toggle, manager) {
        if (!toggle || !manager) return;
        if (this.isCompactMode) {
            manager.classList.add('compact');
            toggle.classList.add('active');
        } else {
            manager.classList.remove('compact');
            toggle.classList.remove('active');
        }
        const labelKey = this.isCompactMode ? 'normal_mode' : 'compact_mode';
        toggle.setAttribute('aria-label', this.t(labelKey));
        if (!toggle.querySelector('.icon-grid')) {
            toggle.innerHTML = '';
            const icon = document.createElement('div');
            icon.className = 'icon-grid';
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

        this.observeCards = () => {
            document.querySelectorAll('.password-card, .compact-password-card').forEach(card => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                observer.observe(card);
            });
        };

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
        
        const existingBtn = formGroup.querySelector('.generate-password-btn');
        if (existingBtn) {
            existingBtn.remove();
        }
        const existingToggle = formGroup.querySelector('.toggle-visibility-btn');
        if (existingToggle) {
            existingToggle.remove();
        }
        
        const generateBtn = document.createElement('button');
        generateBtn.type = 'button';
        generateBtn.className = 'button generate-password-btn';
        generateBtn.setAttribute('aria-label', 'Generate strong password');
        generateBtn.innerHTML = '🎲';
        
        generateBtn.addEventListener('click', () => {
            this.generateStrongPassword();
        });

        const eyeClosedIcon = `
            <svg width="1.4em" height="1.4em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5C7 5 3.05 9.55 2 12c1.05 2.45 5 7 10 7s8.95-4.55 10-7c-1.05-2.45-5-7-10-7z" stroke="currentColor" stroke-width="2" fill="none" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2" />
            </svg>`;
        const eyeOpenIcon = `
            <svg width="1.4em" height="1.4em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5C7 5 3.05 9.55 2 12c1.05 2.45 5 7 10 7s8.95-4.55 10-7c-1.05-2.45-5-7-10-7z" stroke="currentColor" stroke-width="2" fill="none" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none" />
            </svg>`;

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'button toggle-visibility-btn';
        toggleBtn.setAttribute('aria-label', 'Toggle password visibility');
        toggleBtn.innerHTML = eyeClosedIcon;
        
        toggleBtn.addEventListener('click', () => {
            const input = document.getElementById('password');
            if (input.type === 'password') {
                input.type = 'text';
                toggleBtn.innerHTML = eyeOpenIcon;
                toggleBtn.classList.add('visible');
            } else {
                input.type = 'password';
                toggleBtn.innerHTML = eyeClosedIcon;
                toggleBtn.classList.remove('visible');
            }
        });
        
        const iconsContainer = document.createElement('div');
        iconsContainer.className = 'password-icons-container';
        iconsContainer.appendChild(toggleBtn);
        iconsContainer.appendChild(generateBtn);
        formGroup.appendChild(iconsContainer);

        requestAnimationFrame(() => {
            const passwordRect = passwordField.getBoundingClientRect();
            const groupRect = formGroup.getBoundingClientRect();
            const iconsRect = iconsContainer.getBoundingClientRect();
            const offsetTop = passwordRect.top - groupRect.top + (passwordRect.height - iconsRect.height) / 2;
            iconsContainer.style.top = `${offsetTop}px`;
        });
    }

    async loadData() {
        if (!window.api || window.api.isStub) {
            console.warn('Password manager APIs are not available; using sample data for demonstration.');
            this.isAuthenticated = true;
            this.categories = [
                { id: 1, name: 'email' },
                { id: 2, name: 'social media' },
                { id: 3, name: 'gaming' }
            ];
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
            this.passwords.forEach(p => {
                const cat = this.categories.find(c => String(c.id) === String(p.category_id));
                p.category_name = cat ? cat.name : '';
                const storedImg = localStorage.getItem('passwordImage-' + p.id);
                if (storedImg) {
                    p.image = storedImg;
                }
            });
            this.renderCategories();
            this.renderCategorySelect();
            this.calculateStats();
            this.renderPasswords();
            return;
        }

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
        this.stats.total = this.passwords.length;
        this.stats.categories = this.categories.length;
        this.stats.weak = this.passwords.filter(p => this.getPasswordStrength(p.password) === 'weak').length;
        this.stats.strong = this.passwords.filter(p => this.getPasswordStrength(p.password) !== 'weak').length;
        const passwordCounts = {};
        this.passwords.forEach(p => {
            passwordCounts[p.password] = (passwordCounts[p.password] || 0) + 1;
        });
        this.stats.reused = Object.values(passwordCounts).filter(count => count > 1).length;
        this.renderStats();
    }

    renderStats() {
        const container = document.getElementById('statsContainer');
        if (!container) return;
        const statsArray = [
            { icon: '🔒', value: this.stats.total, label: this.t('stats_total') },
            { icon: '🛡️', value: this.stats.strong || 0, label: this.t('stats_strong') },
            { icon: '⚠️', value: this.stats.weak, label: this.t('stats_weak') },
            { icon: '📂', value: this.stats.categories, label: this.t('stats_categories') }
        ];
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
        this.showSuccess(this.t('strong_password_generated'));
    }

    async loadCategories() {
        try {
            const result = await window.api.passwordManagerGetCategories();
            if (result.success) {
                if (Array.isArray(result.categories)) {
                    this.categories = result.categories.filter(cat => {
                        return !(cat && cat.name && typeof cat.name === 'string' && cat.name.toLowerCase() === 'general');
                    });
                } else {
                    this.categories = result.categories || [];
                }
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
        const noCat = typeof this.t === 'function' ? this.t('no_category_option') : 'No Category';
        select.innerHTML = `<option value="no_category">${noCat}</option>`;
        
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            select.appendChild(option);
        });

        this.renderCustomSelect();
    }

    renderCustomSelect() {
        const selectEl = document.getElementById('category');
        if (!selectEl) return;
        const wrapper = selectEl.closest('.category-select-wrapper');
        if (!wrapper) return;
        const existingCustom = wrapper.querySelector('.custom-select');
        if (existingCustom) {
            existingCustom.remove();
        }
        const custom = document.createElement('div');
        custom.className = 'custom-select';
        custom.setAttribute('id', 'customCategorySelect');
        const display = document.createElement('div');
        display.className = 'select-display';
        let selectedOption = selectEl.options[selectEl.selectedIndex];
        if (!selectedOption) {
            selectedOption = selectEl.options[0];
        }
        display.textContent = selectedOption ? selectedOption.textContent : '';
        custom.appendChild(display);
        const optionsList = document.createElement('div');
        optionsList.className = 'select-options';
        Array.from(selectEl.options).forEach(option => {
            const item = document.createElement('div');
            item.textContent = option.textContent;
            item.dataset.value = option.value;
            if (option.value === selectEl.value) {
                item.classList.add('selected');
            }
            item.addEventListener('click', (e) => {
                selectEl.value = option.value;
                const changeEvent = new Event('change', { bubbles: true });
                selectEl.dispatchEvent(changeEvent);
                display.textContent = option.textContent;
                optionsList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                custom.classList.remove('open');
            });
            optionsList.appendChild(item);
        });
        custom.appendChild(optionsList);
        display.addEventListener('click', (e) => {
            e.stopPropagation();
            custom.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (!custom.contains(e.target)) {
                custom.classList.remove('open');
            }
        });
        wrapper.insertBefore(custom, selectEl);
        selectEl.style.display = 'none';
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

        const svgCopy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
        const svgEye = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
        const svgDots = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><circle cx="12" cy="5" r="1.5" fill="currentColor"></circle><circle cx="12" cy="12" r="1.5" fill="currentColor"></circle><circle cx="12" cy="19" r="1.5" fill="currentColor"></circle></svg>`;
        const svgEdit = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.004 1.004 0 0 0 0-1.42l-2.34-2.34a1.004 1.004 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.83-1.82z"/></svg>`;
        const svgDelete = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zm3.46-9.12l1.41-1.41L12 10.59l1.12-1.12 1.42 1.42L13.41 12l1.13 1.12-1.42 1.42L12 13.41l-1.12 1.13-1.42-1.42L10.59 12l-1.13-1.12zm7.54-7.88V4H7V2h5.5l1-1h5v1h-3.54z"/></svg>`;
        const svgUser = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.31 0-10 1.67-10 5v3h20v-3c0-3.33-6.69-5-10-5z"/></svg>`;
        const svgMail = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>`;
        const svgLock = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-5 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-3-7V7a3 3 0 0 1 6 0v2H9z"/></svg>`;

        if (this.isCompactMode) {
        grid.innerHTML = this.passwords.map(password => {
            const title = this.escapeHtml(password.title);
            let categoryName = '';
            if (password.category_name && password.category_name !== 'no_category') {
                categoryName = this.escapeHtml(password.category_name);
            } else {
                const catObj = this.categories.find(c => String(c.id) === String(password.category_id));
                if (catObj) {
                    categoryName = this.escapeHtml(catObj.name);
                } else {
                    if (!password.category_id) {
                        categoryName = (typeof this.t === 'function' ? this.t('no_category_option') : 'No Category');
                    } else {
                        categoryName = '';
                    }
                }
            }
            const updatedDate = password.updated_at ? new Date(password.updated_at).toLocaleDateString() : '—';
            const username = password.username ? this.escapeHtml(password.username) : '';
            const email = password.email ? this.escapeHtml(password.email) : '';
            const infoValue = email || username;
            const infoIcon = email ? svgMail : (username ? svgUser : '');
            const infoField = email ? 'email' : (username ? 'username' : '');
            const infoTitle = email ? this.t('copy_email') : (username ? this.t('copy_username') : '');
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
                    <button class="compact-reveal-btn" onclick="pm.togglePassword(this, ${password.id})" title="${this.t('reveal_password')}">${svgEye}</button>
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
        grid.innerHTML = this.passwords.map(password => {
            const title = this.escapeHtml(password.title);
            let categoryName = '';
            if (password.category_name && password.category_name !== 'no_category') {
                categoryName = this.escapeHtml(password.category_name);
            } else {
                const catObj = this.categories.find(c => c.id === password.category_id);
                if (catObj) {
                    categoryName = this.escapeHtml(catObj.name);
                } else {
                    if (!password.category_id) {
                        categoryName = (typeof this.t === 'function' ? this.t('no_category_option') : 'No Category');
                    } else {
                        categoryName = '';
                    }
                }
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
                        <button class="menu-btn" onclick="pm.toggleActionMenu(event, this)" title="${this.t('options') || 'Options'}">${svgDots}</button>
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
                    <button class="reveal-btn" onclick="pm.togglePassword(this, ${password.id})" title="${this.t('reveal_password')}">${svgEye}</button>
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
    this.observeCards();
}

    async openExternal(url) {
        if (window.api && typeof window.api.openExternal === 'function') {
            await window.api.openExternal(url);
        } else {
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
            title.textContent = typeof this.t === 'function' ? this.t('modal_edit_title') : 'Edit Password';
            this.fillPasswordForm(passwordId);
            const password = this.passwords.find(p => p.id === passwordId);
            if (password) {
                this.setUploadBoxImage(password.image || null);
            }
        } else {
            title.textContent = typeof this.t === 'function' ? this.t('modal_add_title') : 'Add New Password';
            form.reset();
            document.getElementById('passwordId').value = '';
            document.getElementById('passwordStrength').className = 'strength-bar';

            const imgData = document.getElementById('imageData');
            if (imgData) imgData.value = '';
            const imgFile = document.getElementById('imageFile');
            if (imgFile) imgFile.value = '';

            this.setUploadBoxImage(null);
        }

        modal.classList.add('active');
        document.getElementById('title').focus();
        
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

    t(key) {
        if (this.translations && this.translations[this.lang] && this.translations[this.lang][key]) {
            return this.translations[this.lang][key];
        }
        return (this.translations && this.translations.en && this.translations.en[key]) || key;
    }

    applyTranslations() {
        try {
            const addBtnSpan = document.querySelector('#addPasswordBtn span');
            if (addBtnSpan) addBtnSpan.textContent = this.t('add_password_btn');
            const manageCatSpan = document.querySelector('#manageCategoriesBtn span');
            if (manageCatSpan) manageCatSpan.textContent = this.t('manage_categories_btn');

            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.placeholder = this.t('search_placeholder');

            const passwordModalTitle = document.getElementById('passwordModalTitle');
            if (passwordModalTitle) passwordModalTitle.textContent = this.t('modal_add_title');
            const cancelBtn = document.getElementById('cancelPasswordBtn');
            if (cancelBtn) cancelBtn.textContent = this.t('cancel');
            const saveBtnSpan = document.querySelector('#savePasswordBtn span');
            if (saveBtnSpan) saveBtnSpan.textContent = this.t('save_password');

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
        const catSelect = document.getElementById('category');
        if (catSelect) {
            if (!password.category_id) {
                catSelect.value = 'no_category';
            } else {
                catSelect.value = password.category_id;
            }
        }
        document.getElementById('username').value = password.username || '';
        document.getElementById('email').value = password.email || '';
        document.getElementById('password').value = password.password;
        document.getElementById('url').value = password.url || '';
        document.getElementById('notes').value = password.notes || '';

        const imgData = document.getElementById('imageData');
        if (imgData) imgData.value = password.image || '';

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

        const categorySelectEl = document.getElementById('category');
        const selectedCategoryId = categorySelectEl ? categorySelectEl.value : null;
        let selectedCategoryName = '';
        let categoryIdToStore = null;
        if (selectedCategoryId && selectedCategoryId !== 'no_category') {
            categoryIdToStore = selectedCategoryId;
            const catObj = this.categories.find(c => String(c.id) === selectedCategoryId);
            if (catObj) {
                selectedCategoryName = catObj.name;
            } else if (categorySelectEl) {
                const opt = categorySelectEl.options[categorySelectEl.selectedIndex];
                if (opt) selectedCategoryName = opt.textContent.trim();
            }
        } else {
            categoryIdToStore = null;
            selectedCategoryName = 'no_category';
        }

        const passwordData = {
            title: document.getElementById('title').value.trim(),
            category_id: categoryIdToStore,
            category_name: selectedCategoryName,
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim(),
            password: document.getElementById('password').value,
            url: document.getElementById('url').value.trim() || null,
            notes: document.getElementById('notes').value.trim() || null,
            image: document.getElementById('imageData') ? document.getElementById('imageData').value || null : null
        };

    console.log('Saving password data:', {
        title: passwordData.title,
        username: passwordData.username,
        passwordLength: passwordData.password ? passwordData.password.length : 0
    });

    if (!passwordData.title) {
        this.showError('Title is required.');
        document.getElementById('title').classList.add('shake');
        setTimeout(() => document.getElementById('title').classList.remove('shake'), 500);
        return;
    }

    if (!passwordData.password) {
        this.showError('Password is required.');
        document.getElementById('password').classList.add('shake');
        setTimeout(() => document.getElementById('password').classList.remove('shake'), 500);
        return;
    }

    if (passwordData.password.trim().length === 0) {
        this.showError('Password cannot be empty.');
        document.getElementById('password').classList.add('shake');
        setTimeout(() => document.getElementById('password').classList.remove('shake'), 500);
        return;
    }

    const usernameValRequired = passwordData.username;
    const emailValRequired = passwordData.email;
    if (!usernameValRequired && !emailValRequired) {
        const errorMsg = typeof this.t === 'function' ? this.t('username_or_email_required') : 'Either Username or Email is required.';
        this.showError(errorMsg);
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        if (usernameInput) usernameInput.classList.add('shake');
        if (emailInput) emailInput.classList.add('shake');
        setTimeout(() => {
            if (usernameInput) usernameInput.classList.remove('shake');
            if (emailInput) emailInput.classList.remove('shake');
        }, 500);
        return;
    }

    const urlValRequired = passwordData.url;
    if (!urlValRequired) {
        const errorMsg = typeof this.t === 'function' ? this.t('url_required') : 'Website URL is required.';
        this.showError(errorMsg);
        const urlInput = document.getElementById('url');
        if (urlInput) urlInput.classList.add('shake');
        setTimeout(() => {
            if (urlInput) urlInput.classList.remove('shake');
        }, 500);
        return;
    }

    const emailVal = document.getElementById('email').value.trim();
    if (emailVal && !this.isValidEmailUnicode(emailVal)) {
        const errMsg = typeof this.t === 'function' ? this.t('invalid_email_format') : 'Invalid email format.';
        this.showError(errMsg);
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
            const editingId = this.currentEditingId;

            const previousIds = this.passwords.map(p => p.id);

            this.closePasswordModal();

            let storedId = editingId || null;

            if (storedId && passwordData.image) {
                const existing = this.passwords.find(p => p.id === storedId);
                if (existing) {
                    existing.image = passwordData.image;
                }
            }

            await this.loadPasswords(this.currentCategory);

            if (!storedId && passwordData.image) {
                const newPw = this.passwords.find(p => !previousIds.includes(p.id));
                if (newPw) {
                    storedId = newPw.id;
                    newPw.image = passwordData.image;
                }
            }

            this.passwords.forEach(p => {
                const img = localStorage.getItem('passwordImage-' + p.id);
                if (img) {
                    p.image = img;
                }
            });

            this.renderPasswords();
            this.calculateStats();

            if (passwordData.image && storedId) {
                this.updatePasswordImageInUI(storedId, passwordData.image);
            }

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

    isAscii(str) { return /^[\x00-\x7F]*$/.test(str); }

    isValidEmailUnicode(value) {
    if (!value) return true;
    const parts = value.split('@');
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    if (!local || !domain) return false;
    const label = /^[\p{L}\p{M}\p{N}]+(?:[\p{L}\p{M}\p{N}-]*[\p{L}\p{M}\p{N}])?$/u;
    const labels = domain.split('.');
    if (labels.length < 2) return false;
    if (labels.some(l => !l || !label.test(l))) return false;
    if (/[^\S\r\n]/.test(local)) return false;
    return true;
    }

    async deletePassword(passwordId) {
        const password = this.passwords.find(p => p.id === passwordId);
        const confirmed = await this.showDeleteConfirm(password);
        if (!confirmed) return;

        try {
            const result = await window.api.passwordManagerDeletePassword(passwordId);
            if (result.success) {
                await this.loadPasswords(this.currentCategory);
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

    showDeleteConfirm(password) {
        return new Promise(resolve => {
            const modal = document.getElementById('deleteConfirmModal');
            const closeBtn = document.getElementById('deleteConfirmClose');
            const cancelBtn = document.getElementById('deleteCancelBtn');
            const confirmBtn = document.getElementById('deleteConfirmBtn');
            const titleEl = document.getElementById('deleteConfirmTitle');
            const messageEl = document.getElementById('deleteConfirmMessage');

            const defaultTitle = 'Επιβεβαίωση Διαγραφής';
            const defaultMsg = `Είστε σίγουροι ότι θέλετε να διαγράψετε τον κωδικό «${password?.title ?? ''}»; Η ενέργεια δεν μπορεί να αναιρεθεί.`;
            let translatedTitle = null;
            let translatedMsg = null;
            if (typeof this.t === 'function') {
                const maybeTitle = this.t('delete_confirm_title');
                if (maybeTitle && maybeTitle !== 'delete_confirm_title') {
                    translatedTitle = maybeTitle;
                }
                const maybeMsg = this.t('delete_confirm_message', { title: password?.title });
                if (maybeMsg && maybeMsg !== 'delete_confirm_message') {
                    translatedMsg = maybeMsg;
                }
            }
            titleEl.textContent = translatedTitle || defaultTitle;
            messageEl.textContent = translatedMsg || defaultMsg;

            modal.classList.add('active');

            const cleanup = () => {
                modal.classList.remove('active');
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

    setUploadBoxImage(url) {
        const uploadBox = document.getElementById('imageUploadBox');
        if (!uploadBox) return;
        const placeholder = uploadBox.querySelector('.upload-placeholder');
        let previewImg = uploadBox.querySelector('.upload-preview');
        if (url) {
            if (placeholder) placeholder.style.display = 'none';
            if (!previewImg) {
                previewImg = document.createElement('img');
                previewImg.className = 'upload-preview';
                uploadBox.appendChild(previewImg);
            }
            previewImg.src = url;
            previewImg.alt = 'Image preview';
        } else {
            if (previewImg) {
                previewImg.remove();
            }
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
        }
    }

    async searchPasswords(query) {
        if (!query.trim()) {
            await this.loadPasswords(this.currentCategory);
            return;
        }

        try {
            const result = await window.api.passwordManagerGetPasswords(this.currentCategory);
            if (result.success) {
                const allPasswords = result.passwords;
                const lower = query.toLowerCase();
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

    getImageForPassword(id) {
        const pwObj = this.passwords ? this.passwords.find(p => p.id === id) : null;
        if (pwObj && pwObj.image) {
            return pwObj.image;
        }
        try {
            const img = localStorage.getItem('passwordImage-' + id);
            return img || null;
        } catch (ex) {
            return null;
        }
    }

    async handleImageSelection(e) {
        const file = e.target && e.target.files && e.target.files[0];
        if (!file) return;

        const hiddenInput = document.getElementById('imageData');
        if (!hiddenInput) return;

        const reader = new FileReader();
        reader.onload = async () => {
            let imageUrl = reader.result;

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
                }
            }

            hiddenInput.value = imageUrl;
            this.setUploadBoxImage(imageUrl);
        };
        reader.readAsDataURL(file);
    }

    async fetchSiteLogo(urlString) {
        if (!urlString) return;
        const hiddenInput = document.getElementById('imageData');
        if (!hiddenInput || (hiddenInput.value && hiddenInput.value.trim() !== '')) {
            return;
        }
        try {
            const urlObj = new URL(urlString);
            const domain = urlObj.hostname;
            const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
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

    promptAddCategoryInline() {
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

        const valueContainer = button.closest('.password-row, .compact-password-row');
        if (!valueContainer) {
            console.error('Could not find password row for password toggle');
            return;
        }

        const textElement = valueContainer.querySelector('.password-text, .compact-text');
        if (!textElement) {
            console.error('Could not find text element for password toggle');
            return;
        }

        const hiddenClass = this.isCompactMode ? 'compact-password-hidden' : 'password-hidden';

        if (textElement.classList.contains(hiddenClass)) {
            textElement.textContent = password.password;
            textElement.classList.remove(hiddenClass);
            button.innerHTML = this.svgEyeOff;
            button.title = this.t('hide_password');
            setTimeout(() => {
                if (!textElement.classList.contains(hiddenClass)) {
                    textElement.textContent = '••••••••';
                    textElement.classList.add(hiddenClass);
                    button.innerHTML = this.svgEye;
                    button.title = this.t('reveal_password');
                }
            }, 30000);
        } else {
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

    copyField(passwordId, field) {
        const pwd = this.passwords.find(p => p.id === passwordId);
        if (pwd && pwd[field]) {
            this.copyToClipboard(pwd[field]);
        }
    }

    toggleActionMenu(event, btn) {
        event.stopPropagation();
        const menu = btn.nextElementSibling;
        if (!menu) return;
        const isVisible = menu.classList.contains('show');
        document.querySelectorAll('.actions-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });
        if (isVisible) {
            menu.classList.remove('show');
        } else {
            menu.classList.add('show');
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

    showNotification(message, type = 'info') {
        document.querySelectorAll('.notification').forEach(el => el.remove());

        let container = document.querySelector('.notifications-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notifications-container';
            document.body.appendChild(container);
        }

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

        container.appendChild(notification);

        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                notification.remove();
            });
        }

        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    updatePasswordImageInUI(passwordId, imageUrl) {
        if (!passwordId || !imageUrl) return;
        const passwordCard = document.querySelector(`[data-password-id="${passwordId}"]`);
        if (passwordCard) {
            const imgElement = passwordCard.querySelector('.card-image');
            if (imgElement) {
                if (imgElement.tagName === 'IMG') {
                    imgElement.src = imageUrl;
                } else {
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