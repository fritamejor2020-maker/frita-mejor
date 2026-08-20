const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      searchDir(full);
    } else if (full.endsWith('.jsx') || full.endsWith('.tsx') || full.endsWith('.js') || full.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('updatePosSettings')) {
        console.log(full);
      }
    }
  }
}

searchDir(path.join(__dirname, '..', 'src'));
