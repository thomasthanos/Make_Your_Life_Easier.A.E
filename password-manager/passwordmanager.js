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
        this.isCompactMode = false;
        this.isAuthenticated = false;
        
        // Initialize auth UI first
        this.authUI = new PasswordManagerAuthUI();
        
        setTimeout(() => {
            this.initializeEventListeners();
            this.initializeAuth();
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
        this.isAuthenticated = true;
        await this.loadData();
        this.showSuccess('Password Manager unlocked!');
    }

    initializeEventListeners() {
        // Password modal
        document.getElementById('addPasswordBtn').addEventListener('click', () => this.openPasswordModal());
        document.getElementById('closePasswordModal').addEventListener('click', () => this.closePasswordModal());
        document.getElementById('cancelPasswordBtn').addEventListener('click', () => this.closePasswordModal());
        document.getElementById('passwordForm').addEventListener('submit', (e) => this.savePassword(e));

        // Categories modal
        document.getElementById('manageCategoriesBtn').addEventListener('click', () => this.openCategoriesModal());
        document.getElementById('closeCategoriesModal').addEventListener('click', () => this.closeCategoriesModal());
        document.getElementById('closeCategoriesBtn').addEventListener('click', () => this.closeCategoriesModal());
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.addCategory());

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

        // Compact mode toggle
        this.createCompactToggle();

        // Close modals on backdrop click
        document.getElementById('passwordModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closePasswordModal();
        });
        document.getElementById('categoriesModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeCategoriesModal();
        });

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
        toggle.innerHTML = '📱 Compact Mode';
        toggle.addEventListener('click', () => this.toggleCompactMode());
        document.body.appendChild(toggle);
    }

    toggleCompactMode() {
        this.isCompactMode = !this.isCompactMode;
        console.log('Toggling compact mode to:', this.isCompactMode);
        console.log('Current passwords count:', this.passwords.length);
        
        const manager = document.querySelector('.password-manager');
        const toggle = document.querySelector('.compact-toggle');
        
        if (this.isCompactMode) {
            manager.classList.add('compact');
            toggle.innerHTML = '📱 Normal Mode';
            toggle.style.background = 'var(--accent-color)';
            toggle.style.color = 'white';
            toggle.style.borderColor = 'var(--accent-color)';
        } else {
            manager.classList.remove('compact');
            toggle.innerHTML = '📱 Compact Mode';
            toggle.style.background = 'var(--card-bg)';
            toggle.style.color = 'var(--sidebar-text)';
            toggle.style.borderColor = 'var(--border-color)';
        }
        
        // Re-render τα passwords
        this.renderPasswords();
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
            document.querySelectorAll('.password-card').forEach(card => {
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
        
        // Remove existing button if any
        const existingBtn = formGroup.querySelector('.generate-password-btn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        const generateBtn = document.createElement('button');
        generateBtn.type = 'button';
        generateBtn.className = 'button generate-password-btn';
        generateBtn.setAttribute('aria-label', 'Generate strong password');
        
        // ΠΡΟΣΘΕΣΕ ΜΟΝΟ ΤΟ ΖΑΡΙ ΣΤΟ INNERHTML
        generateBtn.innerHTML = '🎲'; // ΜΟΝΟ ΤΟ EMOJI
        
        generateBtn.addEventListener('click', () => {
            this.generateStrongPassword();
        });
        
        formGroup.appendChild(generateBtn);
    }

    async loadData() {
        if (!this.isAuthenticated) {
            console.log('Not authenticated, skipping data load');
            return;
        }

        console.log('Loading password manager data...');
        
        if (!window.api) {
            this.showError('Password manager APIs are not available.');
            return;
        }

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
        
        const passwordCounts = {};
        this.passwords.forEach(p => {
            passwordCounts[p.password] = (passwordCounts[p.password] || 0) + 1;
        });
        this.stats.reused = Object.values(passwordCounts).filter(count => count > 1).length;

        this.renderStats();
    }

    renderStats() {
        const container = document.getElementById('statsContainer');
        container.innerHTML = `
            <div class="stat-card">
                <span class="stat-number">${this.stats.total}</span>
                <span class="stat-label">Total Passwords</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${this.stats.categories}</span>
                <span class="stat-label">Categories</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${this.stats.weak}</span>
                <span class="stat-label">Weak Passwords</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${this.stats.reused}</span>
                <span class="stat-label">Reused</span>
            </div>
        `;
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
        this.showSuccess('Strong password generated!');
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
        allBtn.innerHTML = '<span>🌐 All</span>';
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
        select.innerHTML = '<option value="">No Category</option>';
        
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
        grid.innerHTML = `
            <div class="empty-state">
                <i>🔒</i>
                <h3>No Passwords Yet</h3>
                <p>Add your first password to secure your digital life</p>
                <button class="button" onclick="pm.openPasswordModal()" style="margin-top: 1rem;">
                    Add Your First Password
                </button>
            </div>
        `;
        return;
    }

    // ULTRA COMPACT MODE
    if (this.isCompactMode) {
        console.log('Rendering COMPACT mode cards');
        grid.innerHTML = this.passwords.map(password => {
            const strength = this.getPasswordStrength(password.password);
            const strengthIcons = {
                'weak': '🔴',
                'medium': '🟡', 
                'strong': '🟢',
                'very-strong': '🔵'
            };
            
            // Build login fields - ALWAYS show both if they exist
            let loginFields = [];
            
            // ALWAYS show username if exists
            if (password.username) {
                loginFields.push(`
                    <div class="compact-field">
                        <div class="compact-value">
                            <span class="compact-text" title="${this.escapeHtml(password.username)}">
                                👤 ${this.escapeHtml(password.username)}
                            </span>
                            <button class="compact-copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.username)}')" title="Copy username">📋</button>
                        </div>
                    </div>
                `);
            }
            
            // ALWAYS show email if exists  
            if (password.email) {
                loginFields.push(`
                    <div class="compact-field">
                        <div class="compact-value">
                            <span class="compact-text" title="${this.escapeHtml(password.email)}">
                                📧 ${this.escapeHtml(password.email)}
                            </span>
                            <button class="compact-copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.email)}')" title="Copy email">📋</button>
                        </div>
                    </div>
                `);
            }
            
            // If no username or email, show placeholder
            if (loginFields.length === 0) {
                loginFields.push(`
                    <div class="compact-field">
                        <div class="compact-value">
                            <span class="compact-text" style="opacity: 0.7;">
                                👤 No username/email
                            </span>
                        </div>
                    </div>
                `);
            }
            
            // Add URL field if exists
            let urlField = '';
            if (password.url) {
                let displayUrl = password.url;
                try {
                    const url = new URL(password.url);
                    displayUrl = url.hostname.replace('www.', '');
                } catch (e) {
                    // Keep original URL if parsing fails
                }
                urlField = `
                    <div class="compact-field">
                        <div class="compact-value">
                            <span class="compact-text" title="${this.escapeHtml(password.url)}">
                                🌐 ${this.escapeHtml(displayUrl)}
                            </span>
                            <button class="compact-action-btn" onclick="pm.openExternal('${this.escapeHtml(password.url)}')" title="Open website">🔗</button>
                        </div>
                    </div>
                `;
            }
            
            // Add notes field if exists (truncated)
            let notesField = '';
            if (password.notes) {
                const truncatedNotes = password.notes.length > 50 ? 
                    password.notes.substring(0, 50) + '...' : password.notes;
                notesField = `
                    <div class="compact-field">
                        <div class="compact-value">
                            <span class="compact-text" title="${this.escapeHtml(password.notes)}">
                                📝 ${this.escapeHtml(truncatedNotes)}
                            </span>
                        </div>
                    </div>
                `;
            }
            
            return `
            <div class="compact-password-card">
                <div class="compact-header">
                    <h3 class="compact-title" title="${this.escapeHtml(password.title)}">
                        ${this.escapeHtml(password.title)}
                    </h3>
                    <div class="compact-actions">
                        <button class="compact-action-btn" onclick="pm.editPassword(${password.id})" title="Edit">✏️</button>
                        <button class="compact-action-btn" onclick="pm.deletePassword(${password.id})" title="Delete">🗑️</button>
                    </div>
                </div>
                
                ${loginFields.join('')}
                
                <!-- Password Field -->
                <div class="compact-field">
                    <div class="compact-value">
                        <span class="strength-dot strength-${strength}" aria-hidden="true"></span>
                        <span class="compact-text compact-password-hidden">••••••••</span>
                        <button class="compact-reveal-btn" onclick="pm.togglePassword(this, ${password.id})" title="Reveal password">👁️</button>
                        <button class="compact-copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.password)}')" title="Copy password">📋</button>
                    </div>
                </div>
                
                ${urlField}
                ${notesField}
                
                <!-- Last Updated -->
                <div class="compact-field" style="font-size: 0.8em; opacity: 0.7;">
                    <div class="compact-value">
                        <span class="compact-text">
                            📅 ${password.updated_at ? new Date(password.updated_at).toLocaleDateString() : 'Unknown'}
                        </span>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    } else {
        // NORMAL MODE - Original detailed view
        // ... keep the existing normal mode code unchanged
        grid.innerHTML = this.passwords.map(password => {
            const strength = this.getPasswordStrength(password.password);
            const strengthIcons = {
                'weak': '🔴',
                'medium': '🟡', 
                'strong': '🟢',
                'very-strong': '🔵'
            };
            
            let displayUrl = '—';
            try {
                if (password.url) {
                    const url = new URL(password.url);
                    displayUrl = url.hostname.replace('www.', '');
                }
            } catch (e) {
                displayUrl = password.url;
            }
            
            return `
            <div class="password-card">
                <div class="password-header">
                    <h3 class="password-title">${this.escapeHtml(password.title)}</h3>
                    <div class="password-actions">
                        <button class="action-btn" onclick="pm.editPassword(${password.id})" title="Edit">✏️</button>
                        <button class="action-btn" onclick="pm.deletePassword(${password.id})" title="Delete">🗑️</button>
                    </div>
                </div>
                
                ${password.category_name ? `
                <div class="password-category">${this.escapeHtml(password.category_name)}</div>` : ''}
                
                <div class="password-field">
                    <span class="password-label">Username</span>
                    <div class="password-value">
                        <span class="password-text">${password.username ? this.escapeHtml(password.username) : '—'}</span>
                        ${password.username ? `<button class="copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.username)}')" title="Copy username">📋</button>` : ''}
                    </div>
                </div>
                
                <div class="password-field">
                    <span class="password-label">Email</span>
                    <div class="password-value">
                        <span class="password-text">${password.email ? this.escapeHtml(password.email) : '—'}</span>
                        ${password.email ? `<button class="copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.email)}')" title="Copy email">📋</button>` : ''}
                    </div>
                </div>
                
                <div class="password-field">
                    <span class="password-label">Password ${strengthIcons[strength]}</span>
                    <div class="password-value">
                        <span class="password-text password-hidden">••••••••</span>
                        <button class="reveal-btn" onclick="pm.togglePassword(this, ${password.id})" title="Reveal password">👁️</button>
                        <button class="copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.password)}')" title="Copy password">📋</button>
                    </div>
                </div>
                
                ${password.url ? `
                <div class="password-field">
                    <span class="password-label">Website</span>
                    <div class="password-value">
                        <button class="website-link-btn" onclick="pm.openExternal('${this.escapeHtml(password.url)}')" title="Open in default browser">
                            🌐 ${this.escapeHtml(displayUrl)}
                        </button>
                    </div>
                </div>` : ''}
                
                ${password.notes ? `
                <div class="password-field">
                    <span class="password-label">Notes</span>
                    <div class="password-value">
                        <span class="password-text">${this.escapeHtml(password.notes)}</span>
                    </div>
                </div>` : ''}
                
                <div class="password-field">
                    <span class="password-label">Last Updated</span>
                    <div class="password-value">
                        <span class="password-text">${password.updated_at ? new Date(password.updated_at).toLocaleDateString() : '—'}</span>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

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
            title.textContent = 'Edit Password';
            this.fillPasswordForm(passwordId);
        } else {
            title.textContent = 'Add New Password';
            form.reset();
            document.getElementById('passwordId').value = '';
            document.getElementById('passwordStrength').className = 'strength-bar';
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
        notes: document.getElementById('notes').value.trim() || null
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
            this.closePasswordModal();
            await this.loadPasswords(this.currentCategory);
            this.showSuccess(`Password ${this.currentEditingId ? 'updated' : 'saved'} successfully!`);
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

    async deletePassword(passwordId) {
        if (!confirm('Are you sure you want to delete this password? This action cannot be undone.')) return;

        try {
            const result = await window.api.passwordManagerDeletePassword(passwordId);
            if (result.success) {
                await this.loadPasswords(this.currentCategory);
                this.showSuccess('Password deleted successfully!');
            } else {
                this.showError('Failed to delete password: ' + result.error);
            }
        } catch (error) {
            this.showError('Error deleting password: ' + error.message);
        }
    }

    async searchPasswords(query) {
        if (!query.trim()) {
            this.loadPasswords(this.currentCategory);
            return;
        }

        try {
            const result = await window.api.passwordManagerSearchPasswords(query);
            if (result.success) {
                this.passwords = result.passwords;
                this.renderPasswords();
            } else {
                this.showError('Search failed: ' + result.error);
            }
        } catch (error) {
            this.showError('Error searching: ' + error.message);
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
                    <p>No categories found</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">Create your first category to organize passwords</p>
                </div>
            `;
            return;
        }

        this.categories.forEach(category => {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
                <input type="text" value="${this.escapeHtml(category.name)}" class="form-input category-name" data-id="${category.id}" style="flex: 1;">
                <button class="button button-secondary" onclick="pm.updateCategory(${category.id})">Update</button>
                <button class="button button-danger" onclick="pm.deleteCategory(${category.id})">Delete</button>
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

togglePassword(button, passwordId) {
    const password = this.passwords.find(p => p.id === passwordId);
    if (!password) return;

    // Βρείτε το σωστό text element - διαφορετικά για compact vs normal mode
    let textElement;
    
    if (this.isCompactMode) {
        // Στο compact mode, το text element είναι το πρώτο span μέσα στο compact-value
        const compactValue = button.closest('.compact-value');
        textElement = compactValue.querySelector('.compact-text');
    } else {
        // Στο normal mode, το text element είναι το προηγούμενο sibling
        textElement = button.previousElementSibling;
    }

    if (!textElement) {
        console.error('Could not find text element for password toggle');
        return;
    }
    
    if (textElement.classList.contains('password-hidden') || textElement.classList.contains('compact-password-hidden')) {
        // Show password
        textElement.textContent = password.password;
        textElement.classList.remove('password-hidden', 'compact-password-hidden');
        button.innerHTML = '🙈';
        button.title = 'Hide password';
        
        // Auto-hide after 30 seconds
        setTimeout(() => {
            if (!textElement.classList.contains('password-hidden') && !textElement.classList.contains('compact-password-hidden')) {
                textElement.textContent = '••••••••';
                textElement.classList.add(this.isCompactMode ? 'compact-password-hidden' : 'password-hidden');
                button.innerHTML = '👁️';
                button.title = 'Reveal password';
            }
        }, 30000);
    } else {
        // Hide password
        textElement.textContent = '••••••••';
        textElement.classList.add(this.isCompactMode ? 'compact-password-hidden' : 'password-hidden');
        button.innerHTML = '👁️';
        button.title = 'Reveal password';
    }
}

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess('Copied to clipboard!');
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showSuccess('Copied to clipboard!');
            } catch (fallbackError) {
                this.showError('Failed to copy to clipboard. Please copy manually.');
            }
            document.body.removeChild(textArea);
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
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