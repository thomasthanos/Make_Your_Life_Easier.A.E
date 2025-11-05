// auth-ui.js - Ολοκληρωμένο με custom forgot password και show/hide password
class PasswordManagerAuthUI {
    constructor() {
        this.isInitialized = false;
        this.hasMasterPassword = false;
        this.authModal = null;

        /**
         * Determine the language.  Check the saved settings in
         * localStorage (`myAppSettings.lang`) and fall back to the
         * `<html lang>` attribute.  Any value starting with "gr" or
         * "el" is considered Greek; all other values default to
         * English.
         */
        let lang = 'en';
        try {
            const settings = JSON.parse(localStorage.getItem('myAppSettings'));
            if (settings && typeof settings.lang === 'string' && settings.lang.length > 0) {
                lang = settings.lang.toLowerCase();
            }
        } catch (e) {
            // ignore parsing errors
        }
        if (!lang || lang === 'en') {
            const docLang = (document.documentElement.lang || '').toLowerCase();
            if (docLang) {
                lang = docLang;
            }
        }
        this.lang = (lang.startsWith('gr') || lang.startsWith('el')) ? 'gr' : 'en';

        // Translation table
        this.translations = {
            en: {
                setup_title: 'Create!',
                login_title: 'Login!',
                create_master_placeholder: 'Master Password (min 8 chars)',
                confirm_placeholder: 'Confirm',
                create_button: 'Create',
                login_placeholder: 'Master Password',
                login_button: 'START',
                forgot_link: 'Forgot your password?',
                forgot_title: 'Forgot your password?',
                irreversible_action: 'This action is irreversible!',
                forgot_warning_1: 'If you forgot your Master Password, the only solution is to completely reset the Password Manager.',
                forgot_warning_delete: 'This will delete:',
                forgot_list_passwords: 'All stored passwords',
                forgot_list_categories: 'All categories',
                forgot_list_settings: 'All settings',
                forgot_warning_2: 'You will have to recreate everything from scratch.',
                reset_button: 'Reset Password',
                cancel_button: 'Cancel',
                warning_prefix: '⚠️',
                warning_attention: 'Attention:',
                warning_reset_note: 'If you forget your Master Password, your data will be unrecoverable.',
                error_title: 'Error',
                error_close: 'Close'
            },
            gr: {
                setup_title: 'Δημιουργία!',
                login_title: 'Σύνδεση!',
                create_master_placeholder: 'Master Password (τουλάχιστον 8 χαρακτήρες)',
                confirm_placeholder: 'Επιβεβαίωση',
                create_button: 'Δημιουργία',
                login_placeholder: 'Master Password',
                login_button: 'ΕΚΚΙΝΗΣΗ',
                forgot_link: 'Ξεχάσατε τον κωδικό σας;',
                forgot_title: 'Ξεχάσατε τον κωδικό;',
                irreversible_action: 'Αυτή η ενέργεια είναι μη αναστρέψιμη!',
                forgot_warning_1: 'Αν ξεχάσατε τον Master Password σας, η μόνη λύση είναι η πλήρης επαναφορά του Password Manager.',
                forgot_warning_delete: 'Αυτό θα διαγράψει:',
                forgot_list_passwords: 'Όλα τα αποθηκευμένα passwords',
                forgot_list_categories: 'Όλες τις κατηγορίες',
                forgot_list_settings: 'Όλες τις ρυθμίσεις',
                forgot_warning_2: 'Θα πρέπει να ξαναδημιουργήσετε όλα από την αρχή.',
                reset_button: 'Επαναφορά Password Manager',
                cancel_button: 'Ακύρωση',
                warning_prefix: '⚠️',
                warning_attention: 'Προσοχή:',
                warning_reset_note: 'Αν ξεχάσετε τον Master Password, τα δεδομένα σας θα είναι μη ανακτήσιμα.',
                error_title: 'Σφάλμα',
                error_close: 'Κλείσιμο'
            }
        };
    }

    // Translation helper
    t(key) {
        if (this.translations[this.lang] && this.translations[this.lang][key]) {
            return this.translations[this.lang][key];
        }
        return (this.translations['en'] && this.translations['en'][key]) || key;
    }

    // Translation helper
    t(key) {
        if (this.translations[this.lang] && this.translations[this.lang][key]) {
            return this.translations[this.lang][key];
        }
        return (this.translations['en'] && this.translations['en'][key]) || key;
    }

