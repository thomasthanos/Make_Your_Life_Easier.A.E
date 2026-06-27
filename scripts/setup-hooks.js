'use strict';

const { execSync } = require('node:child_process');

try {
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
} catch {}
