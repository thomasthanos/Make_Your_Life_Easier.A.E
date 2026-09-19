const fs = require('fs');
const path = require('path');

const dir = 'H:/Projects/ThomasThanos/Make_Your_Life_Easier.A.E/.github/assets';
const files = fs.readdirSync(dir);

for (const file of files) {
  if (file.startsWith('icon-') && file.endsWith('.svg')) {
    const p = path.join(dir, file);
    let content = fs.readFileSync(p, 'utf8');
    
    // Replace viewBox="0 0 48 58" with viewBox="0 0 48 48"
    content = content.replace(/viewBox="0 0 48 58"/g, 'viewBox="0 0 48 48"');
    // Replace height="58" with height="48"
    content = content.replace(/height="58"/g, 'height="48"');
    
    fs.writeFileSync(p, content, 'utf8');
    console.log('Fixed ' + file);
  }
}