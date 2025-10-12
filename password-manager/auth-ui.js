class PasswordManagerAuthUI {
    constructor() {
        this.isInitialized = false;
        this.hasMasterPassword = false;
        this.authModal = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Έλεγχος αν υπάρχει Master Password
            const result = await window.api.passwordManagerHasMasterPassword();
            this.hasMasterPassword = result;
            
            this.isInitialized = true;
            
            // Εμφάνιση κατάλληλου modal
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
        // Καθαρισμός υπαρχόντων modals
        this.closeAuthModal();
        
        this.authModal = this.createAuthModal(
            'Δημιουργία Master Password',
            this.createSetupForm()
        );
        document.body.appendChild(this.authModal);
        
        // Προσθήκη event listeners
        setTimeout(() => this.attachEventListeners(), 100);
    }

    showLoginModal() {
        // Καθαρισμός υπαρχόντων modals
        this.closeAuthModal();
        
        this.authModal = this.createAuthModal(
            'Σύνδεση στο Password Manager',
            this.createLoginForm()
        );
        document.body.appendChild(this.authModal);
        
        // Προσθήκη event listeners
        setTimeout(() => this.attachEventListeners(), 100);
    }

    createAuthModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'auth-modal active';
        modal.innerHTML = `
            <div class="auth-modal-overlay">
                <div class="auth-modal-content">
                    <div class="auth-modal-header">
                        <h2>🔒 ${title}</h2>
                    </div>
                    <div class="auth-modal-body">
                        ${content}
                    </div>
                    <div class="auth-modal-warning">
                        ⚠️ <strong>Προσοχή:</strong> Αν ξεχάσετε τον Master Password, τα δεδομένα σας θα είναι μη ανακτήσιμα.
                    </div>
                </div>
            </div>
        `;
        return modal;
    }

    createSetupForm() {
        return `
            <form id="setupForm" class="auth-form">
                <div class="form-group">
                    <label class="form-label">Δημιουργία Master Password *</label>
                    <input type="password" id="masterPassword" class="form-input" 
                           placeholder="Εισάγετε τουλάχιστον 8 χαρακτήρες" required
                           minlength="8" autocomplete="new-password">
                    <div id="passwordStrength" class="password-strength-container"></div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Επιβεβαίωση Master Password *</label>
                    <input type="password" id="confirmPassword" class="form-input" 
                           placeholder="Εισάγετε ξανά τον κωδικό" required
                           autocomplete="new-password">
                    <div id="passwordMatch" class="password-match"></div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="button" id="setupBtn">
                        <span>🔐 Δημιουργία Master Password</span>
                    </button>
                </div>
            </form>
        `;
    }

    createLoginForm() {
        return `
            <form id="loginForm" class="auth-form">
                <div class="form-group">
                    <label class="form-label">Master Password *</label>
                    <input type="password" id="loginPassword" class="form-input" 
                           placeholder="Εισάγετε τον Master Password" required
                           autofocus autocomplete="current-password">
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="button" id="loginBtn">
                        <span>🔓 Ξεκλείδωμα Password Manager</span>
                    </button>
                </div>
            </form>
        `;
    }

    attachEventListeners() {
        // Setup form events
        const setupForm = document.getElementById('setupForm');
        if (setupForm) {
            const masterPassword = document.getElementById('masterPassword');
            const confirmPassword = document.getElementById('confirmPassword');
            
            masterPassword.addEventListener('input', (e) => {
                this.checkPasswordStrength(e.target.value);
                this.checkPasswordMatch();
            });
            
            confirmPassword.addEventListener('input', this.checkPasswordMatch.bind(this));
            
            setupForm.addEventListener('submit', (e) => this.handleSetup(e));
        }

        // Login form events
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
    }

    async checkPasswordStrength(password) {
        const container = document.getElementById('passwordStrength');
        if (!container) return;

        try {
            const result = await window.api.passwordManagerValidatePassword(password);
            
            let strengthText = '';
            let strengthClass = '';
            
            if (password.length === 0) {
                strengthText = '';
            } else if (result.strength <= 2) {
                strengthText = 'Αδύναμος';
                strengthClass = 'weak';
            } else if (result.strength === 3) {
                strengthText = 'Μέτριος';
                strengthClass = 'medium';
            } else if (result.strength === 4) {
                strengthText = 'Ισχυρός';
                strengthClass = 'strong';
            } else {
                strengthText = 'Πολύ Ισχυρός';
                strengthClass = 'very-strong';
            }

            container.innerHTML = `
                <div class="password-strength-bar ${strengthClass}">
                    <div class="strength-text">${strengthText}</div>
                </div>
                <div class="password-requirements">
                    ${this.getRequirementsHtml(result.requirements)}
                </div>
            `;
        } catch (error) {
            console.error('Error checking password strength:', error);
        }
    }

    getRequirementsHtml(requirements) {
        const requirementLabels = {
            minLength: '8+ χαρακτήρες',
            hasUpperCase: 'Κεφαλαίο γράμμα',
            hasLowerCase: 'Μικρό γράμμα', 
            hasNumbers: 'Αριθμός',
            hasSpecial: 'Ειδικός χαρακτήρας'
        };

        return Object.entries(requirements)
            .map(([key, met]) => `
                <div class="requirement ${met ? 'met' : 'unmet'}">
                    ${met ? '✓' : '✗'} ${requirementLabels[key]}
                </div>
            `).join('');
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
        
        // Έλεγχος αν ταιριάζουν οι κωδικοί
        if (masterPassword !== confirmPassword) {
            this.showError('Οι κωδικοί δεν ταιριάζουν');
            return;
        }

        // Έλεγχος ισχύος κωδικού
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
                
                // Επανεκκίνηση του Password Manager
                setTimeout(() => {
                    if (window.pm) {
                        window.pm.onAuthSuccess();
                    }
                }, 1000);
            } else {
                this.showError('Σφάλμα δημιουργίας: ' + result.error);
                btn.disabled = false;
                btn.innerHTML = '<span>🔐 Δημιουργία Master Password</span>';
            }
        } catch (error) {
            this.showError('Σφάλμα: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = '<span>🔐 Δημιουργία Master Password</span>';
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
                
                // Επανεκκίνηση του Password Manager
                setTimeout(() => {
                    if (window.pm) {
                        window.pm.onAuthSuccess();
                    }
                }, 500);
            } else {
                this.showError('Λανθασμένος Master Password');
                btn.disabled = false;
                btn.innerHTML = '<span>🔓 Ξεκλείδωμα Password Manager</span>';
            }
        } catch (error) {
            this.showError('Σφάλμα σύνδεσης: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = '<span>🔓 Ξεκλείδωμα Password Manager</span>';
        }
    }

    closeAuthModal() {
        if (this.authModal) {
            this.authModal.remove();
            this.authModal = null;
        }
        
        // Καθαρισμός όλων των auth modals (για περίπτωση duplicates)
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
        // Χρησιμοποιούμε την υπάρχουσα λειτουργικότητα ειδοποιήσεων
        if (window.pm && typeof window.pm.showNotification === 'function') {
            window.pm.showNotification(message, type);
        } else {
            // Fallback απλής alert
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