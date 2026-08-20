const fs = require('fs');
const path = require('path');

const mainPath = path.join('C:', 'Users', 'GIGABYTE', 'Documents', 'Cajero-FritaMejor', 'resources', 'app', 'main.js');
const content = fs.readFileSync(mainPath, 'utf8');
const lines = content.split('\n');

for (let i = 240; i < 330; i++) {
  if (lines[i]) console.log(`L${i + 1}: ${lines[i]}`);
}
