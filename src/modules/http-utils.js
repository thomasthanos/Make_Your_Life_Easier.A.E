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

/**
 * POST form data to a URL
 * @param {string} url - The URL to post to
 * @param {Object} params - Form parameters
 * @returns {Promise<Object>} - JSON response
 */
function postForm(url, params) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(params).toString();
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(json.error_description || json.error || body));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    
    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

/**
 * GET JSON from a URL
 * @param {string} url - The URL to fetch
 * @param {Object} headers - Request headers
 * @returns {Promise<Object>} - JSON response
 */
function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'GET',
      headers
    };
    
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(json.error || body));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    
    req.on('error', (err) => reject(err));
    req.end();
  });
}


module.exports = {
  clientFor,
  postForm,
  getJson
};
