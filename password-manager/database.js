const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

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

class PasswordManagerDB {
    constructor(authManager) {
        this.db = null;
        this.authManager = authManager;
        this.dbDirectory = null;
        this.isInitialized = false;
        this.initPromise = null;
    }

    /**
     * Internal helper to process a single row from the passwords table.
     * Attempts to parse and decrypt the encrypted_data field when
     * authentication is available. Falls back to returning empty strings
     * for missing fields. Centralizing this logic reduces duplication in
     * both getPasswords() and getPasswordsByCategory().
     * @param {Object} row Raw row returned from the database
     * @returns {Object} Processed row with decrypted fields
     */
    _processRow(row) {
        // If there's encrypted data, attempt to parse and decrypt it
        if (row.encrypted_data) {
            try {
                const parsed = JSON.parse(row.encrypted_data);
                let decrypted;
                // Only decrypt when authenticated and required fields exist
                if (this.authManager && this.authManager.isAuthenticated && parsed && parsed.iv && parsed.data && parsed.authTag) {
                    decrypted = this.authManager.decryptData(parsed);
                } else if (!parsed.iv) {
                    // In case the data was stored unencrypted (legacy), use as-is
                    decrypted = parsed;
                }
                if (decrypted) {
                    return {
                        ...row,
                        username: decrypted.username || '',
                        email: decrypted.email || '',
                        password: decrypted.password || '',
                        url: decrypted.url || '',
                        notes: decrypted.notes || ''
                    };
                }
            } catch (err) {
                // Log but continue; return fallback values below
                debug('error', 'Failed to parse or decrypt row ID:', row.id, err.message);
            }
        }
        // Return the original row with empty strings for missing fields
        return {
            ...row,
            username: row.username || '',
            email: row.email || '',
            password: row.password || '',
            url: row.url || '',
            notes: row.notes || ''
        };
    }

    /**
     * Validate required fields for adding or updating a password. If a
     * validation error is encountered the callback is invoked with an
     * appropriate Error and the function returns false.
     * @param {Object} data The passwordData passed in
     * @param {Function} callback The callback to propagate validation errors
     * @returns {boolean} Whether the data passed validation
     */
    _validateRequiredFields(data, callback) {
        const { title, password } = data;
        if (!title || !title.trim()) {
            callback(new Error('Title is required'), null);
            return false;
        }
        if (!password || !password.trim()) {
            callback(new Error('Password is required'), null);
            return false;
        }
        return true;
    }

    /**
     * Extract sensitive fields from the provided passwordData and apply
     * sensible defaults. This isolates the shape of the sensitive payload
     * used for encryption.
     * @param {Object} data The passwordData passed in
     * @returns {Object} Sensitive data ready for encryption
     */
    _prepareSensitiveData(data) {
        return {
            username: data.username || '',
            email: data.email || '',
            password: data.password,
            url: data.url || '',
            notes: data.notes || ''
        };
    }

    /**
     * Encrypt the provided sensitiveData if authentication is available. If
     * encryption fails or the user is not authenticated the callback is
     * invoked with an error and null is returned.
     * @param {Object} sensitiveData The plain sensitive data to encrypt
     * @param {Function} callback Callback for error propagation
     * @returns {Object|null} The encrypted data or null on failure
     */
    _encryptSensitiveData(sensitiveData, callback) {
        try {
            if (!this.authManager || !this.authManager.isAuthenticated) {
                callback(new Error('User must be authenticated to add/update a password'), null);
                return null;
            }
            return this.authManager.encryptData(sensitiveData);
        } catch (err) {
            callback(err, null);
            return null;
        }
    }

    async initializeDatabase() {
        try {
            const documentsPath = this.getDocumentsPath();
            this.dbDirectory = path.join(documentsPath, 'MakeYourLifeEasier');
            
            debug('info', 'Database directory:', this.dbDirectory);
            
            if (!fs.existsSync(this.dbDirectory)) {
                // Inform when the database directory is first created
                debug('info', 'Creating database directory...');
                fs.mkdirSync(this.dbDirectory, { recursive: true });
            }

            // Compose database path
            const dbPath = path.join(this.dbDirectory, 'password_manager.db');
            debug('info', 'Database path:', dbPath);
            
            return new Promise((resolve, reject) => {
                this.db = new sqlite3.Database(dbPath, (err) => {
                    if (err) {
                        debug('error', 'Error opening database:', err);
                        this.db = null;
                        reject(err);
                    } else {
                        debug('success', 'Connected to SQLite database');
                        this.createTables()
                            .then(() => {
                                this.isInitialized = true;
                                debug('success', 'Database fully initialized');
                                resolve(true);
                            })
                            .catch(reject);
                    }
                });
            });
        } catch (error) {
            debug('error', 'Database initialization error:', error);
            this.db = null;
            throw error;
        }
    }

