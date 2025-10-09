class PasswordManager {
    constructor() {
        this.categories = [];
        this.passwords = [];
        this.currentCategory = 'all';
        this.currentEditingId = null;
        
        // Wait a bit for APIs to be available
        setTimeout(() => {
            this.initializeEventListeners();
            this.loadData();
        }, 1000);
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
        allBtn.textContent = 'All';
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
                    <h3>No passwords found</h3>
                    <p>Add your first password to get started</p>
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
                    <span class="password-label">Username:</span>
                    <div class="password-value">
                        <span class="password-text">${password.username ? this.escapeHtml(password.username) : '—'}</span>
                        ${password.username ? `<button class="copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.username)}')" title="Copy username">📋</button>` : ''}
                    </div>
                </div>
                <div class="password-field">
                    <span class="password-label">Email:</span>
                    <div class="password-value">
                        <span class="password-text">${password.email ? this.escapeHtml(password.email) : '—'}</span>
                        ${password.email ? `<button class="copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.email)}')" title="Copy email">📋</button>` : ''}
                    </div>
                </div>
                <div class="password-field">
                    <span class="password-label">Password:</span>
                    <div class="password-value">
                        <span class="password-text password-hidden">••••••••</span>
                        <button class="reveal-btn" onclick="pm.togglePassword(this, ${password.id})" title="Reveal password">👁️</button>
                        <button class="copy-btn" onclick="pm.copyToClipboard('${this.escapeHtml(password.password)}')" title="Copy password">📋</button>
                    </div>
                </div>
                ${password.url ? `
                <div class="password-field">
                    <span class="password-label">URL:</span>
                    <div class="password-value">
                        <span class="password-text"><a href="${this.escapeHtml(password.url)}" target="_blank" style="color: var(--accent-color);">${this.escapeHtml(password.url)}</a></span>
                    </div>
                </div>` : ''}
                ${password.notes ? `
                <div class="password-field">
                    <span class="password-label">Notes:</span>
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
            title.textContent = 'Edit Password';
            this.fillPasswordForm(passwordId);
        } else {
            title.textContent = 'Add Password';
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
    }

    closeCategoriesModal() {
        document.getElementById('categoriesModal').classList.remove('active');
        document.getElementById('newCategoryName').value = '';
    }

    renderCategoriesList() {
        const container = document.getElementById('categoriesList');
        container.innerHTML = '';

        if (this.categories.length === 0) {
            container.innerHTML = '<p style="text-align: center; opacity: 0.7;">No categories found</p>';
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