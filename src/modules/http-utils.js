
const http = require('http');
const https = require('https');

function clientFor(url) {
  return url.startsWith('https:') ? https : http;
}

module.exports = {
  clientFor
};
