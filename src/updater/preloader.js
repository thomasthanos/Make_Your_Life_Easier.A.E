/**
 * Asset Preloader
 * Preloads favicons and images during updater phase
 * Uses FaviconConfig for centralized icon management
 */

(function() {
  'use strict';

  // Wait for FaviconConfig to be available
  if (typeof FaviconConfig === 'undefined') {
    console.warn('FaviconConfig not loaded, skipping preload');
    return;
  }

  const PreloadManager = {
    loaded: 0,
    failed: 0,
    total: 0,
    urls: [],

    /**
     * Initialize and start preloading
     */
    init() {
      this.urls = FaviconConfig.getPreloadUrls();
      this.total = this.urls.length;
      
      // Start preloading with staggered requests
      this.preloadWithDelay();
    },

    /**
     * Preload images with delay between requests
     * Prevents network congestion
     */
    preloadWithDelay() {
      let index = 0;
      const batchSize = 5; // Load 5 images at a time
      const delayBetweenBatches = 100; // 100ms between batches

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

      // Start after small delay to prioritize main UI
      setTimeout(loadBatch, 150);
    },

    /**
     * Preload a single image
     * @param {string} url - Image URL to preload
     */
    preloadImage(url) {
      const img = new Image();
      
      img.onload = () => {
        this.loaded++;
      };

      img.onerror = () => {
        this.failed++;
      };

      // Set crossOrigin for CORS-enabled resources
      if (url.includes('jsdelivr') || url.includes('postimg')) {
        img.crossOrigin = 'anonymous';
      }

      img.src = url;
    }
  };

  // Start preloading
  PreloadManager.init();
})();
