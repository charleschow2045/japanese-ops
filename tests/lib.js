// Shared bits for the browser tests (see tests/README.md).
//   BASE_URL  where the app is served (default http://localhost:5804; run.sh starts a server if nothing answers)
//   CHROMIUM  path to a Chromium binary (default /opt/pw-browsers/chromium if it exists, else Playwright's own)
//   OUT       folder for screenshots (argv[2] from run.sh, else the OS temp folder) — never the repo
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const path = require('path');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    return require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright'));
  }
}

exports.chromium = loadPlaywright().chromium;
exports.CHROME = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
exports.BASE = process.env.BASE_URL || 'http://localhost:5804';
exports.OUT = process.argv[2] || os.tmpdir();
exports.ROOT = path.join(__dirname, '..');
