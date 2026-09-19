const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');
const version = packageJson.version;

const bannerPath = path.join(__dirname, '../.github/assets/banner-myle.svg');
let svgContent = fs.readFileSync(bannerPath, 'utf8');

// Replace the version string vX.X.X with the new version
svgContent = svgContent.replace(/>v\d+\.\d+\.\d+</, '>v' + version + '<');

fs.writeFileSync(bannerPath, svgContent);
console.log('Updated banner SVG to version v' + version);