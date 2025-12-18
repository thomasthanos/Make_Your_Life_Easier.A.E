/**
 * App Preloader
 * Preloads favicons and images when the main app starts
 * Runs after updater phase completes
 */

(function() {
  'use strict';

  // Wait for FaviconConfig to be available
  if (typeof FaviconConfig === 'undefined') {
    console.warn('FaviconConfig not loaded, skipping app preload');
    return;
  }

  const AppPreloader = {
    loaded: 0,
    failed: 0,
    total: 0,
    urls: [],

    /**
     * Initialize and start preloading
     */
    init() {
      // ===== PRELOAD VERSION IMMEDIATELY =====
      // Load version before anything else to avoid "v0.0.0" placeholder
      this.preloadVersion();
      
      // Get URLs from FaviconConfig
      this.urls = FaviconConfig.getPreloadUrls();
      
      // Add local assets that are used in the app
      this.addLocalAssets();
      
      this.total = this.urls.length;
      
      // Start preloading with delay to not block initial render
      setTimeout(() => {
        this.preloadWithDelay();
      }, 500);
    },

    /**
     * Preload app version immediately
     * Sets the version in the sidebar as soon as possible
     */
    async preloadVersion() {
      try {
        const versionEl = document.getElementById('appVersion');
        if (!versionEl) return;
        
        // Check if window.api is available
        if (window.api && typeof window.api.getAppVersion === 'function') {
          const version = await window.api.getAppVersion();
          if (version) {
            versionEl.textContent = `v${version}`;
          }
        }
      } catch (err) {
        console.warn('[AppPreloader] Failed to preload version:', err);
      }
    },

    /**
     * Add local assets used in the app
     */
    addLocalAssets() {
      const localAssets = [
        'src/assets/icons/hacker.ico',
        'src/assets/images/sims.png'
      ];
      
      localAssets.forEach(path => {
        if (!this.urls.includes(path)) {
          this.urls.push(path);
        }
      });
    },

    /**
     * Preload images with delay between batches
     */
    preloadWithDelay() {
      let index = 0;
      const batchSize = 10; // Load 10 images at a time
      const delayBetweenBatches = 50; // 50ms between batches

      const loadBatch = () => {
        const batch = this.urls.slice(index, index + batchSize);
        
        batch.forEach(url => {
          this.preloadImage(url);
        });

        index += batchSize;

        if (index < this.urls.length) {
          setTimeout(loadBatch, delayBetweenBatches);
        }
      };

      loadBatch();
    },

    /**
     * Preload a single image
     * @param {string} url - Image URL to preload
     */
    preloadImage(url) {
      const img = new Image();
      
      img.onload = () => {
        this.loaded++;
        this.checkComplete();
      };
      
      img.onerror = () => {
        this.failed++;
        this.checkComplete();
      };

      // Set crossOrigin for CORS-enabled resources
      if (url.includes('jsdelivr') || url.includes('postimg') || url.includes('google.com/s2/favicons')) {
        img.crossOrigin = 'anonymous';
      }

      img.src = url;
    },

    /**
     * Check if preloading is complete
     */
    checkComplete() {
      const completed = this.loaded + this.failed;
      if (completed === this.total) {
        console.log(`[AppPreloader] Complete: ${this.loaded}/${this.total} loaded, ${this.failed} failed`);
        
        // Notify that preloading is done
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app-preload-complete', {
            detail: { loaded: this.loaded, failed: this.failed, total: this.total }
          }));
        }
      }
    }
  };

  // Start preloading when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AppPreloader.init());
  } else {
    AppPreloader.init();
  }

  // Export for debugging
  if (typeof window !== 'undefined') {
    window.AppPreloader = AppPreloader;
  }
})();
