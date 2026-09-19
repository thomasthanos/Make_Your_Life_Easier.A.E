const fs = require('fs');
const path = require('path');

const dir = 'H:/Projects/ThomasThanos/Make_Your_Life_Easier.A.E/.github/assets';
const files = fs.readdirSync(dir);

for (const file of files) {
  if (file.startsWith('icon-') && file.endsWith('.svg')) {
    const p = path.join(dir, file);
    let content = fs.readFileSync(p, 'utf8');
    
    // Replace viewBox="0 0 48 48" with viewBox="0 0 48 56"
    content = content.replace(/viewBox="0 0 48 48"/g, 'viewBox="0 0 48 56"');
    // Replace height="48" with height="56"
    content = content.replace(/height="48"/g, 'height="56"');
    
    fs.writeFileSync(p, content, 'utf8');
    console.log('Restored padding hack in ' + file);
  }
}