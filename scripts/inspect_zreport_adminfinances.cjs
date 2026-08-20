const fs = require('fs');
const path = require('path');

const tabPath = path.join(__dirname, '..', 'src', 'components', 'admin', 'AdminFinancesTab.tsx');
const content = fs.readFileSync(tabPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('generateZReportHTML')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
