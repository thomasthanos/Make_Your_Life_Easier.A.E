let catalog = {};

export function setUiTranslations(translations) {
    catalog = translations?.ui || {};
}

export function uiText(key, fallback = key, values = {}) {
    const template = typeof catalog[key] === 'string' ? catalog[key] : fallback;
    return String(template).replace(/\{(\w+)\}/g, (token, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : token);
}
