const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      searchDir(full);
    } else if (full.endsWith('.css') || full.endsWith('.jsx') || full.endsWith('.js') || full.endsWith('.html')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('app-region') || content.includes('-webkit-app-region') || content.includes('disable-features')) {
        console.log(full);
      }
    }
  }
}

searchDir(path.join(__dirname, '..', 'src'));
searchDir(path.join('C:', 'Users', 'GIGABYTE', 'Documents', 'Cajero-FritaMejor', 'resources', 'app'));
