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

            // Passwords table - includes image column to store logos/icons.  The password field is nullable.
            this.db.run(`
                CREATE TABLE IF NOT EXISTS passwords (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category_id INTEGER,
                    title TEXT NOT NULL,
                    username TEXT,
                    email TEXT,
                    password TEXT,  -- password field is nullable in case encryption is used
                    url TEXT,
                    notes TEXT,
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
                // Ensure the image column exists for existing databases.  If not, attempt to add it.
                this.db.all("PRAGMA table_info(passwords)", (tableErr, columns) => {
                    if (tableErr) {
                        console.error('Failed to inspect passwords table:', tableErr);
                        return;
                    }
                    const hasImage = Array.isArray(columns) && columns.some(col => col.name === 'image');
                    if (!hasImage) {
                        console.log('Adding image column to passwords table...');
                        this.db.run("ALTER TABLE passwords ADD COLUMN image TEXT", (alterErr) => {
                            if (alterErr) {
                                console.error('Error adding image column:', alterErr);
                            } else {
                                console.log('Image column added successfully');
                            }
                        });
                    }
                });
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
            SELECT p.id, p.category_id, p.title, p.username, p.email, p.password, p.url, p.notes, p.image, p.encrypted_data, p.created_at, p.updated_at, c.name as category_name 
            FROM passwords p 
            LEFT JOIN categories c ON p.category_id = c.id 
            ORDER BY p.title
        `, (err, rows) => {
            if (err) {
                callback(err, null);
                return;
            }

            console.log('Retrieved', rows.length, 'passwords, attempting decryption...');

            // Προσπάθεια αποκρυπτογράφησης
            const processedRows = rows.map(row => {
                // Αν υπάρχει encrypted_data, προσπάθησε να το αποκρυπτογραφήσεις
                if (row.encrypted_data && this.authManager && this.authManager.isAuthenticated) {
                    try {
                        console.log('Attempting to decrypt row ID:', row.id);
                        const encryptedData = JSON.parse(row.encrypted_data);
                        const decrypted = this.authManager.decryptData(encryptedData);
                        
                        console.log('Decryption successful for row ID:', row.id);
                        
                        return {
                            ...row,
                            username: decrypted.username,
                            email: decrypted.email,
                            password: decrypted.password,
                            url: decrypted.url,
                            notes: decrypted.notes
                        };
                    } catch (decryptError) {
                        console.error('Failed to decrypt row ID:', row.id, decryptError.message);
                        // Επιστροφή των plain text δεδομένων αν η αποκρυπτογράφηση αποτύχει
                        return row;
                    }
                } else {
                    // Αν δεν υπάρχει encrypted_data ή δεν είμαστε authenticated, επέστρεψε τα plain text δεδομένα
                    console.log('No encrypted data or not authenticated for row ID:', row.id);
                    return row;
                }
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

        // Προσπάθεια κρυπτογράφησης
        let encryptedData = null;
        try {
            if (this.authManager && this.authManager.isAuthenticated) {
                const sensitiveData = {
                    username: username || null,
                    email: email || null,
                    password: password,
                    url: url || null,
                    notes: notes || null
                };
                console.log('Attempting to encrypt data...');
                encryptedData = this.authManager.encryptData(sensitiveData);
                console.log('Encryption successful, encrypted data length:', JSON.stringify(encryptedData).length);
            } else {
                console.warn('Auth manager not authenticated, using plain text');
            }
        } catch (authError) {
            console.error('Encryption failed:', authError.message);
            // Συνεχίζουμε με plain text αν η κρυπτογράφηση αποτύχει
        }

        if (encryptedData) {
            // Store encrypted data along with the image (unencrypted)
            this.db.run(`
                INSERT INTO passwords (category_id, title, encrypted_data, image) 
                VALUES (?, ?, ?, ?)
            `, [
                category_id || null,
                title.trim(),
                JSON.stringify(encryptedData),
                image || null
            ], callback);
        } else {
            // Store as plain text (fallback) - include the image column
            console.log('Using plain text fallback');
            this.db.run(`
                INSERT INTO passwords (category_id, title, username, email, password, url, notes, image) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                category_id || null,
                title.trim(),
                username ? username.trim() : null,
                email ? email.trim() : null,
                password,
                url ? url.trim() : null,
                notes ? notes.trim() : null,
                image || null
            ], callback);
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

        // Προσπάθεια κρυπτογράφησης
        let encryptedData = null;
        try {
            if (this.authManager && this.authManager.isAuthenticated) {
                const sensitiveData = {
                    username: username || null,
                    email: email || null,
                    password: password,
                    url: url || null,
                    notes: notes || null
                };
                encryptedData = this.authManager.encryptData(sensitiveData);
                console.log('Encryption successful for update');
            } else {
                console.warn('Auth manager not authenticated for update, using plain text');
            }
        } catch (authError) {
            console.error('Encryption failed for update:', authError.message);
        }

        if (encryptedData) {
            // Update encrypted data and image separately
            this.db.run(`
                UPDATE passwords 
                SET category_id = ?, title = ?, encrypted_data = ?, image = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [
                category_id || null,
                title.trim(),
                JSON.stringify(encryptedData),
                image || null,
                id
            ], callback);
        } else {
            // Update as plain text (fallback) including image
            console.log('Using plain text fallback for update');
            this.db.run(`
                UPDATE passwords 
                SET category_id = ?, title = ?, username = ?, email = ?, password = ?, url = ?, notes = ?, image = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [
                category_id || null,
                title.trim(),
                username ? username.trim() : null,
                email ? email.trim() : null,
                password,
                url ? url.trim() : null,
                notes ? notes.trim() : null,
                image || null,
                id
            ], callback);
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
        SELECT p.*, c.name as category_name 
        FROM passwords p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.title LIKE ? OR p.username LIKE ? OR p.email LIKE ? OR p.url LIKE ? OR p.notes LIKE ?
        ORDER BY p.title
      `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm], callback);
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