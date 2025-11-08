class PasswordManager {
    constructor() {
        this.categories = [];
        this.passwords = [];
        this.currentCategory = 'all';
        this.currentEditingId = null;

        // Determine language for UI.  Try to read myAppSettings.lang from localStorage,
        // fall back to the <html> lang attribute.  Treat 'gr' and 'el' as Greek.
        let langSetting = null;
        try {
            const settings = JSON.parse(localStorage.getItem('myAppSettings'));
            if (settings && typeof settings.lang === 'string' && settings.lang.length > 0) {
                langSetting = settings.lang.toLowerCase();
            }
        } catch (e) {
            // ignore errors
        }
        const docLang = (document.documentElement.lang || 'en').toLowerCase();
        const selectedLang = langSetting || docLang;
        this.lang = (selectedLang.startsWith('gr') || selectedLang.startsWith('el')) ? 'gr' : 'en';

        // Basic translations for the simpler password manager interface
        this.translations = {
            en: {
                all: 'All',
                no_passwords_found_title: 'No passwords found',
                no_passwords_found_sub: 'Add your first password to get started',
                add_password_modal_title: 'Add Password',
                edit_password_modal_title: 'Edit Password',
                update: 'Update',
                delete: 'Delete',
                username_label: 'Username:',
                email_label: 'Email:',
                password_label: 'Password:',
                url_label: 'URL:',
                notes_label: 'Notes:',
                add_category_placeholder: 'New category name',
                add_category_button: 'Add',
                close_category_button: 'Close',
                copy_username: 'Copy username',
                copy_email: 'Copy email',
                copy_password: 'Copy password',
                reveal_password: 'Reveal password',
                hide_password: 'Hide password',
                update_category: 'Update',
                delete_category: 'Delete',
                no_categories: 'No categories found'
            },
            gr: {
                all: 'Όλα',
                no_passwords_found_title: 'Δεν βρέθηκαν κωδικοί',
                no_passwords_found_sub: 'Προσθέστε τον πρώτο σας κωδικό για να ξεκινήσετε',
                add_password_modal_title: 'Προσθήκη Κωδικού',
                edit_password_modal_title: 'Επεξεργασία Κωδικού',
                update: 'Ενημέρωση',
                delete: 'Διαγραφή',
                username_label: 'Χρήστης:',
                email_label: 'Email:',
                password_label: 'Κωδικός:',
                url_label: 'URL:',
                notes_label: 'Σημειώσεις:',
                add_category_placeholder: 'Όνομα νέας κατηγορίας',
                add_category_button: 'Προσθήκη',
                close_category_button: 'Κλείσιμο',
                copy_username: 'Αντιγραφή ονόματος χρήστη',
                copy_email: 'Αντιγραφή email',
                copy_password: 'Αντιγραφή κωδικού',
                reveal_password: 'Προβολή κωδικού',
                hide_password: 'Απόκρυψη κωδικού',
                update_category: 'Ενημέρωση',
                delete_category: 'Διαγραφή',
                no_categories: 'Δεν βρέθηκαν κατηγορίες'
            }
        };
        
        // Wait a bit for APIs to be available
        setTimeout(() => {
            this.initializeEventListeners();
            this.loadData();
        }, 1000);
    }

    /**
     * Translate a key using the current language.  Falls back to English or
     * returns the key itself if no translation exists.  This helper makes it
     * easy to internationalize the simpler password manager UI.
     * @param {string} key
     * @returns {string}
     */
    t(key) {
        if (this.translations && this.translations[this.lang] && this.translations[this.lang][key]) {
            return this.translations[this.lang][key];
        }
        if (this.translations && this.translations.en && this.translations.en[key]) {
            return this.translations.en[key];
        }
        return key;
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

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchPasswords(e.target.value));

        // Close modals on backdrop click
        document.getElementById('passwordModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closePasswordModal();
        });
        document.getElementById('categoriesModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeCategoriesModal();
        });
    }

    async loadData() {
        // Debug: Check if APIs are available
        console.log('Checking password manager APIs...');
        console.log('window.api:', window.api);
        
        if (!window.api) {
            this.showError('Password manager APIs are not available. The application may not be running in Electron.');
            return;
        }

        // Check if password manager APIs specifically exist
        const requiredApis = [
            'passwordManagerGetCategories',
            'passwordManagerGetPasswords',
            'passwordManagerAddPassword'
        ];
        
        const missingApis = requiredApis.filter(api => typeof window.api[api] !== 'function');
        
        if (missingApis.length > 0) {
            this.showError(`Missing password manager APIs: ${missingApis.join(', ')}. Please restart the application.`);
            console.error('Missing APIs:', missingApis);
            return;
        }

        await this.loadCategories();
        await this.loadPasswords();
    }

    async loadCategories() {
        try {
            console.log('Loading categories...');
            const result = await window.api.passwordManagerGetCategories();
            console.log('Categories result:', result);
            
            if (result.success) {
                this.categories = result.categories;
                this.renderCategories();
                this.renderCategorySelect();
                console.log('Categories loaded successfully:', this.categories.length);
            } else {
                console.error('Failed to load categories:', result.error);
                this.showError('Failed to load categories: ' + result.error);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.showError('Error loading categories: ' + error.message);
        }
    }

    async loadPasswords(categoryId = 'all') {
        try {
            console.log('Loading passwords for category:', categoryId);
            const result = await window.api.passwordManagerGetPasswords(categoryId);
            console.log('Passwords result:', result);
            
            if (result.success) {
                this.passwords = result.passwords;
                this.renderPasswords();
                console.log('Passwords loaded successfully:', this.passwords.length);
            } else {
                console.error('Failed to load passwords:', result.error);
                this.showError('Failed to load passwords: ' + result.error);
            }
        } catch (error) {
            console.error('Error loading passwords:', error);
            this.showError('Error loading passwords: ' + error.message);
        }
    }

    renderCategories() {
        const container = document.getElementById('categoriesContainer');
        container.innerHTML = '';

        // All categories button
        const allBtn = document.createElement('button');
        allBtn.className = `category-btn ${this.currentCategory === 'all' ? 'active' : ''}`;
        allBtn.textContent = this.t('all');
        allBtn.addEventListener('click', () => this.filterByCategory('all'));
        container.appendChild(allBtn);

        // Individual category buttons
        this.categories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = `category-btn ${this.currentCategory === category.id ? 'active' : ''}`;
            btn.textContent = category.name;
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
        const grid = document.getElementById('passwordsGrid');
        
        if (this.passwords.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i>🔒</i>
                    <h3>${this.t('no_passwords_found_title')}</h3>
                    <p>${this.t('no_passwords_found_sub')}</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.passwords.map(password => `
            <div class="password-card">
                <div class="password-header">
                    <h3 class="password-title">${this.escapeHtml(password.title)}</h3>
                    <div class="password-actions">
                        <button class="action-btn" onclick="pm.editPassword(${password.id})" title="Edit">✏️</button>
                        <button class="action-btn" onclick="pm.deletePassword(${password.id})" title="Delete">🗑️</button>
                    </div>
                </div>
                ${password.category_name ? `<span class="password-category">${this.escapeHtml(password.category_name)}</span>` : ''}
                <div class="password-field">
                    <span class="password-label">${this.t('username_label')}</span>
                    <div class="password-value">
                        <span class="password-text">${password.username ? this.escapeHtml(password.username) : '—'}</span>
                        ${password.username ? `<button class="copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.username)}')" title="${this.t('copy_username')}">📋</button>` : ''}
                    </div>
                </div>
                <div class="password-field">
                    <span class="password-label">${this.t('email_label')}</span>
                    <div class="password-value">
                        <span class="password-text">${password.email ? this.escapeHtml(password.email) : '—'}</span>
                        ${password.email ? `<button class="copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.email)}')" title="${this.t('copy_email')}">📋</button>` : ''}
                    </div>
                </div>
                <div class="password-field">
                    <span class="password-label">${this.t('password_label')}</span>
                    <div class="password-value">
                        <span class="password-text password-hidden">••••••••</span>
                        <button class="reveal-btn" onclick="pm.togglePassword(this, ${password.id})" title="${this.t('reveal_password')}">👁️</button>
                        <button class="copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.password)}')" title="${this.t('copy_password')}">📋</button>
                    </div>
                </div>
                ${password.url ? `
                <div class="password-field">
                    <span class="password-label">${this.t('url_label')}</span>
                    <div class="password-value">
                        <span class="password-text"><a href="${this.escapeHtml(password.url)}" target="_blank" style="color: var(--accent-color);">${this.escapeHtml(password.url)}</a></span>
                    </div>
                </div>` : ''}
                ${password.notes ? `
                <div class="password-field">
                    <span class="password-label">${this.t('notes_label')}</span>
                    <div class="password-value">
                        <span class="password-text">${this.escapeHtml(password.notes)}</span>
                    </div>
                </div>` : ''}
            </div>
        `).join('');
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
            title.textContent = this.t('edit_password_modal_title');
            this.fillPasswordForm(passwordId);
        } else {
            title.textContent = this.t('add_password_modal_title');
            form.reset();
            document.getElementById('passwordId').value = '';
        }

        modal.classList.add('active');
    }

    closePasswordModal() {
        document.getElementById('passwordModal').classList.remove('active');
        document.getElementById('passwordForm').reset();
        this.currentEditingId = null;
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
    }

    async savePassword(e) {
        e.preventDefault();

        // Check if API is available
        if (!window.api || typeof window.api.passwordManagerAddPassword !== 'function') {
            this.showError('Password manager is not available. Please restart the application.');
            return;
        }

        const passwordData = {
            title: document.getElementById('title').value,
            category_id: document.getElementById('category').value || null,
            username: document.getElementById('username').value || null,
            email: document.getElementById('email').value || null,
            password: document.getElementById('password').value,
            url: document.getElementById('url').value || null,
            notes: document.getElementById('notes').value || null
        };

        // Validate required fields
        if (!passwordData.title.trim() || !passwordData.password.trim()) {
            this.showError('Title and password are required fields.');
            return;
        }

        try {
            let result;
            if (this.currentEditingId) {
                result = await window.api.passwordManagerUpdatePassword(this.currentEditingId, passwordData);
            } else {
                result = await window.api.passwordManagerAddPassword(passwordData);
            }

            if (result.success) {
                this.closePasswordModal();
                this.loadPasswords(this.currentCategory);
                this.showSuccess('Password saved successfully!');
            } else {
                this.showError('Failed to save password: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Save password error:', error);
            this.showError('Error saving password: ' + error.message);
        }
    }

    editPassword(passwordId) {
        this.openPasswordModal(passwordId);
    }

    async deletePassword(passwordId) {
        if (!confirm('Are you sure you want to delete this password?')) return;

        try {
            const result = await window.api.passwordManagerDeletePassword(passwordId);
            if (result.success) {
                this.loadPasswords(this.currentCategory);
                this.showSuccess('Password deleted successfully!');
            } else {
                this.showError('Failed to delete password: ' + result.error);
            }
        } catch (error) {
            this.showError('Error deleting password: ' + error.message);
        }
    }

    async searchPasswords(query) {
        // Empty query resets the list
        if (!query.trim()) {
            await this.loadPasswords(this.currentCategory);
            return;
        }

        try {
            // Reload passwords for the current category then perform client‑side filtering
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

    openCategoriesModal() {
        this.renderCategoriesList();
        document.getElementById('categoriesModal').classList.add('active');
    }

    closeCategoriesModal() {
        document.getElementById('categoriesModal').classList.remove('active');
        document.getElementById('newCategoryName').value = '';
    }

    renderCategoriesList() {
        const container = document.getElementById('categoriesList');
        container.innerHTML = '';

        if (this.categories.length === 0) {
            container.innerHTML = `<p style="text-align: center; opacity: 0.7;">${this.t('no_categories')}</p>`;
            return;
        }

        this.categories.forEach(category => {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
                <input type="text" value="${this.escapeHtml(category.name)}" class="form-input category-name" data-id="${category.id}" style="flex: 1;">
                <button class="button button-secondary" onclick="pm.updateCategory(${category.id})">${this.t('update_category')}</button>
                <button class="button button-danger" onclick="pm.deleteCategory(${category.id})">${this.t('delete_category')}</button>
            `;
            container.appendChild(item);
        });
    }

    async addCategory() {
        const nameInput = document.getElementById('newCategoryName');
        const name = nameInput.value.trim();

        if (!name) {
            this.showError('Please enter a category name');
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
        if (!confirm('Are you sure you want to delete this category? Passwords in this category will be moved to "No Category".')) return;

        try {
            const result = await window.api.passwordManagerDeleteCategory(categoryId);
            if (result.success) {
                await this.loadCategories();
                this.renderCategoriesList();
                this.loadPasswords(this.currentCategory);
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

        const textElement = button.previousElementSibling;
        
        if (textElement.classList.contains('password-hidden')) {
            textElement.textContent = password.password;
            textElement.classList.remove('password-hidden');
            button.textContent = '🙈';
            button.title = 'Hide password';
        } else {
            textElement.textContent = '••••••••';
            textElement.classList.add('password-hidden');
            button.textContent = '👁️';
            button.title = 'Reveal password';
        }
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess('Copied to clipboard!');
        } catch (error) {
            this.showError('Failed to copy to clipboard: ' + error.message);
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize Password Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pm = new PasswordManager();
});