// auth-ui.js - Ολοκληρωμένο με custom forgot password και show/hide password

// Modern debug logger with emojis and color-coded styles.
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
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    if (isBrowser) {
        const fn =
            level === 'error'
                ? console.error
                : level === 'warn'
                ? console.warn
                : console.log;
        fn.call(console, `%c${emoji}`, style, ...args);
    } else {
        const fn =
            level === 'error'
                ? console.error
                : level === 'warn'
                ? console.warn
                : console.log;
        fn.call(console, `${emoji}`, ...args);
    }
}
class PasswordManagerAuthUI {
    constructor() {
        this.isInitialized = false;
        this.hasMasterPassword = false;
        this.authModal = null;

        let selectedLang = null;
        try {
            const settings = JSON.parse(localStorage.getItem('myAppSettings'));
            if (settings && typeof settings.lang === 'string' && settings.lang.length > 0) {
                selectedLang = settings.lang.toLowerCase();
            }
        } catch (e) {
            // ignore parsing errors
        }
        // If no saved language, use the document's lang attribute
        if (!selectedLang) {
            const docLang = (document.documentElement.lang || 'en').toLowerCase();
            selectedLang = docLang;
        }
        this.lang = (selectedLang.startsWith('gr') || selectedLang.startsWith('el')) ? 'gr' : 'en';

        // Placeholder for translations; will be loaded from external JSON files
        this.translations = { en: {}, gr: {} };
    }

