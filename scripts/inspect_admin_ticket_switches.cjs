const fs = require('fs');
const path = require('path');

const tabPath = path.join(__dirname, '..', 'src', 'components', 'admin', 'AdminTicketConfigTab.tsx');
const content = fs.readFileSync(tabPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('zShow') || line.includes('zReport') || line.includes('zCustomTitle')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
