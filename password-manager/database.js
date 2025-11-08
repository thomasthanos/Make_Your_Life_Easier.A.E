const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

class PasswordManagerDB {

    async initializeDatabase() {
        try {
            const documentsPath = this.getDocumentsPath();
            this.dbDirectory = path.join(documentsPath, 'MakeYourLifeEasier');
            
            console.log('Database directory:', this.dbDirectory);
            
            if (!fs.existsSync(this.dbDirectory)) {
                console.log('Creating database directory...');
                fs.mkdirSync(this.dbDirectory, { recursive: true });
            }

            // Ο authManager έχει ήδη αρχικοποιηθεί με την ίδια διαδρομή
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
  // Στο database.js, στον constructor:
constructor(authManager) {
    this.db = null;
    this.authManager = authManager;
    this.dbDirectory = null;
    this.isInitialized = false;
    
    // ΜΗΝ καλείς το init() εδώ - περιμένει το initializeDatabase
    this.initPromise = null;
}
    getDocumentsPath() {
        // Try to get OneDrive Documents path first
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

        // Fallback to regular Documents
        return path.join(os.homedir(), 'Documents');
    }
async createTables() {
    return new Promise((resolve, reject) => {
        if (!this.db) {
            reject(new Error('Database not initialized'));
            return;
        }

        // Run all table creations sequentially
        this.db.serialize(() => {
            // Categories table
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

            // Passwords table.  We avoid storing sensitive fields in plain text.  All sensitive
            // values (username, email, password, url, notes) will be persisted only in
            // encrypted_data as either an encrypted payload or a plain JSON object if
            // encryption is not available.  The table therefore includes only the
            // columns we truly need: id, category_id, title, image, encrypted_data and
            // timestamps.  The image column stores a data URI or external URL to the
            // service logo.
            this.db.run(`
                CREATE TABLE IF NOT EXISTS passwords (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category_id INTEGER,
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
            });

            // Insert default category
            this.db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
                if (err) {
                    console.error('Error checking categories:', err);
                    reject(err);
                    return;
                }
                
                if (row.count === 0) {
                    this.db.run("INSERT INTO categories (name) VALUES (?)", ["General"], function(err) {
                        if (err) {
                            console.error('Error inserting default category:', err);
                            reject(err);
                        } else {
                            console.log('Default category created with ID:', this.lastID);
                            resolve(true);
                        }
                    });
                } else {
                    console.log('Categories already exist, skipping default creation');
                    resolve(true);
                }
            });
        });
    });
}



  // Wait for database to be ready
  async waitForDB() {
    if (!this.initPromise) {
      this.initPromise = this.initializeDatabase();
    }
    await this.initPromise;
    return this.db !== null;
  }

  // Category methods
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
      
      // First update passwords in this category to NULL category
      this.db.run("UPDATE passwords SET category_id = NULL WHERE category_id = ?", [id], (err) => {
        if (err) return callback(err);
        // Then delete the category
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
            SELECT p.id, p.category_id, p.title, p.image, p.encrypted_data, p.created_at, p.updated_at, c.name as category_name
            FROM passwords p
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.title
        `, (err, rows) => {
            if (err) {
                callback(err, null);
                return;
            }

            console.log('Retrieved', rows.length, 'passwords, attempting decryption...');

            // Προσπάθεια αποκρυπτογράφησης ή ανάγνωσης μη κρυπτογραφημένων δεδομένων από το πεδίο encrypted_data.
            const processedRows = rows.map(row => {
                // Always attempt to parse the encrypted_data field if it exists.  This field may
                // contain either an encrypted payload (with iv, data, authTag) or a plain
                // JSON object with the sensitive fields when encryption is not available.
                if (row.encrypted_data) {
                    try {
                        const parsed = JSON.parse(row.encrypted_data);
                        let decrypted;
                        // If the parsed object has the expected encryption keys and we are
                        // authenticated, attempt decryption.  Otherwise treat it as plain JSON.
                        if (this.authManager && this.authManager.isAuthenticated && parsed && parsed.iv && parsed.data && parsed.authTag) {
                            console.log('Attempting to decrypt row ID:', row.id);
                            decrypted = this.authManager.decryptData(parsed);
                            console.log('Decryption successful for row ID:', row.id);
                        } else if (!parsed.iv) {
                            // No iv indicates this is already plain JSON
                            decrypted = parsed;
                        }
                        if (decrypted) {
                            return {
                                ...row,
                                username: decrypted.username || null,
                                email: decrypted.email || null,
                                password: decrypted.password || null,
                                url: decrypted.url || null,
                                notes: decrypted.notes || null
                            };
                        }
                    } catch (err) {
                        console.error('Failed to parse or decrypt row ID:', row.id, err.message);
                    }
                }
                // If there is no encrypted_data or parsing/decryption failed, ensure
                // sensitive fields are present (set to null) so UI can display
                return {
                    ...row,
                    username: row.username || null,
                    email: row.email || null,
                    password: row.password || null,
                    url: row.url || null,
                    notes: row.notes || null
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
          SELECT p.*, c.name as category_name 
          FROM passwords p 
          LEFT JOIN categories c ON p.category_id = c.id 
          WHERE p.category_id = ? 
          ORDER BY p.title
        `, [categoryId], callback);
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

        const { category_id, title, username, email, password, url, notes, image } = passwordData;
        
        console.log('Adding password with encryption...');
        console.log('Title:', title);
        console.log('Password length:', password ? password.length : 0);

        // Βασικός έλεγχος για required fields
        if (!title || !title.trim()) {
            callback(new Error('Title is required'), null);
            return;
        }
        
        if (!password || !password.trim()) {
            callback(new Error('Password is required'), null);
            return;
        }

        // Attempt to encrypt sensitive data.  If encryption is not available, we
        // still persist the sensitive fields inside encrypted_data as a plain
        // JSON object.  This ensures we never persist username/email/password/url/notes
        // in separate columns.
        let dataToStore;
        try {
            const sensitiveData = {
                username: username || null,
                email: email || null,
                password: password,
                url: url || null,
                notes: notes || null
            };
            if (this.authManager && this.authManager.isAuthenticated) {
                console.log('Attempting to encrypt data...');
                dataToStore = this.authManager.encryptData(sensitiveData);
                console.log('Encryption successful, encrypted data length:', JSON.stringify(dataToStore).length);
            } else {
                console.warn('Auth manager not authenticated, storing sensitive data in plain JSON');
                dataToStore = sensitiveData;
            }
        } catch (authError) {
            console.error('Encryption failed:', authError.message);
            // Fall back to plain JSON if encryption fails
            dataToStore = {
                username: username || null,
                email: email || null,
                password: password,
                url: url || null,
                notes: notes || null
            };
        }

        // Persist the record.  Sensitive data (encrypted or plain) is stored
        // exclusively in the encrypted_data column.
        this.db.run(`
            INSERT INTO passwords (category_id, title, image, encrypted_data)
            VALUES (?, ?, ?, ?)
        `, [
            category_id || null,
            title.trim(),
            image || null,
            JSON.stringify(dataToStore)
        ], callback);
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

        const { category_id, title, username, email, password, url, notes, image } = passwordData;
        
        console.log('Updating password with encryption...');

        // Βασικός έλεγχος για required fields
        if (!title || !title.trim()) {
            callback(new Error('Title is required'), null);
            return;
        }
        
        if (!password || !password.trim()) {
            callback(new Error('Password is required'), null);
            return;
        }

        // Attempt to encrypt updated sensitive data.  If encryption is not available,
        // the sensitive fields are stored in plain JSON within the encrypted_data column.
        let dataToStore;
        try {
            const sensitiveData = {
                username: username || null,
                email: email || null,
                password: password,
                url: url || null,
                notes: notes || null
            };
            if (this.authManager && this.authManager.isAuthenticated) {
                console.log('Attempting to encrypt data for update...');
                dataToStore = this.authManager.encryptData(sensitiveData);
                console.log('Encryption successful for update');
            } else {
                console.warn('Auth manager not authenticated for update; storing plain JSON');
                dataToStore = sensitiveData;
            }
        } catch (authError) {
            console.error('Encryption failed for update:', authError.message);
            dataToStore = {
                username: username || null,
                email: email || null,
                password: password,
                url: url || null,
                notes: notes || null
            };
        }

        // Update the record.  Sensitive data is stored solely in encrypted_data.
        this.db.run(`
            UPDATE passwords
            SET category_id = ?, title = ?, image = ?, encrypted_data = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            category_id || null,
            title.trim(),
            image || null,
            JSON.stringify(dataToStore),
            id
        ], callback);
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
      // We no longer store sensitive fields in separate columns.  Search is
      // therefore limited to the title.  Additional filtering can be
      // implemented client-side after decrypting the data.
      this.db.all(`
        SELECT p.id, p.category_id, p.title, p.image, p.encrypted_data, p.created_at, p.updated_at, c.name as category_name
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