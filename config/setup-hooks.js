'use strict';

const { execSync } = require('node:child_process');

try {
  execSync('git config core.hooksPath config/hooks', { stdio: 'ignore' });
} catch {}
