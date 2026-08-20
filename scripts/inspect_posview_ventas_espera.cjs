const fs = require('fs');
const path = require('path');

const posViewPath = path.join(__dirname, '..', 'src', 'modules', 'pos', 'PosView.jsx');
const content = fs.readFileSync(posViewPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Ventas en Espera') || line.includes('heldSales') || line.includes('deleteHeldSale') || line.includes('pausadas') || line.includes('422918') || line.includes('561060')) {
    console.log(`Línea ${idx + 1}: ${line}`);
  }
});