    async initialize() {
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
            console.error('Auth initialization error:', error);
            this.showErrorModal('Σφάλμα αρχικοποίησης: ' + error.message);
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
                    <div class="field">
                        <svg class="input-icon" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
                            <path d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"></path>
                        </svg>
                        <input type="password" id="masterPassword" class="input-field password-input" 
                               placeholder="${this.t('create_master_placeholder')}" required
                               minlength="8" autocomplete="new-password">
                        <button type="button" class="password-toggle" onclick="pmAuthUI.togglePasswordVisibility('masterPassword')">👁️</button>
                    </div>
                    <div id="passwordStrength" class="password-strength-container"></div>
                    
                    <div class="field">
                        <svg class="input-icon" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
                            <path d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"></path>
                        </svg>
                        <input type="password" id="confirmPassword" class="input-field password-input" 
                               placeholder="${this.t('confirm_placeholder')}" required
                               autocomplete="new-password">
                        <button type="button" class="password-toggle" onclick="pmAuthUI.togglePasswordVisibility('confirmPassword')">👁️</button>
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
                        <svg class="input-icon" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
                            <path d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"></path>
                        </svg>
                        <input autocomplete="off" id="loginPassword" placeholder="${this.t('login_placeholder')}" class="input-field password-input" name="logpass" type="password" required autofocus>
                        <button type="button" class="password-toggle" onclick="pmAuthUI.togglePasswordVisibility('loginPassword')">👁️</button>
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
        const input = document.getElementById(inputId);
        const toggleButton = input.nextElementSibling;

        if (input.type === 'password') {
            input.type = 'text';
            toggleButton.textContent = '🙈';
            toggleButton.title = 'Απόκρυψη κωδικού';
        } else {
            input.type = 'password';
            toggleButton.textContent = '👁️';
            toggleButton.title = 'Εμφάνιση κωδικού';
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
                this.showSuccess('Ο Password Manager επαναφέρθηκε επιτυχώς! Μπορείτε τώρα να δημιουργήσετε νέο Master Password.');
                this.closeAuthModal();
                this.showSetupModal();
            } else {
                this.showError('Σφάλμα επαναφοράς: ' + result.error);
            }
        } catch (error) {
            this.showError('Σφάλμα: ' + error.message);
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
                                <p class="error-prompt-heading">Ο κωδικός σας δεν είναι αρκετά ισχυρός</p>
                                <div class="error-prompt-wrap">
                                    <ul class="error-prompt-list" role="list">
                                        <li>Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες</li>
                                        <li>Πρέπει να περιλαμβάνει κεφαλαία, πεζά, αριθμούς και ειδικούς χαρακτήρες</li>
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
            console.error('Error validating password:', error);
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
            container.innerHTML = '<div class="match-success">✓ Οι κωδικοί ταιριάζουν</div>';
        } else {
            container.innerHTML = '<div class="match-error">✗ Οι κωδικοί δεν ταιριάζουν</div>';
        }
    }

    async handleSetup(e) {
        e.preventDefault();

        const masterPassword = document.getElementById('masterPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const btn = document.getElementById('setupBtn');

        if (masterPassword !== confirmPassword) {
            this.showError('Οι κωδικοί δεν ταιριάζουν');
            return;
        }

        const strengthResult = await window.api.passwordManagerValidatePassword(masterPassword);
        if (!strengthResult.isValid) {
            this.showError('Ο κωδικός είναι πολύ αδύναμος. Βελτιώστε τον σύμφωνα με τις οδηγίες.');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="loading"></span> Δημιουργία...';

        try {
            const result = await window.api.passwordManagerCreateMasterPassword(masterPassword);

            if (result.success) {
                this.showSuccess('Master Password δημιουργήθηκε επιτυχώς!');
                this.closeAuthModal();

                setTimeout(() => {
                    if (window.pm && typeof window.pm.onAuthSuccess === 'function') {
                        window.pm.onAuthSuccess();
                    }
                }, 1000);
            } else {
                this.showError('Σφάλμα δημιουργίας: ' + result.error);
                btn.disabled = false;
                btn.innerHTML = 'Δημιουργία';
            }
        } catch (error) {
            this.showError('Σφάλμα: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = 'Δημιουργία';
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        const password = document.getElementById('loginPassword').value;
        const btn = document.getElementById('loginBtn');

        btn.disabled = true;
        btn.innerHTML = '<span class="loading"></span> Σύνδεση...';

        try {
            const result = await window.api.passwordManagerAuthenticate(password);

            if (result.success) {
                this.showSuccess('Επιτυχής σύνδεση!');
                this.closeAuthModal();

                setTimeout(() => {
                    if (window.pm && typeof window.pm.onAuthSuccess === 'function') {
                        window.pm.onAuthSuccess();
                    }
                }, 500);
            } else {
                this.showError('Λανθασμένος Master Password');
                btn.disabled = false;
                btn.innerHTML = 'ΕΚΚΙΝΗΣΗ';
            }
        } catch (error) {
            this.showError('Σφάλμα σύνδεσης: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = 'ΕΚΚΙΝΗΣΗ';
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