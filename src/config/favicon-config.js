/**
 * Favicon Configuration
 * Central source of truth for all app icons/favicons
 * Used by renderer pages when displaying application icons
 */

/**
 * Google's favicon service.
 *
 * The legacy entry point (`www.google.com/s2/favicons?domain=…`) answers every
 * request with a 301 to this endpoint, so calling it directly is worth doing:
 *   - one round-trip per icon instead of two, on one host instead of two;
 *   - the images are cacheable for 7 days, while the redirect itself was only
 *     cacheable for 30 minutes, so the whole list re-fetched twice an hour;
 *   - an unresolvable domain returns 404 here, but 200 plus a generic grey globe
 *     on the legacy endpoint. That globe is why unknown apps used to show a
 *     placeholder image the <img> error handler could never catch — the request
 *     had succeeded, so onerror never fired.
 * A bare domain is expanded with `http://` rather than `https://` because that is
 * the exact key Google's index is built on — it is what the legacy endpoint puts
 * in its own redirect. Using `https://` here misses on a fair number of sites
 * (revouninstaller.com and the softonic mirrors among them) and 404s. The lookup
 * scheme says nothing about our own transport: the image itself is always fetched
 * over HTTPS from t2.gstatic.com.
 * @param {string} domainOrUrl - Bare domain ("discord.com") or a full URL
 * @param {number} size - Requested icon size in pixels
 * @returns {string} Favicon service URL
 */
function faviconUrl(domainOrUrl, size = 64) {
  const target = /^https?:\/\//i.test(domainOrUrl) ? domainOrUrl : `http://${domainOrUrl}`;
  return 'https://t2.gstatic.com/faviconV2'
    + '?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL'
    + `&url=${encodeURIComponent(target)}&size=${size}`;
}

