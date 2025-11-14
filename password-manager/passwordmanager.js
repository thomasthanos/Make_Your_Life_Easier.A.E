// Modern debug logger with emojis and color-coded styles.
// Usage: debug('info', 'Message', {...});
function debug(level, ...args) {
    const emojiMap = { info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅' };
    const colorMap = {
        info: 'color:#2196F3; font-weight:bold;',
        warn: 'color:#FF9800; font-weight:bold;',
        error: 'color:#F44336; font-weight:bold;',
        success: 'color:#4CAF50; font-weight:bold;'
    };
    const emoji = emojiMap[level] || '';
    const style = colorMap[level] || '';
    // Determine if running in a browser environment to decide whether to use CSS styles
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    if (isBrowser) {
        // Select appropriate console method based on level
        const fn =
            level === 'error'
                ? console.error
                : level === 'warn'
                ? console.warn
                : console.log;
        fn.call(console, `%c${emoji}`, style, ...args);
    } else {
        // Fallback for Node/terminal environments
        const fn =
            level === 'error'
                ? console.error
                : level === 'warn'
                ? console.warn
                : console.log;
        fn.call(console, `${emoji}`, ...args);
    }
}

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
        
        // Placeholder for translations; will be populated from external JSON files
        this.translations = { en: {}, gr: {} };

        // Load translations then initialize UI and authentication.  Once
        // translations are available, static elements can be translated.
        this.loadTranslations().then(() => {
            this.initializeEventListeners();
            this.initializeAuth();
            this.initializeAnimations();
            this.applyTranslations();
        });

        this.eventsInitialized = false;
        this.isDataLoaded = false;
        this.svgCopy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
        this.svgEye = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon"><path fill="currentColor" d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
        this.svgEyeOff = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="svg-icon"><path fill="currentColor" d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z"/><path fill="currentColor" d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829"/><path fill="currentColor" d="M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z"/></svg>`;

        // Removed the delayed initialization; translations are loaded first.
    }

    async initializeAuth() {
        try {
            await this.authUI.initialize();
        } catch (error) {
            debug('error', 'Auth initialization failed:', error);
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
                // Validate category name using translation keys
                if (!name) {
                    this.showError(this.t('category_name_required'));
                    return;
                }
                // Check for duplicate names
                if (this.categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
                    this.showError(this.t('category_exists'));
                    return;
                }
                try {
                    const result = await window.api.passwordManagerAddCategory(name);
                    if (result && result.success) {
                        await this.loadCategories();
                        const newCat = this.categories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
                        const selectEl = document.getElementById('category');
                        if (newCat && selectEl) selectEl.value = newCat.id;
                        this.showSuccess(this.t('category_added_successfully'));
                    } else {
                        const err = result && result.error ? result.error : this.t('unknown_error');
                        this.showError(this.t('add_category_failed') + err);
                    }
                } catch (error) {
                    this.showError(this.t('add_category_error') + error.message);
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
        // No verbose logging for mode toggling; handled silently for modern UX
        
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
        // Accessible label for generate password button
        generateBtn.setAttribute('aria-label', this.t('generate_password_label'));
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
        // Accessible label for toggle password visibility
        toggleBtn.setAttribute('aria-label', this.t('toggle_password_visibility'));
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
            debug('warn', 'Password manager APIs are not available; using sample data for demonstration.');
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
            // Warn if data load is attempted without authentication
            debug('warn', 'Not authenticated, skipping data load');
            return;
        }

        // Informative log for starting data load
        debug('info', 'Loading password manager data...');

        const requiredApis = [
            'passwordManagerGetCategories',
            'passwordManagerGetPasswords',
            'passwordManagerAddPassword'
        ];

        const missingApis = requiredApis.filter(api => typeof window.api[api] !== 'function');

        if (missingApis.length > 0) {
            // Show a generic error if required APIs are missing
            this.showError(this.t('password_manager_apis_unavailable'));
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
                this.showError(this.t('load_categories_failed') + result.error);
            }
        } catch (error) {
            this.showError(this.t('load_categories_error') + error.message);
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
                this.showError(this.t('load_passwords_failed') + result.error);
            }
        } catch (error) {
            this.showError(this.t('load_passwords_error') + error.message);
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

    /* ====================================================================
     *                            Helper Methods
     * These helpers centralise logic used across multiple class methods to
     * reduce complexity and repetition.  They are defined before
     * `renderPasswords()` to ensure they are part of the PasswordManager
     * prototype.
     * ==================================================================== */

    /**
     * Helper: Determine the displayable category name for a password entry.
     * If the password already has a non‑`no_category` name, it is escaped and
     * returned.  Otherwise it attempts to look up the category by id in the
     * local categories list.  If no category id is present, a translated
     * “no category” fallback is returned.  An empty string is used when a
     * category id exists but no matching category can be found.  This logic
     * consolidates the repeated conditional checks used throughout the
     * rendering code.
     *
     * @param {Object} password The password object to inspect
     * @returns {string} The escaped category name or appropriate fallback
     */
    getCategoryName(password) {
        let categoryName = '';
        if (password.category_name && password.category_name !== 'no_category') {
            // explicit category name set on the password
            categoryName = this.escapeHtml(password.category_name);
        } else {
            // attempt to find the category by id
            const catObj = this.categories.find(c => String(c.id) === String(password.category_id));
            if (catObj) {
                categoryName = this.escapeHtml(catObj.name);
            } else {
                if (!password.category_id) {
                    // no category id provided, return the translated no-category option
                    categoryName = (typeof this.t === 'function' ? this.t('no_category_option') : 'No Category');
                } else {
                    // category id exists but not found in list
                    categoryName = '';
                }
            }
        }
        return categoryName;
    }

    /**
     * Helper: Returns a formatted date string for a password's `updated_at`
     * property.  If `updated_at` is falsy, a dash is returned instead.  This
     * helper centralises the date formatting logic.
     * @param {Object} password The password object containing the date
     * @returns {string} A locale date string or '—'
     */
    getUpdatedDate(password) {
        return password.updated_at ? new Date(password.updated_at).toLocaleDateString() : '—';
    }

    /**
     * Helper: Builds an HTML anchor element to open the password's URL in an
     * external browser.  If no URL is present, an empty string is returned.
     * The display URL is computed but currently unused; this method focuses on
     * consistent escaping and translation usage.
     * @param {Object} password The password object with the `url` property
     * @returns {string} A string containing an anchor tag or ''
     */
    getVisitLink(password) {
        if (!password.url) return '';
        try {
            // Parse to validate; host name not used but ensures correct URL
            const urlObj = new URL(password.url);
            void urlObj; // silence unused variable warning
        } catch (e) {
            // If parsing fails, we still attempt to use the raw value
        }
        return `<a href="#" onclick="pm.openExternal('${this.escapeHtml(password.url)}')" title="${this.t('open_in_browser')}">${this.t('open_website') || 'Visit site'}</a>`;
    }

    /**
     * Helper: Returns an HTML string representing either the stored image for
     * the password or a fallback with the first letter of the title.  This
     * function centralises image handling for both compact and full card views.
     * @param {Object} password The password object to render
     * @param {string} title The already escaped title string
     * @returns {string} An HTML string for the image element
     */
    getImageHtml(password, title) {
        const imgSrc = this.getImageForPassword(password.id);
        if (imgSrc) {
            return `<img src="${imgSrc}" class="card-image" alt="" />`;
        } else {
            const initial = title.trim().charAt(0).toUpperCase();
            return `<div class="card-image initial">${initial}</div>`;
        }
    }

    /**
     * Helper: Determines which info field to show on a compact password card.
     * It prioritises the email if present, otherwise falls back to the
     * username.  Returns an object containing the formatted value, the field
     * name for copying, the title for the copy button, and the appropriate
     * SVG icon.  This helps simplify the logic within the render method.
     *
     * @param {Object} password The password object
     * @param {Object} icons A mapping of SVG icon variables used for rendering
     * @returns {{value:string, field:string, title:string, icon:string}}
     */
    getCompactInfo(password, icons) {
        const username = password.username ? this.escapeHtml(password.username) : '';
        const email = password.email ? this.escapeHtml(password.email) : '';
        if (email) {
            return {
                value: email,
                field: 'email',
                title: this.t('copy_email'),
                icon: icons.mail
            };
        }
        if (username) {
            return {
                value: username,
                field: 'username',
                title: this.t('copy_username'),
                icon: icons.user
            };
        }
        return { value: '', field: '', title: '', icon: '' };
    }

    /**
     * Helper: Retrieves the selected category information from the category
     * dropdown.  Returns both the id (or null) and the name as strings.
     * Extracting this logic into a helper reduces complexity in savePassword.
     * @returns {{id:string|null, name:string}}
     */
    getSelectedCategoryInfo() {
        const categorySelectEl = document.getElementById('category');
        const selectedCategoryId = categorySelectEl ? categorySelectEl.value : null;
        let selectedCategoryName = '';
        let categoryIdToStore = null;
        if (selectedCategoryId && selectedCategoryId !== 'no_category') {
            categoryIdToStore = selectedCategoryId;
            // Try to find the category object from the local categories list
            const catObj = this.categories.find(c => String(c.id) === String(selectedCategoryId));
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
        return { id: categoryIdToStore, name: selectedCategoryName };
    }

    /**
     * Helper: Gathers and sanitises all password form inputs into a single
     * object.  Additional processing such as trimming values and defaulting
     * empty fields to null occurs here.  The category info should be
     * passed in from getSelectedCategoryInfo().
     *
     * @param {string|null} categoryId The selected category id or null
     * @param {string} categoryName The display name of the selected category
     * @returns {Object} A password data object ready to be saved
     */
    buildPasswordData(categoryId, categoryName) {
        const getValue = id => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };
        return {
            title: getValue('title'),
            category_id: categoryId,
            category_name: categoryName,
            username: getValue('username'),
            email: getValue('email'),
            password: document.getElementById('password')?.value ?? '',
            url: getValue('url') || null,
            notes: getValue('notes') || null,
            image: document.getElementById('imageData') ? (document.getElementById('imageData').value || null) : null
        };
    }

    /**
     * Helper: Validates the necessary fields of a password before save.  If
     * validation fails, this method will handle displaying the error message
     * and applying the appropriate shaking animation.  When validation
     * succeeds it returns null, otherwise it returns the name of the field
     * that failed which can be used by the caller if needed.
     *
     * @param {Object} passwordData The object returned from buildPasswordData()
     * @returns {string|null} The name of the invalid field or null if valid
     */
    validatePasswordInputs(passwordData) {
        // Title must not be empty
        if (!passwordData.title) {
            this.showError(this.t('title_required'));
            const titleInput = document.getElementById('title');
            if (titleInput) {
                titleInput.classList.add('shake');
                setTimeout(() => titleInput.classList.remove('shake'), 500);
            }
            return 'title';
        }
        // Password must exist and not be purely whitespace
        if (!passwordData.password) {
            this.showError(this.t('password_required'));
            const pwInput = document.getElementById('password');
            if (pwInput) {
                pwInput.classList.add('shake');
                setTimeout(() => pwInput.classList.remove('shake'), 500);
            }
            return 'password';
        }
        if (passwordData.password.trim().length === 0) {
            this.showError(this.t('password_empty'));
            const pwInput = document.getElementById('password');
            if (pwInput) {
                pwInput.classList.add('shake');
                setTimeout(() => pwInput.classList.remove('shake'), 500);
            }
            return 'password';
        }
        // At least one of username or email must be provided
        if (!passwordData.username && !passwordData.email) {
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
            return 'username_or_email';
        }
        // URL is required
        if (!passwordData.url) {
            this.showError(this.t('url_required'));
            const urlInput = document.getElementById('url');
            if (urlInput) {
                urlInput.classList.add('shake');
                setTimeout(() => urlInput.classList.remove('shake'), 500);
            }
            return 'url';
        }
        // Validate email format if provided
        if (passwordData.email) {
            if (!this.isValidEmailUnicode(passwordData.email)) {
                const errMsg = typeof this.t === 'function' ? this.t('invalid_email_format') : 'Invalid email format.';
                this.showError(errMsg);
                const emailInput = document.getElementById('email');
                if (emailInput) {
                    emailInput.classList.add('shake');
                    setTimeout(() => emailInput.classList.remove('shake'), 500);
                }
                return 'email';
            }
        }
        return null;
    }

    /**
     * Helper: Performs the asynchronous save or update via the appropriate
     * password manager API and updates the local state accordingly.  This
     * encapsulates the API interaction, UI locking/unlocking, error handling
     * and subsequent refresh of passwords and statistics.  All DOM updates
     * after a successful call are delegated to updateUIAfterSave().
     *
     * @param {Object} passwordData The data to save
     * @returns {Promise<void>}
     */
    async performSave(passwordData) {
        const saveBtn = document.getElementById('savePasswordBtn');
        const originalText = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.innerHTML = '<span class="loading"></span> Saving...';
            saveBtn.disabled = true;
        }
        let result;
        if (this.currentEditingId) {
            result = await window.api.passwordManagerUpdatePassword(this.currentEditingId, passwordData);
        } else {
            result = await window.api.passwordManagerAddPassword(passwordData);
        }
        if (saveBtn) {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
        if (result.success) {
            await this.updateUIAfterSave(passwordData);
            // Show appropriate success message
            if (this.currentEditingId) {
                this.showSuccess(this.t('password_updated_successfully'));
            } else {
                this.showSuccess(this.t('password_saved_successfully'));
            }
        } else {
            const errMsg = result.error || this.t('unknown_error');
            this.showError(this.t('save_password_failed') + errMsg);
        }
    }

    /**
     * Helper: Handles the post‑save UI updates such as reloading the passwords
     * from the server, updating local images, refreshing stats, and
     * re‑rendering the password grid.  This method ensures that the
     * necessary state changes occur in a single place.  It also closes the
     * password modal when appropriate.  Uses this.currentEditingId to
     * distinguish between add and update operations.
     *
     * @param {Object} passwordData The saved password data
     */
    async updateUIAfterSave(passwordData) {
        const editingId = this.currentEditingId;
        // store existing ids to detect new record after reload
        const previousIds = this.passwords.map(p => p.id);

        // close the modal before refreshing the list
        this.closePasswordModal();
        let storedId = editingId || null;

        // Preserve image for editing record before reload
        if (storedId && passwordData.image) {
            const existing = this.passwords.find(p => p.id === storedId);
            if (existing) {
                existing.image = passwordData.image;
            }
        }
        // reload passwords
        await this.loadPasswords(this.currentCategory);
        // After reload, update storedId if this is a new record and an image exists
        if (!storedId && passwordData.image) {
            const newPw = this.passwords.find(p => !previousIds.includes(p.id));
            if (newPw) {
                storedId = newPw.id;
                newPw.image = passwordData.image;
            }
        }
        // restore images from localStorage
        this.passwords.forEach(p => {
            const img = localStorage.getItem('passwordImage-' + p.id);
            if (img) {
                p.image = img;
            }
        });
        // re-render UI
        this.renderPasswords();
        this.calculateStats();
        // update the UI image element if needed
        if (passwordData.image && storedId) {
            this.updatePasswordImageInUI(storedId, passwordData.image);
        }
    }

renderPasswords() {
    // Trace rendering with layout info using modern logger
    debug('info', 'Rendering passwords, compact mode:', this.isCompactMode);
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
            // Map icons for use in compact info helper
            const icons = { user: svgUser, mail: svgMail };
            grid.innerHTML = this.passwords.map(password => {
                const title = this.escapeHtml(password.title);
                const categoryName = this.getCategoryName(password);
                const updatedDate = this.getUpdatedDate(password);
                const info = this.getCompactInfo(password, icons);
                const visitLink = this.getVisitLink(password);
                const imageHtml = this.getImageHtml(password, title);
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
                ${info.value ? `<div class="compact-info-line">
                    <span class="info-icon">${info.icon}</span>
                    <span class="info-value">${info.value}</span>
                    <button class="compact-copy-btn" onclick="pm.copyField(${password.id}, '${info.field}')" title="${info.title}">${svgCopy}</button>
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
            const categoryName = this.getCategoryName(password);
            const updatedDate = this.getUpdatedDate(password);
            const username = password.username ? this.escapeHtml(password.username) : '';
            const email = password.email ? this.escapeHtml(password.email) : '';
            const visitLink = this.getVisitLink(password);
            const imageHtml = this.getImageHtml(password, title);
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

    /**
     * Translation helper.  Looks up a key in the current language and falls
     * back to English if the key is missing.  If a params object is
     * provided, any placeholders in the translation string formatted as
     * `{placeholder}` will be replaced with the corresponding values.
     *
     * @param {string} key The translation key to look up.
     * @param {Object} [params] Optional map of placeholder values.
     * @returns {string} The translated string with any placeholders replaced.
     */
    t(key, params = {}) {
        let translation;
        if (this.translations && this.translations[this.lang] && this.translations[this.lang][key]) {
            translation = this.translations[this.lang][key];
        } else if (this.translations && this.translations.en && this.translations.en[key]) {
            translation = this.translations.en[key];
        } else {
            translation = key;
        }
        if (typeof translation === 'string' && params && Object.keys(params).length > 0) {
            return translation.replace(/\{([^}]+)\}/g, (match, p1) => {
                return Object.prototype.hasOwnProperty.call(params, p1) ? params[p1] : match;
            });
        }
        return translation;
    }

    /**
     * Load translations for the password manager UI.  This method fetches the
     * English base translations and then overlays the selected language.  The
     * translation files live in the top‑level `lang` folder.  If any fetch
     * fails, the translations object will remain with whatever data is
     * available and missing keys will fall back to English or the key itself.
     */
    async loadTranslations() {
        try {
            // Fetch the English base translations
            const enResponse = await fetch('lang/en.json');
            const enData = await enResponse.json();
            let langData = {};
            if (this.lang && this.lang !== 'en') {
                try {
                    const langResponse = await fetch(`lang/${this.lang}.json`);
                    langData = await langResponse.json();
                } catch (err) {
                    debug('error', 'Failed to load language file:', err);
                }
            }
            this.translations = {
                en: enData,
                [this.lang]: { ...enData, ...langData }
            };
        } catch (error) {
            debug('error', 'Error loading translations:', error);
            // leave translations as empty objects on failure
        }
    }

    applyTranslations() {
        try {
            this.applyTopBarTranslations();
            this.applyFormFieldTranslations();
            this.applyCategorySelectTranslations();
            this.applyCategoriesModalTranslations();
            this.applyDeleteModalTranslations();
        } catch (err) {
            debug('error', 'Error applying translations:', err);
        }
    }

    /**
     * Translation helper: apply translations to the top bar and global UI
     * components such as the add password button, manage categories button,
     * search placeholder, tagline, categories label and grid toggle title.
     */
    applyTopBarTranslations() {
        const addBtnSpan = document.querySelector('#addPasswordBtn span');
        if (addBtnSpan) addBtnSpan.textContent = this.t('add_password_btn');
        const manageCatSpan = document.querySelector('#manageCategoriesBtn span');
        if (manageCatSpan) manageCatSpan.textContent = this.t('manage_categories_btn');
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.placeholder = this.t('search_placeholder');
        const tagline = document.querySelector('.app-tagline');
        if (tagline) tagline.textContent = this.t('app_tagline');
        const categoriesLabel = document.querySelector('.categories-label');
        if (categoriesLabel) categoriesLabel.textContent = this.t('categories_label');
        const gridToggle = document.getElementById('gridToggle');
        if (gridToggle) gridToggle.title = this.t('toggle_layout');
    }

    /**
     * Translation helper: apply translations to form labels and placeholders
     * within the password modal.  Uses mapping objects to iterate over
     * supported fields.
     */
    applyFormFieldTranslations() {
        // Modal title and buttons
        const passwordModalTitle = document.getElementById('passwordModalTitle');
        if (passwordModalTitle) passwordModalTitle.textContent = this.t('modal_add_title');
        const cancelBtn = document.getElementById('cancelPasswordBtn');
        if (cancelBtn) cancelBtn.textContent = this.t('cancel_button');
        const saveBtnSpan = document.querySelector('#savePasswordBtn span');
        if (saveBtnSpan) saveBtnSpan.textContent = this.t('save_password');
        // Image label and upload instructions
        const imageLabel = document.querySelector("label[for='imageFile']");
        if (imageLabel) imageLabel.textContent = this.t('image_label');
        const uploadPlaceholder = document.querySelector('#imageUploadBox .upload-placeholder');
        if (uploadPlaceholder) {
            const children = uploadPlaceholder.children;
            if (children && children.length >= 3) {
                children[1].textContent = this.t('upload_click');
                children[2].textContent = this.t('upload_formats');
            }
        }
        // Form field labels
        const labelMap = {
            'title': 'title_label',
            'password': 'password_label',
            'url': 'url_label',
            'category': 'category_label',
            'username': 'username_label',
            'notes': 'notes_label',
            'email': 'email_label'
        };
        Object.keys(labelMap).forEach(inputId => {
            const label = document.querySelector(`label[for='${inputId}']`);
            if (label) label.textContent = this.t(labelMap[inputId]);
        });
        // Form field placeholders
        const placeholderMap = {
            'title': 'title_placeholder',
            'password': 'password_placeholder',
            'url': 'url_placeholder',
            'username': 'username_placeholder',
            'notes': 'notes_placeholder',
            'email': 'email_placeholder'
        };
        Object.keys(placeholderMap).forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) input.placeholder = this.t(placeholderMap[inputId]);
        });
    }

    /**
     * Translation helper: apply the translation to the first option of the
     * category select element which represents the 'no category' option.
     */
    applyCategorySelectTranslations() {
        const categorySelect = document.getElementById('category');
        if (categorySelect) {
            const firstOption = categorySelect.querySelector('option[value=""]');
            if (firstOption) firstOption.textContent = this.t('no_category_option');
        }
    }

    /**
     * Translation helper: apply translations for the categories management
     * modal, including modal title, input placeholder, and buttons.
     */
    applyCategoriesModalTranslations() {
        const catModalTitle = document.querySelector('#categoriesModal h2');
        if (catModalTitle) catModalTitle.textContent = this.t('manage_categories_title');
        const newCatInput = document.getElementById('newCategoryName');
        if (newCatInput) newCatInput.placeholder = this.t('new_category_placeholder');
        const addCatBtn = document.getElementById('addCategoryBtn');
        if (addCatBtn) addCatBtn.textContent = this.t('add_category_btn');
        const closeCatBtn = document.getElementById('closeCategoriesBtn');
        if (closeCatBtn) closeCatBtn.textContent = this.t('close_button');
        const closeCatModal = document.getElementById('closeCategoriesModal');
        if (closeCatModal) closeCatModal.title = this.t('close_button');
    }

    /**
     * Translation helper: apply translations for the delete confirmation modal
     * buttons and icons.
     */
    applyDeleteModalTranslations() {
        const delCancelBtn = document.getElementById('deleteCancelBtn');
        if (delCancelBtn) delCancelBtn.textContent = this.t('cancel_button');
        const delConfirmBtn = document.getElementById('deleteConfirmBtn');
        if (delConfirmBtn) delConfirmBtn.textContent = this.t('delete_button');
        const delCloseBtn = document.getElementById('deleteConfirmClose');
        if (delCloseBtn) delCloseBtn.title = this.t('close_button');
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
    // Ensure the API is available before proceeding
    if (!window.api || typeof window.api.passwordManagerAddPassword !== 'function') {
        this.showError(this.t('password_manager_unavailable'));
        return;
    }
    // Determine selected category information
    const { id: categoryIdToStore, name: selectedCategoryName } = this.getSelectedCategoryInfo();
    // Build the password data object
    const passwordData = this.buildPasswordData(categoryIdToStore, selectedCategoryName);
    // Log debug information about the incoming data
    debug('info', 'Saving password data:', {
        title: passwordData.title,
        username: passwordData.username,
        passwordLength: passwordData.password ? passwordData.password.length : 0
    });
    // Validate inputs; if invalid, abort
    const invalidField = this.validatePasswordInputs(passwordData);
    if (invalidField) return;
    try {
        await this.performSave(passwordData);
    } catch (error) {
        debug('error', 'Save password error:', error);
        this.showError(this.t('save_password_error') + error.message);
        const saveBtn = document.getElementById('savePasswordBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<span>💾 Save Password</span>';
            saveBtn.disabled = false;
        }
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
                // Successfully deleted
                const msg = typeof this.t === 'function' ? this.t('password_deleted_successfully') : 'Password deleted successfully!';
                this.showSuccess(msg);
            } else {
                const errMsg = typeof this.t === 'function' ? this.t('delete_password_failed') : 'Failed to delete password: ';
                this.showError(errMsg + result.error);
            }
        } catch (error) {
            const errMsg = typeof this.t === 'function' ? this.t('delete_password_error') : 'Error deleting password: ';
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

            // Default English fallback values if translations are missing
            const defaultTitle = 'Confirm Deletion';
            const defaultMsg = `Are you sure you want to delete “${password?.title ?? ''}”? This action cannot be undone.`;
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
                this.showError(this.t('search_failed') + result.error);
            }
        } catch (error) {
            this.showError(this.t('search_error') + error.message);
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
                        debug('warn', 'Imgur upload failed, using data URI instead:', data);
                    }
                } catch (err) {
                    debug('error', 'Error uploading to Imgur:', err);
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
            debug('error', 'Error fetching site logo:', err);
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
            this.showError(this.t('category_name_required'));
            nameInput.classList.add('shake');
            setTimeout(() => nameInput.classList.remove('shake'), 500);
            return;
        }

        if (this.categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
            this.showError(this.t('category_exists'));
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
                this.showSuccess(this.t('category_added_successfully'));
            } else {
                this.showError(this.t('add_category_failed') + result.error);
            }
        } catch (error) {
            this.showError(this.t('add_category_error') + error.message);
        }
    }

    async updateCategory(categoryId) {
        const input = document.querySelector(`.category-name[data-id="${categoryId}"]`);
        const name = input.value.trim();

        if (!name) {
            this.showError(this.t('category_name_empty'));
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 500);
            return;
        }

        try {
            const result = await window.api.passwordManagerUpdateCategory(categoryId, name);
            if (result.success) {
                await this.loadCategories();
                this.renderCategoriesList();
                this.showSuccess(this.t('category_updated_successfully'));
            } else {
                this.showError(this.t('update_category_failed') + result.error);
            }
        } catch (error) {
            this.showError(this.t('update_category_error') + error.message);
        }
    }

    async deleteCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        // Confirm deletion using translated message
        const confirmMsg = this.t('delete_category_confirm', { categoryName: category.name });
        if (!confirm(confirmMsg)) return;

        try {
            const result = await window.api.passwordManagerDeleteCategory(categoryId);
            if (result.success) {
                await this.loadCategories();
                this.renderCategoriesList();
                await this.loadPasswords(this.currentCategory);
                this.showSuccess(this.t('category_deleted_successfully'));
            } else {
                this.showError(this.t('delete_category_failed') + result.error);
            }
        } catch (error) {
            this.showError(this.t('delete_category_error') + error.message);
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
            debug('error', 'Could not find password row for password toggle');
            return;
        }

        const textElement = valueContainer.querySelector('.password-text, .compact-text');
        if (!textElement) {
            debug('error', 'Could not find text element for password toggle');
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