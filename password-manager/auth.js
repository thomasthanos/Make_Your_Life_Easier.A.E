const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Import debug from the shared module
const { debug } = require('../src/modules/debug');

// Import shared path utilities
const { getAppDataPath } = require('./utils/paths');

class PasswordManagerAuth {
    constructor() {
        this.isAuthenticated = false;
        this.encryptionKey = null;
        this.sessionTimeout = 30 * 60 * 1000;
        this.sessionTimer = null;
        this.dbDirectory = null;
        this.configPath = null;
    }

    /**
     * Initialize the auth manager with a custom directory path
     * @param {string} customPath - Optional custom directory path
     */
    initialize(customPath = null) {
        // Skip if already initialized with valid paths
        if (this.configPath && !customPath) {
            debug('info', 'Auth manager already initialized');
            return;
        }

        try {
            // Use custom path or shared utility for consistent path detection
            this.dbDirectory = customPath || getAppDataPath();
            this.configPath = path.join(this.dbDirectory, 'pm_config.json');

            debug('info', 'Initializing auth manager...');
            debug('info', 'Config path:', this.configPath);

            // Create directory if it doesn't exist
            if (!fs.existsSync(this.dbDirectory)) {
                fs.mkdirSync(this.dbDirectory, { recursive: true });
            }

            debug('success', 'Auth manager initialized successfully');
        } catch (error) {
            debug('error', 'Error initializing auth manager:', error);
        }
    }

    hasMasterPassword() {
        try {
            const exists = fs.existsSync(this.configPath);
            debug('info', 'Checking for master password at:', this.configPath);
            debug('info', 'Config file exists:', exists);
            return exists;
        } catch (error) {
            debug('error', 'Error checking master password:', error);
            return false;
        }
    }

