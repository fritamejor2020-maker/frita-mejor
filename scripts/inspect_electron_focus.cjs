const fs = require('fs');
const path = require('path');

const mainPath = path.join('C:', 'Users', 'GIGABYTE', 'Documents', 'Cajero-FritaMejor', 'resources', 'app', 'main.js');
const content = fs.readFileSync(mainPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('focus') || line.includes('BrowserWindow') || line.includes('blur') || line.includes('input') || line.includes('alwaysOnTop')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
