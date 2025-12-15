/**
 * Shared internationalization (i18n) utilities for Password Manager
 * Centralizes language detection, translation loading, and translation helper
 */

/**
 * Detect the user's preferred language from settings or document
 * @returns {string} 'gr' or 'en'
 */
function detectLanguage() {
    let langSetting = null;

    // Highest priority: explicit lang passed via query string (e.g. ?lang=en)
    try {
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const queryLang = params ? params.get('lang') : null;
        if (queryLang) {
            langSetting = queryLang.toLowerCase();
        }
    } catch (e) {
        // ignore query parsing errors
    }

    // Next: persisted app settings
    try {
        const settings = JSON.parse(localStorage.getItem('myAppSettings'));
        if (settings && typeof settings.lang === 'string' && settings.lang.length > 0) {
            langSetting = langSetting || settings.lang.toLowerCase();
        }
    } catch (e) {
        // ignore parsing errors
    }

    // Fallback: document's lang attribute
    if (!langSetting) {
        const docLang = (document.documentElement.lang || 'en').toLowerCase();
        langSetting = docLang;
    }

    const normalized = (langSetting.startsWith('gr') || langSetting.startsWith('el')) ? 'gr' : 'en';

    // Keep the document lang attribute in sync for assistive tech
    try {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = normalized;
        }
    } catch (e) {
        // ignore
    }

    return normalized;
}

/**
 * Load translations from JSON files
 * @param {string} lang - The language code ('en', 'gr', etc.)
 * @param {string} basePath - Base path to lang folder (default: 'lang')
 * @returns {Promise<Object>} Object with translations for 'en' and the selected language
 */
async function loadTranslations(lang, basePath = 'lang') {
    const translations = { en: {}, [lang]: {} };

    try {
        // Fetch the English base translations
        const enResponse = await fetch(`${basePath}/en.json`);
        const enData = await enResponse.json();
        translations.en = enData;

        // Load selected language if not English
        if (lang && lang !== 'en') {
            try {
                const langResponse = await fetch(`${basePath}/${lang}.json`);
                const langData = await langResponse.json();
                translations[lang] = { ...enData, ...langData };
            } catch (err) {
                console.warn('Failed to load language file:', err);
                translations[lang] = enData;
            }
        } else {
            translations[lang] = enData;
        }
    } catch (error) {
        console.error('Error loading translations:', error);
    }

    return translations;
}

/**
 * Translate a key with optional parameter interpolation
 * @param {Object} translations - The translations object
 * @param {string} lang - Current language code
 * @param {string} key - The translation key to look up
 * @param {Object} params - Optional map of placeholder values
 * @returns {string} The translated string with any placeholders replaced
 */
function translate(translations, lang, key, params = {}) {
    let translation;

    if (translations && translations[lang] && translations[lang][key]) {
        translation = translations[lang][key];
    } else if (translations && translations.en && translations.en[key]) {
        translation = translations.en[key];
    } else {
        translation = key;
    }

    // Replace placeholders like {placeholder} with values from params
    if (typeof translation === 'string' && params && Object.keys(params).length > 0) {
        return translation.replace(/\{([^}]+)\}/g, (match, p1) => {
            return Object.prototype.hasOwnProperty.call(params, p1) ? params[p1] : match;
        });
    }

    return translation;
}

/**
 * I18n class for managing translations in a component
 * Provides a convenient wrapper around the translation functions
 */
class I18n {
    constructor() {
        this.lang = detectLanguage();
        this.translations = { en: {}, [this.lang]: {} };
        this.isLoaded = false;
    }

    /**
     * Load translations from JSON files
     * @param {string} basePath - Base path to lang folder
     * @returns {Promise<void>}
     */
    async load(basePath = 'lang') {
        this.translations = await loadTranslations(this.lang, basePath);
        this.isLoaded = true;
    }

    /**
     * Translate a key
     * @param {string} key - Translation key
     * @param {Object} params - Optional placeholder values
     * @returns {string} Translated string
     */
    t(key, params = {}) {
        return translate(this.translations, this.lang, key, params);
    }

    /**
     * Get the current language
     * @returns {string}
     */
    getLanguage() {
        return this.lang;
    }

    /**
     * Set translations directly (useful for sharing between components)
     * @param {Object} translations
     */
    setTranslations(translations) {
        this.translations = translations;
        this.isLoaded = true;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { I18n, detectLanguage, loadTranslations, translate };
}

// Also expose globally for browser usage
if (typeof window !== 'undefined') {
    window.I18n = I18n;
    window.i18nUtils = { detectLanguage, loadTranslations, translate };
}
