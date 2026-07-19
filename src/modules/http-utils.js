/**
 * HTTP Utilities Module
 * Provides helpers for HTTP requests
 */

const http = require('http');
const https = require('https');

/**
 * Get the appropriate HTTP client for a URL
 * @param {string} url - The URL to check
 * @returns {Object} - http or https module
 */
function clientFor(url) {
  return url.startsWith('https:') ? https : http;
}

module.exports = {
  clientFor
};
