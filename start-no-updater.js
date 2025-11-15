const { spawn } = require('child_process');
const env = { ...process.env, ELECTRON_NO_UPDATER: '1' };
const isWindows = process.platform === 'win32';
const electronCmd = isWindows ? 'electron.cmd' : 'electron';
const args = ['.'];
const child = spawn(electronCmd, args, {
  env,
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  process.exit(code);
});