// Installer and updater share the same catalogs as the main renderer.
export async function loadStandaloneText(language, section) {
    const lang = /^(gr|el)(-|$)/i.test(language || navigator.language) ? 'gr' : 'en';
    let catalog;
    try {
        const response = await fetch(new URL(`./${lang}.json`, import.meta.url));
        if (!response.ok) throw new Error(`Catalog unavailable: ${lang}`);
        catalog = await response.json();
    } catch {
        catalog = await (await fetch(new URL('./en.json', import.meta.url))).json();
    }
    document.documentElement.lang = lang === 'gr' ? 'el' : 'en';
    return key => catalog[section]?.[key] || key;
}
