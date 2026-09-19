const fs = require('fs');
const path = require('path');

const dir = 'H:/Projects/ThomasThanos/Make_Your_Life_Easier.A.E/.github/assets';
const files = fs.readdirSync(dir);

for (const file of files) {
  if (file.startsWith('icon-') && file.endsWith('.svg')) {
    const p = path.join(dir, file);
    let content = fs.readFileSync(p, 'utf8');
    
    // Replace viewBox="0 0 48 64" with viewBox="0 0 48 72"
    content = content.replace(/viewBox="0 0 48 \d+"/g, 'viewBox="0 0 48 72"');
    // Replace height="64" with height="72"
    content = content.replace(/height="\d+"/g, 'height="72"');
    
    fs.writeFileSync(p, content, 'utf8');
    console.log('Fixed padding to 72 in ' + file);
  }
}