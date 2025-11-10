const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

class PasswordManagerDB {
    constructor(authManager) {
        this.db = null;
        this.authManager = authManager;
        this.dbDirectory = null;
        this.isInitialized = false;
        this.initPromise = null;
    }

    async initializeDatabase() {
        try {
            const documentsPath = this.getDocumentsPath();
            this.dbDirectory = path.join(documentsPath, 'MakeYourLifeEasier');
            
            console.log('Database directory:', this.dbDirectory);
            
            if (!fs.existsSync(this.dbDirectory)) {
                console.log('Creating database directory...');
                fs.mkdirSync(this.dbDirectory, { recursive: true });
            }

            console.log('Auth manager directory should match:', this.dbDirectory);

            const dbPath = path.join(this.dbDirectory, 'password_manager.db');
            console.log('Database path:', dbPath);
            
            return new Promise((resolve, reject) => {
                this.db = new sqlite3.Database(dbPath, (err) => {
                    if (err) {
                        console.error('Error opening database:', err);
                        this.db = null;
                        reject(err);
                    } else {
                        console.log('Connected to SQLite database');
                        this.createTables()
                            .then(() => {
                                this.isInitialized = true;
                                console.log('Database fully initialized');
                                resolve(true);
                            })
                            .catch(reject);
                    }
                });
            });
        } catch (error) {
            console.error('Database initialization error:', error);
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
                        console.error('Error creating categories table:', err);
                        reject(err);
                        return;
                    }
                    console.log('Categories table ready');
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
                        console.error('Error creating passwords table:', err);
                        reject(err);
                        return;
                    }
                    console.log('Passwords table ready');

                    this.db.run(`ALTER TABLE passwords ADD COLUMN category_name TEXT`, (alterErr) => {
                        if (alterErr) {
                            if (alterErr.message && alterErr.message.includes('duplicate column name')) {
                                console.log('category_name column already exists, no migration needed');
                            } else {
                                console.warn('Error adding category_name column (may already exist):', alterErr.message);
                            }
                        } else {
                            console.log('category_name column added to passwords table');
                        }
                    });
                });

                this.db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
                    if (err) {
                        console.error('Error checking categories:', err);
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
                                    console.error('Error inserting default categories:', err);
                                    this.db.run("ROLLBACK");
                                    reject(err);
                                } else {
                                    console.log('Default categories created');
                                    this.db.run("COMMIT", (commitErr) => {
                                        if (commitErr) {
                                            console.error('Error committing default category insertion:', commitErr);
                                            reject(commitErr);
                                        } else {
                                            resolve(true);
                                        }
                                    });
                                }
                            }.bind(this));
                        });
                    } else {
                        console.log('Categories already exist, skipping default creation');
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

                console.log('Retrieved', rows.length, 'passwords, attempting decryption...');

                const processedRows = rows.map(row => {
                    if (row.encrypted_data) {
                        try {
                            const parsed = JSON.parse(row.encrypted_data);
                            let decrypted;
                            if (this.authManager && this.authManager.isAuthenticated && parsed && parsed.iv && parsed.data && parsed.authTag) {
                                console.log('Attempting to decrypt row ID:', row.id);
                                decrypted = this.authManager.decryptData(parsed);
                                console.log('Decryption successful for row ID:', row.id);
                            } else if (!parsed.iv) {
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
                            console.error('Failed to parse or decrypt row ID:', row.id, err.message);
                        }
                    }
                    return {
                        ...row,
                        username: row.username || '',
                        email: row.email || '',
                        password: row.password || '',
                        url: row.url || '',
                        notes: row.notes || ''
                    };
                });

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
                    const processedRows = rows.map(row => {
                        if (row.encrypted_data) {
                            try {
                                const parsed = JSON.parse(row.encrypted_data);
                                let decrypted;
                                if (this.authManager && this.authManager.isAuthenticated && parsed && parsed.iv && parsed.data && parsed.authTag) {
                                    decrypted = this.authManager.decryptData(parsed);
                                } else if (!parsed.iv) {
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
                            } catch (parseErr) {
                                console.error('Failed to parse or decrypt row ID:', row.id, parseErr.message);
                            }
                        }
                        return {
                            ...row,
                            username: row.username || '',
                            email: row.email || '',
                            password: row.password || '',
                            url: row.url || '',
                            notes: row.notes || ''
                        };
                    });
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

            const { category_id, category_name, title, username, email, password, url, notes, image } = passwordData;
            
            // Log generic information; avoid logging password lengths or other
            // sensitive metadata.  Title is safe to log.
            console.log('Adding password entry');
            console.log('Title:', title);

            if (!title || !title.trim()) {
                callback(new Error('Title is required'), null);
                return;
            }
            
            if (!password || !password.trim()) {
                callback(new Error('Password is required'), null);
                return;
            }

            // Assemble sensitive data
            const sensitiveData = {
                username: username || '',
                email: email || '',
                password: password,
                url: url || '',
                notes: notes || ''
            };
            try {
                if (!this.authManager || !this.authManager.isAuthenticated) {
                    // Refuse to store unencrypted data.  Do not fall back to
                    // plain JSON when the user has not authenticated.  This
                    // prevents accidental leakage of secrets【395143299479830†L194-L204】.
                    callback(new Error('User must be authenticated to add a password'), null);
                    return;
                }
                // Encrypt sensitive fields
                const encrypted = this.authManager.encryptData(sensitiveData);
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
            } catch (authError) {
                // Do not store sensitive data when encryption fails
                callback(authError, null);
            }
        } catch (error) {
            console.error('Error in addPassword:', error);
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

            const { category_id, category_name, title, username, email, password, url, notes, image } = passwordData;
            
            console.log('Updating password with encryption...');

            if (!title || !title.trim()) {
                callback(new Error('Title is required'), null);
                return;
            }
            
            if (!password || !password.trim()) {
                callback(new Error('Password is required'), null);
                return;
            }

            // Assemble sensitive data
            const sensitiveData = {
                username: username || '',
                email: email || '',
                password: password,
                url: url || '',
                notes: notes || ''
            };
            try {
                if (!this.authManager || !this.authManager.isAuthenticated) {
                    callback(new Error('User must be authenticated to update a password'), null);
                    return;
                }
                const encrypted = this.authManager.encryptData(sensitiveData);
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
            } catch (authError) {
                callback(authError, null);
            }
        } catch (error) {
            console.error('Error in updatePassword:', error);
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
            console.log('Database connection closed');
        }
    }
}

module.exports = PasswordManagerDB;