const FaviconConfig = {
  /** Host the favicon service lives on — preconnected from index.html. */
  faviconHost: 'https://t2.gstatic.com',

  faviconUrl,

  // Custom icons mapped by package ID
  customIcons: {
    // IObit apps
    'IObit.Uninstaller': faviconUrl('iobit-uninstaller.en.softonic.com'),
    'IObit.AdvancedSystemCare': faviconUrl('advanced-systemcare.en.softonic.com'),
    'IObit.SmartDefrag': faviconUrl('smart-defrag.en.softonic.com'),
    'IObit.IObitSysInfo': 'https://i.postimg.cc/tC6TkWFV/isf-icon-big.png',
    'IObit.IObitSoftwareUpdater': faviconUrl('iobit-software-updater.en.softonic.com'),
    'IObit.DriverBooster': faviconUrl('driver-booster-free.en.softonic.com'),
    'IObit.MalwareFighter': faviconUrl('iobit-malware-fighter.en.softonic.com'),

    // Gaming
    'LeagueOfLegends.Dropbox': faviconUrl('riotgames.com'),
    'Blizzard.BattleNet': faviconUrl('battle.net'),
    'Mobalytics.Dropbox': faviconUrl('mobalytics.gg'),
    'ProjectLightning.Dropbox': 'https://i.postimg.cc/Xvj1xKB3/d929685ba0bcef6866fe68a7fe44b237.png',
    'Ubisoft.Connect': faviconUrl('https://www.ubisoft.com/en-us/game/assassins-creed/syndicate'),
    'PlayStation.PSRemotePlay': 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/master/png/playstation.png',
    'PlayStation.PSPlus': 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/master/png/playstation.png',

    // Proton
    'Proton.ProtonVPN': 'https://pmecdn.protonweb.com/image-transformation/?s=c&image=image%2Fupload%2Fstatic%2Flogos%2Ficons%2Fp-white-no-shadow_iwycfj.svg',
    'Proton.ProtonDrive': 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/proton-drive.png',
    'Proton.ProtonMail': 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/proton-mail.png',
    'Proton.ProtonAuthenticator': 'https://pmecdn.protonweb.com/image-transformation/?s=c&image=image%2Fupload%2Fstatic%2Flogos%2Ficons%2Fauthenticator.svg',
    'Proton.Proton Authenticator': 'https://pmecdn.protonweb.com/image-transformation/?s=c&image=image%2Fupload%2Fstatic%2Flogos%2Ficons%2Fauthenticator.svg',

    // AI Tools
    'Anthropic.Claude': faviconUrl('claude.ai', 128),

    // Development
    'Microsoft.VisualStudio.Professional': 'https://cdn.jsdelivr.net/gh/tandpfun/skill-icons@main/icons/VisualStudio-Dark.svg',
    'Microsoft.VisualStudioCode': 'https://cdn.jsdelivr.net/gh/tandpfun/skill-icons@main/icons/VSCode-Dark.svg',

    // Utilities
    // 7-Zip and AMD only publish a 16px favicon, which is a blurry smudge once the
    // grid scales it to 26-64px — use a real icon asset for those two instead.
    '7zip.7zip': 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/7zip.png',
    'AMD.AdrenalinSoftware': 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/amd.png',
    'Guru3D.Afterburner': faviconUrl('msi.com', 128),
    'Guru3D.RTSS': 'https://i.postimg.cc/gjqsBrHH/RTS-Radio-Television-Suisse.png',
    'CPUID.CPU-Z': faviconUrl('cpuid.com', 128),
    'CPUID.HWMonitor': faviconUrl('cpuid.com', 128),
    'TechPowerUp.GPU-Z': faviconUrl('techpowerup.com', 128),
    'REALiX.HWiNFO': faviconUrl('hwinfo.com', 128),
    'CrystalDewWorld.CrystalDiskInfo': 'https://i.postimg.cc/wBCkqDWL/Crystal-Disk-Info.png',
    'Oracle.VirtualBox': faviconUrl('virtualbox.org', 128),
    'BlenderFoundation.Blender': faviconUrl('blender.org', 128),
    'Notepad++.Notepad++': faviconUrl('notepad-plus-plus.org', 128),
    'FlorianHeidenreich.Mp3tag': faviconUrl('mp3tag.de', 128),
    'Rufus.Rufus': faviconUrl('rufus.ie', 128),
    'Ventoy.Ventoy': faviconUrl('ventoy.net', 128),
    'RevoUninstaller.RevoUninstaller': faviconUrl('revouninstaller.com', 128),
    'AnyDesk.AnyDesk': faviconUrl('anydesk.com', 128),
    'Stremio.Stremio': faviconUrl('stremio.com', 128),
    'Apple.iTunes': faviconUrl('apple.com', 128),
    'Malwarebytes.Malwarebytes': faviconUrl('malwarebytes.com', 128),

    // Security - NordPass needs its own icon, the nordsecurity domainMap points at NordVPN
    'NordSecurity.NordPass': faviconUrl('nordpass.com', 128),

    // Google
    'Google.GoogleDrive': faviconUrl('https://drive.google.com/drive/my-drive', 128),
    'Google.Chrome': faviconUrl('https://www.google.com/chrome/', 128)
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
    'playstation': 'blog.playstation.com',
    'python': 'python.org',
    'microsoft': 'microsoft.com',
    'rarlab': 'win-rar.com',
    'razerinc': 'razer.com',
    'softdeluxe': 'freedownloadmanager.org',
    'spotify': 'spotify.com',
    'surfshark': 'surfshark.com',
    'zwylair': 'github.com',
    'proton': 'proton.me',
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
    'bluestack': 'bluestacks.com',
    'ubisoft': 'ubisoft.com',
    'guru3d': 'guru3d.com',
    'advancedinstaller': 'advancedinstaller.com',
    'amd': 'amd.com',
    'nvidia': 'nvidia.com',
    'cursor': 'cursor.com',
    'anthropic': 'claude.ai',
    'techpowerup': 'techpowerup.com',
    'realix': 'hwinfo.com',
    'blenderfoundation': 'blender.org',
    'florianheidenreich': 'mp3tag.de',
    'rufus': 'rufus.ie',
    'ventoy': 'ventoy.net',
    'revouninstaller': 'revouninstaller.com',
    'stremio': 'stremio.com',
    'apple': 'apple.com',
    'crystaldewworld': 'crystalmark.info',
    'mobalytics': 'mobalytics.gg',
    'leagueoflegends': 'riotgames.com'
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

      return faviconUrl(domain);
    } catch {
      const slug = String(appName || '').toLowerCase().replace(/\s+/g, '');
      return faviconUrl(`${slug}.com`);
    }
  }
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FaviconConfig;
}
if (typeof window !== 'undefined') {
  window.FaviconConfig = FaviconConfig;
}
