const fs = require('fs');
const path = require('path');

const posViewPath = path.join(__dirname, '..', 'src', 'modules', 'pos', 'PosView.jsx');
const content = fs.readFileSync(posViewPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('handleLoadSuspended') || line.includes('loadHeldSaleToCart') || line.includes('allHeldAndSuspended')) {
    console.log(`Línea ${idx + 1}: ${line}`);
  }
});
