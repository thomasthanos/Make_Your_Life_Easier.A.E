const fs = require('fs');
const path = require('path');

const dir = 'H:/Projects/ThomasThanos/Make_Your_Life_Easier.A.E/.github/assets';

function scaleSvg(filename, factor) {
  const p = path.join(dir, filename);
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  
  content = content.replace(/<svg([^>]+)>/, (match, p1) => {
    const viewBoxMatch = p1.match(/viewBox="0 0 ([\d\.]+) ([\d\.]+)"/);
    if (!viewBoxMatch) return match;
    const origW = parseFloat(viewBoxMatch[1]);
    const origH = parseFloat(viewBoxMatch[2]);
    
    const newW = Math.round(origW * factor);
    const newH = Math.round(origH * factor);
    
    let updated = p1.replace(/width="[\d\.]+"/, 'width="' + newW + '"');
    updated = updated.replace(/height="[\d\.]+"/, 'height="' + newH + '"');
    return '<svg' + updated + '>';
  });
  
  fs.writeFileSync(p, content, 'utf8');
  console.log('Scaled ' + filename + ' by ' + factor);
}

const files = fs.readdirSync(dir);

for (const file of files) {
  if (file.startsWith('btn-')) scaleSvg(file, 0.85);
  else if (file.startsWith('badge-')) scaleSvg(file, 0.90);
  else if (file === 'spec-myle.svg') scaleSvg(file, 0.85);
}