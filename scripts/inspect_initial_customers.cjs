const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '..', 'src', 'store', 'useInventoryStore.js');
const content = fs.readFileSync(storePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('INITIAL_CUSTOMER_TYPES') || line.includes('INITIAL_CUSTOMERS')) {
    console.log(`L${idx + 1}: ${line}`);
  }
});
