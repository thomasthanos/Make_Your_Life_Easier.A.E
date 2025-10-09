const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

class PasswordManagerAuth {
    constructor() {
        this.isAuthenticated = false;
        this.encryptionKey = null;
        this.sessionTimeout = 30 * 60 * 1000;
        this.sessionTimer = null;
        
        // Auto-initialize on creation
        this.initialize();
    }

    initialize() {
        try {
            // Χρήση της ίδιας λογικής με το database.js για OneDrive
            this.dbDirectory = this.getDocumentsPath();
            this.configPath = path.join(this.dbDirectory, 'pm_config.json');
            
            console.log('Auto-initializing auth manager...');
            console.log('Config path:', this.configPath);
            
            // Δημιουργία directory αν δεν υπάρχει
            if (!fs.existsSync(this.dbDirectory)) {
                fs.mkdirSync(this.dbDirectory, { recursive: true });
            }
            
            console.log('Auth manager initialized successfully');
        } catch (error) {
            console.error('Error auto-initializing auth manager:', error);
        }
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
                return path.join(oneDrivePath, 'MakeYourLifeEasier');
            }
        }

        // Fallback to regular Documents
        return path.join(os.homedir(), 'Documents', 'MakeYourLifeEasier');
    }
    hasMasterPassword() {
        try {
            return fs.existsSync(this.configPath);
        } catch (error) {
            console.error('Error checking master password:', error);
            return false;
        }
    }

    async createMasterPassword(password) {
        return new Promise((resolve, reject) => {
            try {
                if (password.length < 8) {
                    reject(new Error('Ο Master Password πρέπει να έχει τουλάχιστον 8 χαρακτήρες'));
                    return;
                }

                const salt = crypto.randomBytes(32);
                
                crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    try {
                        const config = {
                            hash: derivedKey.toString('hex'),
                            salt: salt.toString('hex'),
                            createdAt: new Date().toISOString()
                        };

                        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
                        this.generateEncryptionKey(password, salt);
                        this.isAuthenticated = true;
                        
                        resolve(true);
                    } catch (fileError) {
                        reject(new Error('Failed to create config file: ' + fileError.message));
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }


    // Σύνδεση με Master Password
    async authenticate(password) {
        return new Promise((resolve, reject) => {
            try {
                console.log('Authenticating...');
                
                if (!this.hasMasterPassword()) {
                    reject(new Error('Δεν έχει οριστεί Master Password'));
                    return;
                }

                // Φόρτωση ρυθμίσεων
                console.log('Reading config from:', this.configPath);
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const config = JSON.parse(configData);

                const salt = Buffer.from(config.salt, 'hex');

                // Επαλήθευση κωδικού
                crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
                    if (err) {
                        console.error('PBKDF2 error:', err);
                        reject(err);
                        return;
                    }

                    if (derivedKey.toString('hex') !== config.hash) {
                        console.log('Password mismatch');
                        reject(new Error('Λανθασμένος Master Password'));
                        return;
                    }

                    // Επιτυχής σύνδεση - δημιουργία κλειδιού κρυπτογράφησης
                    this.generateEncryptionKey(password, salt);
                    this.isAuthenticated = true;
                    
                    // Ρύθμιση session timeout
                    this.resetSessionTimer();
                    
                    console.log('Authentication successful');
                    resolve(true);
                });
            } catch (error) {
                console.error('Authentication error:', error);
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
            
            console.log('Encryption key generated successfully');
        } catch (error) {
            console.error('Error generating encryption key:', error);
            throw error;
        }
    }

    // Κρυπτογράφηση δεδομένων
// Στο encryptData method:
encryptData(data) {
    if (!this.isAuthenticated || !this.encryptionKey) {
        console.error('Cannot encrypt: Not authenticated or no encryption key');
        throw new Error('Δεν έχετε πιστοποιηθεί');
    }

    try {
        console.log('Encrypting data:', {
            hasPassword: !!data.password,
            passwordLength: data.password ? data.password.length : 0,
            hasUsername: !!data.username,
            hasEmail: !!data.email
        });

        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        console.log('Encryption successful');
        
        return {
            iv: iv.toString('hex'),
            data: encrypted,
            authTag: authTag.toString('hex')
        };
    } catch (error) {
        console.error('Encryption error:', error);
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
            console.error('Decryption error:', error);
            throw error;
        }
    }

    // Επαναφορά χρονομέτρου session
    resetSessionTimer() {
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
        }
        
        this.sessionTimer = setTimeout(() => {
            console.log('Session expired');
            this.logout();
        }, this.sessionTimeout);
    }

    // Αποσύνδεση
    logout() {
        console.log('Logging out...');
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
        
        console.log('Logout completed');
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