    /**
     * Translation helper. Looks up a key in the current language and
     * falls back to English if the key is missing. If a params object is
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
     * Load translations for the auth UI. Fetches the English base translations
     * and then overlays the selected language. Translation files live in the
     * top‑level `lang` folder. If any fetch fails, the translations object
     * will remain with whatever data is available and missing keys will fall
     * back to English or the key itself.
     */
    async loadTranslations() {
        try {
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

    async initialize() {
        // Load translations before any UI is rendered.  Ensures
        // translation keys are available when building the modals.
        await this.loadTranslations();

        if (this.isInitialized) return;

        try {
            const result = await window.api.passwordManagerHasMasterPassword();
            this.hasMasterPassword = result;

            this.isInitialized = true;

            if (!this.hasMasterPassword) {
                this.showSetupModal();
            } else {
                this.showLoginModal();
            }
        } catch (error) {
            debug('error', 'Auth initialization error:', error);
            // Use translated prefix for initialization errors
            this.showErrorModal(this.t('init_error_prefix') + error.message);
        }
    }

    showSetupModal() {
        this.closeAuthModal();

        const modal = document.createElement('div');
        modal.className = 'auth-modal active';
        modal.innerHTML = `
            <div class="auth-modal-overlay">
                <div class="auth-modal-content">
                    ${this.createSetupForm()}
                    <div class="auth-modal-warning">
                        ${this.t('warning_prefix')} <strong>${this.t('warning_attention')}</strong> ${this.t('warning_reset_note')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.authModal = modal;

        setTimeout(() => this.attachSetupEventListeners(), 100);
    }

    showLoginModal() {
        this.closeAuthModal();

        const modal = document.createElement('div');
        modal.className = 'auth-modal active';
        modal.innerHTML = `
            <div class="auth-modal-overlay">
                <div class="auth-modal-content">
                    ${this.createLoginForm()}
                    <div class="auth-modal-warning">
                        ${this.t('warning_prefix')} <strong>${this.t('warning_attention')}</strong> ${this.t('warning_reset_note')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.authModal = modal;

        setTimeout(() => this.attachLoginEventListeners(), 100);
    }

    createSetupForm() {
        return `
            <div class="card">
                <h4 class="title">${this.t('setup_title')}</h4>
                <form id="setupForm" class="auth-form">
                    <div class="field has-hint">
                        <!-- Lock icon for password field -->
                        <svg class="input-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                            <path fill-rule="evenodd" d="M8 0a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4M4.5 7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7zM8 1a3 3 0 0 0-3 3v2h6V4a3 3 0 0 0-3-3"/>
                        </svg>
                        <input type="password" id="masterPassword" class="input-field password-input" 
                               placeholder="${this.t('create_master_placeholder')}" required
                               minlength="8" autocomplete="new-password">
                        <button type="button" class="password-toggle" onclick="pmAuthUI.togglePasswordVisibility('masterPassword')" title="${this.t('show_password')}">
                            <svg class="eye-open-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12 C3 7, 8 4, 12 4 C16 4, 21 7, 23 12 C21 17, 16 20, 12 20 C8 20, 3 17, 1 12 Z"/>
                                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                            </svg>
                            <svg class="eye-closed-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                                <path d="M1 12 C3 7, 8 4, 12 4 C16 4, 21 7, 23 12 C21 17, 16 20, 12 20 C8 20, 3 17, 1 12 Z"/>
                                <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    </div>
                    <!-- Hint for minimum password length displayed below the first password field -->
                    <div class="input-hint">${this.t('create_master_hint')}</div>
                    <div id="passwordStrength" class="password-strength-container"></div>
                    
                    <div class="field">
                        <!-- Lock icon for confirm password field -->
                        <svg class="input-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                            <path fill-rule="evenodd" d="M8 0a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4M4.5 7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7zM8 1a3 3 0 0 0-3 3v2h6V4a3 3 0 0 0-3-3"/>
                        </svg>
                        <input type="password" id="confirmPassword" class="input-field password-input" 
                               placeholder="${this.t('confirm_placeholder')}" required
                               autocomplete="new-password">
                        <button type="button" class="password-toggle" onclick="pmAuthUI.togglePasswordVisibility('confirmPassword')" title="${this.t('show_password')}">
                            <svg class="eye-open-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12 C3 7, 8 4, 12 4 C16 4, 21 7, 23 12 C21 17, 16 20, 12 20 C8 20, 3 17, 1 12 Z"/>
                                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                            </svg>
                            <svg class="eye-closed-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                                <path d="M1 12 C3 7, 8 4, 12 4 C16 4, 21 7, 23 12 C21 17, 16 20, 12 20 C8 20, 3 17, 1 12 Z"/>
                                <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    </div>
                    <div id="passwordMatch" class="password-match"></div>
                    
                    <button class="btn" type="submit" id="setupBtn">${this.t('create_button')}</button>
                </form>
            </div>
        `;
    }

    createLoginForm() {
        return `
            <div class="card">
                <h4 class="title">${this.t('login_title')}</h4>
                <form id="loginForm" class="auth-form">
                    <div class="field">
                        <!-- Lock icon for login password field -->
                        <svg class="input-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                            <path fill-rule="evenodd" d="M8 0a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4M4.5 7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7zM8 1a3 3 0 0 0-3 3v2h6V4a3 3 0 0 0-3-3"/>
                        </svg>
                        <input autocomplete="off" id="loginPassword" placeholder="${this.t('login_placeholder')}" class="input-field password-input" name="logpass" type="password" required autofocus>
                        <button type="button" class="password-toggle" onclick="pmAuthUI.togglePasswordVisibility('loginPassword')" title="${this.t('show_password')}">
                            <svg class="eye-open-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12 C3 7, 8 4, 12 4 C16 4, 21 7, 23 12 C21 17, 16 20, 12 20 C8 20, 3 17, 1 12 Z"/>
                                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                            </svg>
                            <svg class="eye-closed-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                                <path d="M1 12 C3 7, 8 4, 12 4 C16 4, 21 7, 23 12 C21 17, 16 20, 12 20 C8 20, 3 17, 1 12 Z"/>
                                <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    </div>
                    <button class="btn" type="submit" id="loginBtn">${this.t('login_button')}</button>
                    <a href="#" class="btn-link" id="forgotPasswordLink">${this.t('forgot_link')}</a>
                </form>
            </div>
        `;
    }

    createForgotPasswordModal() {
        return `
            <div class="card">
                <h4 class="title">${this.t('forgot_title')}</h4>
                <div class="forgot-password-content">
                    <div class="warning-icon">${this.t('warning_prefix')}</div>
                    <p class="forgot-warning-text">
                        <strong>${this.t('irreversible_action')}</strong><br><br>
                        ${this.t('forgot_warning_1')}
                        ${this.t('forgot_warning_delete')}
                    </p>
                    <ul class="forgot-list">
                        <li>${this.t('forgot_list_passwords')}</li>
                        <li>${this.t('forgot_list_categories')}</li>
                        <li>${this.t('forgot_list_settings')}</li>
                    </ul>
                    <p class="forgot-warning-text">
                        ${this.t('forgot_warning_2')}
                    </p>
                    <div class="forgot-actions">
                        <button class="btn btn-danger" id="confirmResetBtn">${this.t('reset_button')}</button>
                        <button class="btn btn-secondary" id="cancelResetBtn">${this.t('cancel_button')}</button>
                    </div>
                </div>
            </div>
        `;
    }

    togglePasswordVisibility(inputId) {
        // Retrieve the target input and its associated toggle button
        const input = document.getElementById(inputId);
        if (!input) return;
        const toggleButton = input.nextElementSibling;
        if (!toggleButton) return;

        // Locate the eye icons inside the toggle button
        const eyeOpen = toggleButton.querySelector('.eye-open-icon');
        const eyeClosed = toggleButton.querySelector('.eye-closed-icon');

        // Toggle the input type and update icon visibility and tooltip
        if (input.type === 'password') {
            input.type = 'text';
            if (eyeOpen) eyeOpen.style.display = 'none';
            if (eyeClosed) eyeClosed.style.display = 'inline';
            // Use translation keys if available
            toggleButton.title = this.t('hide_password');
        } else {
            input.type = 'password';
            if (eyeOpen) eyeOpen.style.display = 'inline';
            if (eyeClosed) eyeClosed.style.display = 'none';
            toggleButton.title = this.t('show_password');
        }
    }

    attachSetupEventListeners() {
        const setupForm = document.getElementById('setupForm');
        const masterPassword = document.getElementById('masterPassword');
        const confirmPassword = document.getElementById('confirmPassword');

        if (setupForm && masterPassword && confirmPassword) {
            masterPassword.addEventListener('input', (e) => {
                this.checkPasswordStrength(e.target.value);
                this.checkPasswordMatch();
            });

            confirmPassword.addEventListener('input', this.checkPasswordMatch.bind(this));

            setupForm.addEventListener('submit', (e) => this.handleSetup(e));
        }
    }

    attachLoginEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const forgotLink = document.getElementById('forgotPasswordLink');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        if (forgotLink) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showForgotPasswordModal();
            });
        }
    }

    showForgotPasswordModal() {
        this.closeAuthModal();

        const modal = document.createElement('div');
        modal.className = 'auth-modal active forgot-modal';
        modal.innerHTML = `
            <div class="auth-modal-overlay">
                <div class="auth-modal-content">
                    ${this.createForgotPasswordModal()}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.authModal = modal;

        setTimeout(() => {
            const confirmBtn = document.getElementById('confirmResetBtn');
            const cancelBtn = document.getElementById('cancelResetBtn');

            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => this.handlePasswordReset());
            }

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.closeAuthModal();
                    this.showLoginModal();
                });
            }
        }, 100);
    }

    async handlePasswordReset() {
        try {
            const result = await window.api.passwordManagerReset();
            if (result.success) {
                this.showSuccess(this.t('reset_success'));
                this.closeAuthModal();
                this.showSetupModal();
            } else {
                this.showError(this.t('reset_error_prefix') + result.error);
            }
        } catch (error) {
            this.showError(this.t('general_error_prefix') + error.message);
        }
    }

    async checkPasswordStrength(password) {
        const container = document.getElementById('passwordStrength');
        if (!container) return;

        try {
            const result = await window.api.passwordManagerValidatePassword(password);

            if (!result.isValid) {
                container.innerHTML = `
                    <div class="error-alert">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <svg aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" class="error-svg">
                                    <path clip-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" fill-rule="evenodd"></path>
                                </svg>
                            </div>
                            <div class="error-prompt-container">
                                <p class="error-prompt-heading">${this.t('password_strength_error_heading')}</p>
                                <div class="error-prompt-wrap">
                                    <ul class="error-prompt-list" role="list">
                                        <li>${this.t('password_strength_error_hint1')}</li>
                                        <li>${this.t('password_strength_error_hint2')}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = '';
            }
        } catch (error) {
            debug('error', 'Error validating password:', error);
        }
    }

    checkPasswordMatch() {
        const container = document.getElementById('passwordMatch');
        const masterPassword = document.getElementById('masterPassword');
        const confirmPassword = document.getElementById('confirmPassword');

        if (!container || !masterPassword || !confirmPassword) return;

        if (confirmPassword.value.length === 0) {
            container.innerHTML = '';
        } else if (masterPassword.value === confirmPassword.value) {
            container.innerHTML = '<div class="match-success">' + this.t('password_match_success') + '</div>';
        } else {
            container.innerHTML = '<div class="match-error">' + this.t('password_match_error') + '</div>';
        }
    }

    async handleSetup(e) {
        e.preventDefault();

        const masterPassword = document.getElementById('masterPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const btn = document.getElementById('setupBtn');

        if (masterPassword !== confirmPassword) {
            this.showError(this.t('passwords_do_not_match_error'));
            return;
        }

        const strengthResult = await window.api.passwordManagerValidatePassword(masterPassword);
        if (!strengthResult.isValid) {
            this.showError(this.t('weak_password_error'));
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="loading"></span> ' + this.t('setup_loading');

        try {
            const result = await window.api.passwordManagerCreateMasterPassword(masterPassword);

            if (result.success) {
                this.showSuccess(this.t('setup_success'));
                this.closeAuthModal();

                setTimeout(() => {
                    if (window.pm && typeof window.pm.onAuthSuccess === 'function') {
                        window.pm.onAuthSuccess();
                    }
                }, 1000);
            } else {
                this.showError(this.t('setup_error_prefix') + result.error);
                btn.disabled = false;
                btn.innerHTML = this.t('create_button');
            }
        } catch (error) {
            this.showError(this.t('general_error_prefix') + error.message);
            btn.disabled = false;
            btn.innerHTML = this.t('create_button');
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        const password = document.getElementById('loginPassword').value;
        const btn = document.getElementById('loginBtn');

        btn.disabled = true;
        btn.innerHTML = '<span class="loading"></span> ' + this.t('login_loading');

        try {
            const result = await window.api.passwordManagerAuthenticate(password);

            if (result.success) {
                this.showSuccess(this.t('login_success'));
                this.closeAuthModal();

                setTimeout(() => {
                    if (window.pm && typeof window.pm.onAuthSuccess === 'function') {
                        window.pm.onAuthSuccess();
                    }
                }, 500);
            } else {
                this.showError(this.t('login_incorrect'));
                btn.disabled = false;
                btn.innerHTML = this.t('login_button');
            }
        } catch (error) {
            this.showError(this.t('login_error_prefix') + error.message);
            btn.disabled = false;
            btn.innerHTML = this.t('login_button');
        }
    }

    closeAuthModal() {
        if (this.authModal) {
            this.authModal.remove();
            this.authModal = null;
        }

        const existingModals = document.querySelectorAll('.auth-modal');
        existingModals.forEach(modal => modal.remove());
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        if (window.pm && typeof window.pm.showNotification === 'function') {
            window.pm.showNotification(message, type);
        } else {
            alert(message);
        }
    }

    showErrorModal(message) {
        this.closeAuthModal();

        const modal = document.createElement('div');
        modal.className = 'auth-modal active';
        modal.innerHTML = `
            <div class="auth-modal-overlay">
                <div class="auth-modal-content">
                    <div class="auth-modal-header">
                        <h2>❌ ${this.t('error_title')}</h2>
                    </div>
                    <div class="auth-modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="form-actions">
                        <button class="button" onclick="this.closest('.auth-modal').remove(); location.reload();">
                            ${this.t('error_close')}
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

// Προσθήκη των απαραίτητων CSS styles
const authStyles = `

`;

// Εισαγωγή των styles στο document
if (!document.querySelector('#auth-ui-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'auth-ui-styles';
    styleSheet.textContent = authStyles;
    document.head.appendChild(styleSheet);
}

// Δημιουργία global instance
window.pmAuthUI = new PasswordManagerAuthUI();