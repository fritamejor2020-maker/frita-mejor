const fs = require('fs');
const path = require('path');

const syncPath = path.join(__dirname, '..', 'src', 'lib', 'syncManager.js');
const content = fs.readFileSync(syncPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('pullAll') || line.includes('customerTypes') || line.includes('customers')) {
    console.log(`L${idx + 1}: ${line}`);
  }
});