    getDocumentsPath() {
        const oneDrivePaths = [
            path.join(os.homedir(), 'OneDrive', 'Documents'),
            path.join(os.homedir(), 'OneDrive - Personal', 'Documents'),
            path.join(os.homedir(), 'Documents')
        ];

        for (const oneDrivePath of oneDrivePaths) {
            if (fs.existsSync(oneDrivePath)) {
                return oneDrivePath;
            }
        }

        return path.join(os.homedir(), 'Documents');
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            this.db.serialize(() => {
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS categories (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL UNIQUE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        debug('error', 'Error creating categories table:', err);
                        reject(err);
                        return;
                    }
                    // Omit verbose success log for categories table creation
                });

                this.db.run(`
                    CREATE TABLE IF NOT EXISTS passwords (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category_id INTEGER,
                        category_name TEXT,
                        title TEXT NOT NULL,
                        image TEXT,
                        encrypted_data TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
                    )
                `, (err) => {
                    if (err) {
                        debug('error', 'Error creating passwords table:', err);
                        reject(err);
                        return;
                    }
                    // Do not log a verbose success message for passwords table creation

                    this.db.run(`ALTER TABLE passwords ADD COLUMN category_name TEXT`, (alterErr) => {
                        if (alterErr) {
                            if (alterErr.message && alterErr.message.includes('duplicate column name')) {
                                // Column already exists; no action needed
                                // Skip verbose log
                            } else {
                                debug('warn', 'Error adding category_name column (may already exist):', alterErr.message);
                            }
                        } else {
                            // Column added; omit verbose success log
                        }
                    });
                });

                this.db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
                    if (err) {
                        debug('error', 'Error checking categories:', err);
                        reject(err);
                        return;
                    }
                    if (row.count === 0) {
                        this.db.serialize(() => {
                            this.db.run("BEGIN TRANSACTION");
                            this.db.run("INSERT INTO categories (name) VALUES (?)", ["email"]);
                            this.db.run("INSERT INTO categories (name) VALUES (?)", ["social media"]);
                            this.db.run("INSERT INTO categories (name) VALUES (?)", ["gaming"], function(err) {
                                if (err) {
                                    debug('error', 'Error inserting default categories:', err);
                                    this.db.run("ROLLBACK");
                                    reject(err);
                                } else {
                                    debug('success', 'Default categories created');
                                    this.db.run("COMMIT", (commitErr) => {
                                        if (commitErr) {
                                            debug('error', 'Error committing default category insertion:', commitErr);
                                            reject(commitErr);
                                        } else {
                                            resolve(true);
                                        }
                                    });
                                }
                            }.bind(this));
                        });
                    } else {
                        debug('info', 'Categories already exist, skipping default creation');
                        resolve(true);
                    }
                });
            });
        });
    }

    async waitForDB() {
        if (!this.initPromise) {
            this.initPromise = this.initializeDatabase();
        }
        await this.initPromise;
        return this.db !== null;
    }

    async getCategories(callback) {
        try {
            await this.waitForDB();
            
            if (!this.db) {
                callback(new Error('Database not initialized'), null);
                return;
            }
            
            this.db.all("SELECT * FROM categories ORDER BY name", callback);
        } catch (error) {
            callback(error, null);
        }
    }

    async addCategory(name, callback) {
        try {
            await this.waitForDB();
            
            if (!this.db) {
                callback(new Error('Database not initialized'), null);
                return;
            }
            
            this.db.run("INSERT INTO categories (name) VALUES (?)", [name], callback);
        } catch (error) {
            callback(error, null);
        }
    }

    async updateCategory(id, name, callback) {
        try {
            await this.waitForDB();
            
            if (!this.db) {
                callback(new Error('Database not initialized'), null);
                return;
            }
            
            this.db.run("UPDATE categories SET name = ? WHERE id = ?", [name, id], callback);
        } catch (error) {
            callback(error, null);
        }
    }

    async deleteCategory(id, callback) {
        try {
            await this.waitForDB();
            
            if (!this.db) {
                callback(new Error('Database not initialized'), null);
                return;
            }
            
            this.db.run("UPDATE passwords SET category_id = NULL WHERE category_id = ?", [id], (err) => {
                if (err) return callback(err);
                this.db.run("DELETE FROM categories WHERE id = ?", [id], callback);
            });
        } catch (error) {
            callback(error, null);
        }
    }

    async getPasswords(callback) {
        try {
            await this.waitForDB();
            
            if (!this.db) {
                callback(new Error('Database not initialized'), null);
                return;
            }

            this.db.all(`
                SELECT p.id,
                       p.category_id,
                       COALESCE(c.name, p.category_name) AS category_name,
                       p.title,
                       p.image,
                       p.encrypted_data,
                       p.created_at,
                       p.updated_at
                FROM passwords p
                LEFT JOIN categories c ON p.category_id = c.id
                ORDER BY p.title
            `, (err, rows) => {
                if (err) {
                    callback(err, null);
                    return;
                }

                debug('info', `Retrieved ${rows.length} passwords, attempting decryption...`);

                // Use the unified row processing helper to reduce complexity
                const processedRows = rows.map(row => this._processRow(row));
                callback(null, processedRows);
            });
        } catch (error) {
            callback(error, null);
        }
    }

    async getPasswordsByCategory(categoryId, callback) {
        try {
            await this.waitForDB();
            
            if (!this.db) {
                callback(new Error('Database not initialized'), null);
                return;
            }

            if (categoryId === 'all') {
                this.getPasswords(callback);
            } else {
                this.db.all(`
                    SELECT p.id,
                           p.category_id,
                           COALESCE(c.name, p.category_name) AS category_name,
                           p.title,
                           p.image,
                           p.encrypted_data,
                           p.created_at,
                           p.updated_at
                    FROM passwords p 
                    LEFT JOIN categories c ON p.category_id = c.id 
                    WHERE p.category_id = ? 
                    ORDER BY p.title
                `, [categoryId], (err, rows) => {
                    if (err) {
                        callback(err, null);
                        return;
                    }
                    // Delegate to the common row processor helper for consistency and simplicity
                    const processedRows = rows.map(row => this._processRow(row));
                    callback(null, processedRows);
                });
            }
        } catch (error) {
            callback(error, null);
        }
    }

    async addPassword(passwordData, callback) {
        try {
            await this.waitForDB();
            
            if (!this.db) {
                callback(new Error('Database not initialized'), null);
                return;
            }

            const { category_id, category_name, title, password, image } = passwordData;

            // Log generic information; avoid logging password lengths or other
            // sensitive metadata.  Title is safe to log.
            debug('info', 'Adding password entry');
            debug('info', 'Title:', title);

            // Validate that mandatory fields are provided
            if (!this._validateRequiredFields(passwordData, callback)) {
                return;
            }

            // Prepare and encrypt sensitive data. If encryption fails the helper
            // will invoke the callback with the error.
            const sensitiveData = this._prepareSensitiveData(passwordData);
            const encrypted = this._encryptSensitiveData(sensitiveData, callback);
            if (!encrypted) {
                return;
            }

            this.db.run(`
                INSERT INTO passwords (category_id, category_name, title, image, encrypted_data)
                VALUES (?, ?, ?, ?, ?)
            `, [
                (category_id ? category_id : null),
                (category_name ? category_name : (category_id ? '' : 'no_category')),
                title.trim(),
                (image ? image : ''),
                JSON.stringify(encrypted)
            ], callback);
        } catch (error) {
            debug('error', 'Error in addPassword:', error);
            callback(error, null);
        }
    }

    async updatePassword(id, passwordData, callback) {
        try {
            await this.waitForDB();
            
            if (!this.db) {
                callback(new Error('Database not initialized'), null);
                return;
            }

            const { category_id, category_name, title, password, image } = passwordData;

            debug('info', 'Updating password with encryption...');

            // Validate mandatory fields
            if (!this._validateRequiredFields(passwordData, callback)) {
                return;
            }

            const sensitiveData = this._prepareSensitiveData(passwordData);
            const encrypted = this._encryptSensitiveData(sensitiveData, callback);
            if (!encrypted) {
                return;
            }

            this.db.run(`
                UPDATE passwords
                SET category_id = ?, category_name = ?, title = ?, image = ?, encrypted_data = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                (category_id ? category_id : null),
                (category_name ? category_name : (category_id ? '' : 'no_category')),
                title.trim(),
                (image ? image : ''),
                JSON.stringify(encrypted),
                id
            ], callback);
        } catch (error) {
            debug('error', 'Error in updatePassword:', error);
            callback(error, null);
        }
    }

    async deletePassword(id, callback) {
        try {
            await this.waitForDB();
            
            if (!this.db) {
                callback(new Error('Database not initialized'), null);
                return;
            }
            
            this.db.run("DELETE FROM passwords WHERE id = ?", [id], callback);
        } catch (error) {
            callback(error, null);
        }
    }

    async searchPasswords(query, callback) {
        try {
            await this.waitForDB();
            
            if (!this.db) {
                callback(new Error('Database not initialized'), null);
                return;
            }

            const searchTerm = `%${query}%`;
            this.db.all(`
                SELECT p.id,
                       p.category_id,
                       COALESCE(c.name, p.category_name) AS category_name,
                       p.title,
                       p.image,
                       p.encrypted_data,
                       p.created_at,
                       p.updated_at
                FROM passwords p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.title LIKE ?
                ORDER BY p.title
            `, [searchTerm], callback);
        } catch (error) {
            callback(error, null);
        }
    }

    close() {
        if (this.db) {
            this.db.close();
            debug('info', 'Database connection closed');
        }
    }
}

module.exports = PasswordManagerDB;