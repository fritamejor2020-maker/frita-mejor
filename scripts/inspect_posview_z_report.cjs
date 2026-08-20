const fs = require('fs');
const path = require('path');

const posViewPath = path.join(__dirname, '..', 'src', 'modules', 'pos', 'PosView.jsx');
const content = fs.readFileSync(posViewPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('ZReport') || line.includes('generateZReport') || line.includes('cierre') || line.includes('Cierre')) {
    console.log(`Línea ${idx + 1}: ${line}`);
  }
});
