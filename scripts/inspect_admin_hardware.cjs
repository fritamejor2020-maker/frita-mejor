const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'modules', 'admin', 'AdminView.jsx');
const content = fs.readFileSync(adminPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('paymentMethods') || line.includes('openDrawer') || line.includes('printReceipt') || line.includes('isTransfer') || line.includes('Abre Cajón')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
