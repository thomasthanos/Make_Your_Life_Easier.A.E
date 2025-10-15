// auth-ui.js - Ολοκληρωμένο με custom forgot password και show/hide password
class PasswordManagerAuthUI {
    constructor() {
        this.isInitialized = false;
        this.hasMasterPassword = false;
        this.authModal = null;
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
                        ⚠️ <strong>Προσοχή:</strong> Αν ξεχάσετε τον Master Password, τα δεδομένα σας θα είναι μη ανακτήσιμα.
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
                        ⚠️ <strong>Προσοχή:</strong> Αν ξεχάσετε τον Master Password, τα δεδομένα σας θα είναι μη ανακτήσιμα.
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
                <h4 class="title">Δημιουργία!</h4>
                <form id="setupForm" class="auth-form">
                    <div class="field">
                        <svg class="input-icon" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
                            <path d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"></path>
                        </svg>
                        <input type="password" id="masterPassword" class="input-field password-input" 
                               placeholder="Master Password (min 8 chars)" required
                               minlength="8" autocomplete="new-password">
                        <button type="button" class="password-toggle" onclick="pmAuthUI.togglePasswordVisibility('masterPassword')">👁️</button>
                    </div>
                    <div id="passwordStrength" class="password-strength-container"></div>
                    
                    <div class="field">
                        <svg class="input-icon" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
                            <path d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"></path>
                        </svg>
                        <input type="password" id="confirmPassword" class="input-field password-input" 
                               placeholder="Επιβεβαίωση" required
                               autocomplete="new-password">
                        <button type="button" class="password-toggle" onclick="pmAuthUI.togglePasswordVisibility('confirmPassword')">👁️</button>
                    </div>
                    <div id="passwordMatch" class="password-match"></div>
                    
                    <button class="btn" type="submit" id="setupBtn">Δημιουργία</button>
                </form>
            </div>
        `;
    }

    createLoginForm() {
        return `
            <div class="card">
                <h4 class="title">Σύνδεση!</h4>
                <form id="loginForm" class="auth-form">
                    <div class="field">
                        <svg class="input-icon" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
                            <path d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"></path>
                        </svg>
                        <input autocomplete="off" id="loginPassword" placeholder="Master Password" class="input-field password-input" name="logpass" type="password" required autofocus>
                        <button type="button" class="password-toggle" onclick="pmAuthUI.togglePasswordVisibility('loginPassword')">👁️</button>
                    </div>
                    <button class="btn" type="submit" id="loginBtn">ΕΚΚΙΝΗΣΗ</button>
                    <a href="#" class="btn-link" id="forgotPasswordLink">Ξεχάσατε τον κωδικό σας;</a>
                </form>
            </div>
        `;
    }

    createForgotPasswordModal() {
        return `
            <div class="card">
                <h4 class="title">Ξεχάσατε τον κωδικό;</h4>
                <div class="forgot-password-content">
                    <div class="warning-icon">⚠️</div>
                    <p class="forgot-warning-text">
                        <strong>Αυτή η ενέργεια είναι μη αναστρέψιμη!</strong><br><br>
                        Αν ξεχάσατε τον Master Password σας, η μόνη λύση είναι η πλήρης επαναφορά του Password Manager.
                        Αυτό θα διαγράψει:
                    </p>
                    <ul class="forgot-list">
                        <li>Όλα τα αποθηκευμένα passwords</li>
                        <li>Όλες τις κατηγορίες</li>
                        <li>Όλες τις ρυθμίσεις</li>
                    </ul>
                    <p class="forgot-warning-text">
                        Θα πρέπει να ξαναδημιουργήσετε όλα από την αρχή.
                    </p>
                    <div class="forgot-actions">
                        <button class="btn btn-danger" id="confirmResetBtn">Επαναφορά Password Manager</button>
                        <button class="btn btn-secondary" id="cancelResetBtn">Ακύρωση</button>
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
        modal.className = 'auth-modal active';
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
                        <h2>❌ Σφάλμα</h2>
                    </div>
                    <div class="auth-modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="form-actions">
                        <button class="button" onclick="this.closest('.auth-modal').remove(); location.reload();">
                            Κλείσιμο
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
.auth-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(15, 17, 23, 0.95);
    backdrop-filter: blur(10px);
    z-index: 10000;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

.auth-modal.active {
    display: flex;
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.auth-modal-overlay {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 3rem;
    max-width: 450px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    position: relative;
}

.auth-modal-warning {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid var(--warning-color);
    border-radius: 8px;
    padding: 1.25rem;
    margin-top: 2rem;
    text-align: left;
    font-size: 0.9rem;
    color: var(--sidebar-text);
}

.auth-modal-warning strong {
    color: var(--warning-color);
}

/* Card Styles */
.card {
    width: 100%;
    padding: 1.9rem 1.2rem;
    text-align: center;
    background: #2a2b38;
    border-radius: 8px;
}

.field {
    margin-top: .5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .5em;
    background-color: #1f2029;
    border-radius: 4px;
    padding: .5em 1em;
    position: relative;
}

.input-icon {
    height: 1em;
    width: 1em;
    fill: #ffeba7;
}

.input-field {
    background: none;
    border: none;
    outline: none;
    width: 100%;
    color: #d3d3d3;
    font-size: 0.9rem;
    padding-right: 2.5rem;
}

.password-toggle {
    background: none;
    border: none;
    color: #ffeba7;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    transition: all 0.2s ease;
}

.password-toggle:hover {
    background: rgba(255, 235, 167, 0.1);
    transform: translateY(-50%) scale(1.1);
}

.title {
    margin-bottom: 1rem;
    font-size: 1.5em;
    font-weight: 500;
    color: #f5f5f5;
}

.btn {
    margin: 1rem;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    font-size: .8em;
    text-transform: uppercase;
    padding: 0.6em 1.2em;
    background-color: #ffeba7;
    color: #5e6681;
    box-shadow: 0 8px 24px 0 rgb(255 235 167 / 20%);
    transition: all .3s ease-in-out;
    cursor: pointer;
    width: calc(100% - 2rem);
}

.btn-danger {
    background-color: #ef4444;
    color: white;
}

.btn-danger:hover {
    background-color: #dc2626;
}

.btn-secondary {
    background-color: #6b7280;
    color: white;
}

.btn-secondary:hover {
    background-color: #4b5563;
}

.btn-link {
    color: #f5f5f5;
    display: block;
    font-size: .75em;
    transition: color .3s ease-out;
    text-decoration: none;
    margin-top: 0.5rem;
}

.field input:focus::placeholder {
    opacity: 0;
    transition: opacity .3s;
}

.btn:hover {
    background-color: #5e6681;
    color: #ffeba7;
    box-shadow: 0 8px 24px 0 rgb(16 39 112 / 20%);
    transform: translateY(-1px);
}

.btn-link:hover {
    color: #ffeba7;
    text-decoration: underline;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
}

/* Password Strength */
.password-strength-container {
    margin: 1rem 0;
}

.password-match {
    margin: 0.5rem 0;
    font-size: 0.8rem;
}

.match-success {
    color: #10b981;
}

.match-error {
    color: #ef4444;
}

.error-alert {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 8px;
    padding: 1rem;
    text-align: left;
    margin: 1rem 0;
}

.error-svg {
    width: 1.25rem;
    height: 1.25rem;
    color: #ef4444;
}

.error-prompt-heading {
    font-weight: 600;
    color: #ef4444;
    margin-bottom: 0.5rem;
}

.error-prompt-list {
    list-style-type: disc;
    margin-left: 1rem;
    color: #d1d5db;
    font-size: 0.8rem;
}

.flex {
    display: flex;
    gap: 0.75rem;
}

.flex-shrink-0 {
    flex-shrink: 0;
}

.loading {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,.3);
    border-radius: 50%;
    border-top-color: #fff;
    animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Forgot Password Styles */
.forgot-password-content {
    text-align: left;
}

.warning-icon {
    font-size: 3rem;
    text-align: center;
    margin-bottom: 1rem;
}

.forgot-warning-text {
    color: #d1d5db;
    margin-bottom: 1rem;
    line-height: 1.5;
}

.forgot-warning-text strong {
    color: #ef4444;
}

.forgot-list {
    color: #d1d5db;
    margin: 1rem 0;
    padding-left: 1.5rem;
}

.forgot-list li {
    margin-bottom: 0.5rem;
}

.forgot-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1.5rem;
}

@media (max-width: 480px) {
    .auth-modal {
        padding: 1rem;
    }
    
    .auth-modal-overlay {
        padding: 2rem 1.5rem;
    }
    
    .card {
        padding: 1.5rem 1rem;
    }
    
    .forgot-actions {
        flex-direction: column;
    }
}
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