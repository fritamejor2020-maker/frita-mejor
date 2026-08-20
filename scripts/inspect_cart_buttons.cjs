const fs = require('fs');
const path = require('path');

const posPath = path.join(__dirname, '..', 'src', 'modules', 'pos', 'PosView.jsx');
const content = fs.readFileSync(posPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('EFECTIVO') || line.includes('IMPRIMIR') || line.includes('CONTRATA') || line.includes('paymentMethods') || line.includes('payment') || line.includes('PM-')) {
    console.log(`L${idx + 1}: ${line}`);
  }
});
