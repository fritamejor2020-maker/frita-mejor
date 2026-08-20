const fs = require('fs');
const path = require('path');

const finPath = path.join(__dirname, '..', 'src', 'components', 'admin', 'AdminFinancesTab.tsx');
const content = fs.readFileSync(finPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('closing._raw') || line.includes('setEditingClosing') || line.includes('generateZReportHTML')) {
    console.log(`Línea ${idx + 1}: ${line}`);
  }
});
