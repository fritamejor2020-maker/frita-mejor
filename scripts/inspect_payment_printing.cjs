const fs = require('fs');
const path = require('path');

const posViewPath = path.join(__dirname, '..', 'src', 'modules', 'pos', 'PosView.jsx');
const content = fs.readFileSync(posViewPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('handleProcessPayment') || line.includes('printTicket') || line.includes('openDrawer') || line.includes('printReceipt') || line.includes('silentPrint')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
