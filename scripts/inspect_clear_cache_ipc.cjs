const fs = require('fs');
const path = require('path');

const mainPath = path.join('C:', 'Users', 'GIGABYTE', 'Documents', 'Cajero-FritaMejor', 'resources', 'app', 'main.js');
const content = fs.readFileSync(mainPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('clear-cache') || line.includes('clearCache') || line.includes('session.defaultSession')) {
    console.log(`L${idx + 1}: ${line}`);
  }
});
