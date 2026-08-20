const fs = require('fs');
const path = require('path');

const mainPath = path.join('C:', 'Users', 'GIGABYTE', 'Documents', 'Cajero-FritaMejor', 'resources', 'app', 'main.js');
const content = fs.readFileSync(mainPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('loadURL') || line.includes('loadFile') || line.includes('dist') || line.includes('http')) {
    console.log(`L${idx + 1}: ${line}`);
  }
});
