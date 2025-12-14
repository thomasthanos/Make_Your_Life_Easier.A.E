/**
 * Favicon Configuration
 * Central source of truth for all app icons/favicons
 * Used by both updater (preload) and renderer (display)
 */

const FaviconConfig = {
  // External domains for DNS prefetch/preconnect
  domains: [
    'www.google.com',
    'cdn.jsdelivr.net',
    'i.postimg.cc'
  ],

  // Custom icons mapped by package ID
  customIcons: {
    // IObit apps
    'IObit.Uninstaller': 'https://www.google.com/s2/favicons?domain=iobit-uninstaller.en.softonic.com&sz=64',
    'IObit.AdvancedSystemCare': 'https://www.google.com/s2/favicons?domain=iobit-advanced-systemcare.en.softonic.com&sz=64',
    'IObit.SmartDefrag': 'https://www.google.com/s2/favicons?domain=smart-defrag.en.softonic.com&sz=64',
    'IObit.IObitSysInfo': 'https://i.postimg.cc/tC6TkWFV/isf-icon-big.png',
    'IObit.IObitSoftwareUpdater': 'https://www.google.com/s2/favicons?domain=iobit-software-updater.en.softonic.com&sz=64',
    'IObit.DriverBooster': 'https://www.google.com/s2/favicons?domain=driver-booster-free.en.softonic.com&sz=64',
    'IObit.MalwareFighter': 'https://www.google.com/s2/favicons?domain=iobit-malware-fighter.en.softonic.com&sz=64',
    
    // Gaming
    'LeagueOfLegends.Dropbox': 'https://www.google.com/s2/favicons?domain=riotgames.com&sz=64',
    'Blizzard.BattleNet': 'https://www.google.com/s2/favicons?domain=battle.net&sz=64',
    'Mobalytics.Dropbox': 'https://www.google.com/s2/favicons?domain=mobalytics.gg&sz=64',
    'ProjectLightning.Dropbox': 'https://i.postimg.cc/Xvj1xKB3/d929685ba0bcef6866fe68a7fe44b237.png',
    
    // Development
    'Microsoft.VisualStudio.Professional': 'https://cdn.jsdelivr.net/gh/tandpfun/skill-icons@main/icons/VisualStudio-Dark.svg',
    'Microsoft.VisualStudioCode': 'https://cdn.jsdelivr.net/gh/tandpfun/skill-icons@main/icons/VSCode-Dark.svg',
    
    // Utilities
    'Guru3D.Afterburner': 'https://www.google.com/s2/favicons?domain=guru3d.com&sz=64'
  },

  // Publisher to domain mapping
  domainMap: {
    'google': 'google.com',
    'bitdefender': 'bitdefender.com',
    'brave': 'brave.com',
    'discord': 'discord.com',
    'dropbox': 'dropbox.com',
    'electronicarts': 'ea.com',
    'elgato': 'elgato.com',
    'epicgames': 'epicgames.com',
    'git': 'git-scm.com',
    'github': 'github.com',
    'nordsecurity': 'nordvpn.com',
    'mojang': 'minecraft.net',
    'vivaldi': 'vivaldi.com',
    'valve': 'steampowered.com',
    'playstation': 'playstation.com',
    'python': 'python.org',
    'microsoft': 'microsoft.com',
    'rarlab': 'win-rar.com',
    'razerinc': 'razer.com',
    'softdeluxe': 'freedownloadmanager.org',
    'spotify': 'spotify.com',
    'surfshark': 'surfshark.com',
    'zwylair': 'github.com',
    'proton': 'protonvpn.com',
    'openjs': 'nodejs.org',
    'mozilla': 'mozilla.org',
    '7zip': '7-zip.org',
    'vencord': 'vencord.dev',
    'obsproject': 'obsproject.com',
    'videolan': 'videolan.org',
    'oracle': 'oracle.com',
    'logitech': 'logitech.com',
    'notepadplusplus': 'notepad-plus-plus.org',
    'cpuid': 'cpuid.com',
    'crystaldew': 'crystalmark.info',
    'malwarebytes': 'malwarebytes.com',
    'teamviewer': 'teamviewer.com',
    'anydesk': 'anydesk.com',
    'betterdiscord': 'betterdiscord.app',
    'iobit': 'iobit.com',
    'blizzard': 'battle.net',
    'ubisoft': 'ubisoft.com',
    'guru3d': 'guru3d.com'
  },

  // Project/Adobe icons
  projectIcons: {
    'clipstudio': 'https://i.postimg.cc/HLrJgc2G/clipstudio.png',
    'mediaencoder': 'https://i.postimg.cc/tCGFN5zh/mediaencoder.png',
    'illustrator': 'https://i.postimg.cc/W1nm3kg2/illustrator.png',
    'lightroom': 'https://i.postimg.cc/K8rfMVSR/lightroom-classic.png',
    'office': 'https://i.postimg.cc/fb8JmWgm/office.png',
    'photoshop': 'https://i.postimg.cc/HnzW5d2w/photoshop.png',
    'premiere': 'https://i.postimg.cc/g2JjVX1j/premiere-pro.png'
  },

  /**
   * Get favicon URL for a package
   * @param {string} pkgId - Package ID (e.g., 'Discord.Discord')
   * @param {string} appName - App name fallback
   * @returns {string} Favicon URL
   */
  getFaviconUrl(pkgId, appName) {
    try {
      // Check custom icons first
      if (this.customIcons[pkgId]) {
        return this.customIcons[pkgId];
      }

      // Extract publisher from package ID
      const parts = String(pkgId).split('.');
      const publisher = (parts[0] || '').toLowerCase();

      // Get domain from map or construct from publisher
      const domain = this.domainMap[publisher] || `${publisher}.com`;

      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      const slug = String(appName || '').toLowerCase().replace(/\s+/g, '');
      return `https://www.google.com/s2/favicons?domain=${slug}.com&sz=64`;
    }
  },

  /**
   * Get all URLs that should be preloaded
   * @returns {string[]} Array of URLs to preload
   */
  getPreloadUrls() {
    const urls = new Set();

    // Add all custom icons
    Object.values(this.customIcons).forEach(url => urls.add(url));

    // Add all project icons
    Object.values(this.projectIcons).forEach(url => urls.add(url));

    // Add common favicon URLs from domain map
    Object.values(this.domainMap).forEach(domain => {
      if (!domain.startsWith('http')) {
        urls.add(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
      }
    });

    return Array.from(urls);
  }
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FaviconConfig;
}
if (typeof window !== 'undefined') {
  window.FaviconConfig = FaviconConfig;
}
