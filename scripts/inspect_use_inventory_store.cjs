const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '..', 'src', 'store', 'useInventoryStore.js');
const content = fs.readFileSync(storePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('customerTypes') || line.includes('customers') || line.includes('fetchInitialData') || line.includes('onRehydrateStorage')) {
    console.log(`L${idx + 1}: ${line}`);
  }
});