    async createMasterPassword(password) {
        return new Promise((resolve, reject) => {
            try {
                debug('info', 'Creating master password...');
                debug('info', 'Config path:', this.configPath);
                debug('info', 'DB directory:', this.dbDirectory);

                if (!password || password.length < 8) {
                    reject(new Error('Ο Master Password πρέπει να έχει τουλάχιστον 8 χαρακτήρες'));
                    return;
                }

                // Ensure directory exists
                if (!fs.existsSync(this.dbDirectory)) {
                    debug('info', 'Creating directory:', this.dbDirectory);
                    fs.mkdirSync(this.dbDirectory, { recursive: true });
                }

                const salt = crypto.randomBytes(32);
                const scryptOptions = {
                    N: Math.pow(2, 14),
                    r: 8,
                    p: 1,
                    maxmem: 64 * 1024 * 1024
                };
                crypto.scrypt(password, salt, 64, scryptOptions, (err, derivedKey) => {
                    if (err) {
                        debug('error', 'Scrypt error:', err);
                        reject(err);
                        return;
                    }
                    try {
                        const config = {
                            hash: derivedKey.toString('hex'),
                            salt: salt.toString('hex'),
                            createdAt: new Date().toISOString(),
                            algorithm: 'scrypt'
                        };

                        debug('info', 'Writing config to:', this.configPath);
                        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));

                        // Verify file was written
                        if (fs.existsSync(this.configPath)) {
                            debug('success', 'Config file created successfully!');
                        } else {
                            debug('error', 'Config file NOT created!');
                            reject(new Error('Failed to create config file - file does not exist after write'));
                            return;
                        }

                        // Generate encryption key using HKDF
                        this.generateEncryptionKey(password, salt);
                        this.isAuthenticated = true;
                        resolve(true);
                    } catch (fileError) {
                        debug('error', 'File write error:', fileError);
                        reject(new Error('Failed to create config file: ' + fileError.message));
                    }
                });
            } catch (error) {
                debug('error', 'Create master password error:', error);
                reject(error);
            }
        });
    }


    // Σύνδεση με Master Password
    async authenticate(password) {
        /**
         * Authenticate a user by comparing the provided password with the
         * stored hash.  Uses scrypt when the stored configuration
         * indicates scrypt.  No plaintext password details are logged.  On
         * success the encryption key is regenerated and the session timer
         * is reset.
         */
        return new Promise((resolve, reject) => {
            try {
                debug('info', 'Authentication attempt...');
                debug('info', 'Config path:', this.configPath);

                if (!this.hasMasterPassword()) {
                    debug('error', 'No master password set - config file missing');
                    reject(new Error('Δεν έχει οριστεί Master Password'));
                    return;
                }

                debug('info', 'Reading config file...');
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const config = JSON.parse(configData);
                debug('info', 'Config loaded, algorithm:', config.algorithm);
                debug('info', 'Config created at:', config.createdAt);

                const salt = Buffer.from(config.salt, 'hex');
                const verify = (derivedKey) => {
                    const inputHash = derivedKey.toString('hex');
                    const storedHash = config.hash;

                    debug('info', 'Comparing hashes...');
                    debug('info', 'Input hash (first 16 chars):', inputHash.substring(0, 16) + '...');
                    debug('info', 'Stored hash (first 16 chars):', storedHash.substring(0, 16) + '...');

                    if (inputHash !== storedHash) {
                        debug('error', 'Hash mismatch - wrong password');
                        reject(new Error('Λανθασμένος Master Password'));
                        return;
                    }
                    debug('success', 'Hash match - authentication successful!');
                    this.generateEncryptionKey(password, salt);
                    this.isAuthenticated = true;
                    this.resetSessionTimer();
                    resolve(true);
                };
                if (config.algorithm === 'scrypt') {
                    const scryptOptions = {
                        N: Math.pow(2, 14),
                        r: 8,
                        p: 1,
                        maxmem: 64 * 1024 * 1024
                    };
                    crypto.scrypt(password, salt, 64, scryptOptions, (err, derivedKey) => {
                        if (err) {
                            debug('error', 'Scrypt error during auth:', err);
                            reject(err);
                            return;
                        }
                        verify(derivedKey);
                    });
                } else {
                    // Legacy support: verify PBKDF2 hashes
                    debug('info', 'Using legacy PBKDF2...');
                    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        verify(derivedKey);
                    });
                }
            } catch (error) {
                debug('error', 'Authentication error:', error);
                reject(error);
            }
        });
    }

    // Δημιουργία κλειδιού κρυπτογράφησης
    generateEncryptionKey(password, salt) {
        try {
            // Χρήση HKDF για εξαγωγή κλειδιού από τον κωδικό
            const hkdf = crypto.createHmac('sha256', password);
            hkdf.update(salt);
            const pseudoRandomKey = hkdf.digest();

            // Δημιουργία τελικού κλειδιού AES-256
            const finalHkdf = crypto.createHmac('sha256', pseudoRandomKey);
            finalHkdf.update('encryption-key');
            this.encryptionKey = finalHkdf.digest();

            debug('success', 'Encryption key generated successfully');
        } catch (error) {
            debug('error', 'Error generating encryption key:', error);
            throw error;
        }
    }

    // Κρυπτογράφηση δεδομένων
    // Στο encryptData method:
    encryptData(data) {
        if (!this.isAuthenticated || !this.encryptionKey) {
            debug('error', 'Cannot encrypt: Not authenticated or no encryption key');
            throw new Error('Δεν έχετε πιστοποιηθεί');
        }

        try {
            // Perform AES‑256‑GCM encryption.  Avoid logging sensitive
            // properties such as password length【186042565597416†L1395-L1398】.  Only
            // report generic success or failure messages.
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag();
            return {
                iv: iv.toString('hex'),
                data: encrypted,
                authTag: authTag.toString('hex')
            };
        } catch (error) {
            // Log a generic message without revealing sensitive details
            debug('error', 'Encryption error');
            throw error;
        }
    }

    // Αποκρυπτογράφηση δεδομένων
    decryptData(encryptedData) {
        if (!this.isAuthenticated || !this.encryptionKey) {
            throw new Error('Δεν έχετε πιστοποιηθεί');
        }

        try {
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const authTag = Buffer.from(encryptedData.authTag, 'hex');

            const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return JSON.parse(decrypted);
        } catch (error) {
            debug('error', 'Decryption error:', error);
            throw error;
        }
    }

    // Επαναφορά χρονομέτρου session
    resetSessionTimer() {
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
        }

        this.sessionTimer = setTimeout(() => {
            debug('warn', 'Session expired');
            this.logout();
        }, this.sessionTimeout);
    }

    // Αποσύνδεση
    logout() {
        debug('info', 'Logging out...');
        this.isAuthenticated = false;

        // Ασφαλής εκκαθάριση κλειδιού από μνήμη
        if (this.encryptionKey) {
            this.encryptionKey.fill(0);
            this.encryptionKey = null;
        }

        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
            this.sessionTimer = null;
        }

        debug('success', 'Logout completed');
    }

    // Αλλαγή Master Password
    async changeMasterPassword(currentPassword, newPassword) {
        if (!this.isAuthenticated) {
            throw new Error('Πρέπει να είστε πιστοποιημένοι');
        }

        // Επαλήθευση τρέχοντος κωδικού
        await this.authenticate(currentPassword);

        // Δημιουργία νέου Master Password
        await this.createMasterPassword(newPassword);

        return true;
    }

    // Έλεγχος ισχύος κωδικού
    validatePasswordStrength(password) {
        const requirements = {
            minLength: password.length >= 8,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumbers: /\d/.test(password),
            hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        const strength = Object.values(requirements).filter(Boolean).length;

        return {
            requirements,
            strength,
            isValid: strength >= 3 // Τουλάχιστον 3 από τις 5 απαιτήσεις
        };
    }
}

module.exports = PasswordManagerAuth;