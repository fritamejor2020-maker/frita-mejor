const fs = require('fs');
const path = require('path');

const invPath = path.join(__dirname, '..', 'src', 'store', 'useInventoryStore.js');
const content = fs.readFileSync(invPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('deletePosSale') || line.includes('deletedPosSaleIds') || line.includes('heldSales')) {
    console.log(`Línea ${idx + 1}: ${line}`);
  }
});
