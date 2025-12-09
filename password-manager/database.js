const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// ✅ Import debug from the shared module
const { debug } = require('../src/modules/debug');

// Import shared path utilities
const { getAppDataPath } = require('./utils/paths');

class PasswordManagerDB {
    constructor(authManager) {
        this.db = null;
        this.authManager = authManager;
        this.dbDirectory = null;
        this.isInitialized = false;
        this.initPromise = null;
    }

    // --- Small promise helpers to avoid callback nesting with sqlite3 ---
    _runAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('Database not initialized'));
            this.db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve(this); // keep "this" for lastID/changes when needed
            });
        });
    }

    _getAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('Database not initialized'));
            this.db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    _allAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('Database not initialized'));
            this.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
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
            // Use shared utility for consistent path detection
            this.dbDirectory = getAppDataPath();

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

    async createTables() {
        if (!this.db) throw new Error('Database not initialized');

        try {
            // Create categories
            await this._runAsync(`
                CREATE TABLE IF NOT EXISTS categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create passwords
            await this._runAsync(`
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
            `);

            // Migration: ensure category_name exists (older DBs)
            const columns = await this._allAsync(`PRAGMA table_info(passwords)`);
            const hasCategoryName = columns.some((c) => c.name === 'category_name');
            if (!hasCategoryName) {
                try {
                    await this._runAsync(`ALTER TABLE passwords ADD COLUMN category_name TEXT`);
                } catch (alterErr) {
                    debug('warn', 'Error adding category_name column:', alterErr.message);
                }
            }

            // Seed default categories if empty
            const row = await this._getAsync("SELECT COUNT(*) as count FROM categories");
            if (row && row.count === 0) {
                await this._runAsync("BEGIN TRANSACTION");
                try {
                    await this._runAsync("INSERT INTO categories (name) VALUES (?)", ["email"]);
                    await this._runAsync("INSERT INTO categories (name) VALUES (?)", ["social media"]);
                    await this._runAsync("INSERT INTO categories (name) VALUES (?)", ["gaming"]);
                    await this._runAsync("COMMIT");
                    debug('success', 'Default categories created');
                } catch (seedErr) {
                    await this._runAsync("ROLLBACK").catch(() => {});
                    throw seedErr;
                }
            } else {
                debug('info', 'Categories already exist, skipping default creation');
            }

            return true;
        } catch (error) {
            debug('error', 'Error creating tables:', error);
            throw error;
        }
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

    /**
     * Retrieve a single password row by id (decrypted)
     * @param {number} id
     * @param {Function} callback
     */
    async getPasswordById(id, callback) {
        try {
            await this.waitForDB();

            if (!this.db) {
                callback(new Error('Database not initialized'), null);
                return;
            }

            this.db.get(`
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
                WHERE p.id = ?
                LIMIT 1
            `, [id], (err, row) => {
                if (err) {
                    callback(err, null);
                    return;
                }
                if (!row) {
                    callback(new Error('Password not found'), null);
                    return;
                }
                const processed = this._processRow(row);
                callback(null, processed);
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

            // Get all passwords first (they need to be decrypted for full search)
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

                // Decrypt all rows
                const processedRows = rows.map(row => this._processRow(row));

                // Filter by query (search in title, username, email, url, notes)
                const queryLower = query.toLowerCase();
                const filteredRows = processedRows.filter(row => {
                    return (
                        (row.title && row.title.toLowerCase().includes(queryLower)) ||
                        (row.username && row.username.toLowerCase().includes(queryLower)) ||
                        (row.email && row.email.toLowerCase().includes(queryLower)) ||
                        (row.url && row.url.toLowerCase().includes(queryLower)) ||
                        (row.notes && row.notes.toLowerCase().includes(queryLower))
                    );
                });

                callback(null, filteredRows);
            });
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