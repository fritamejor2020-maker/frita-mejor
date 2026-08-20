const fs = require('fs');
const path = require('path');

function check(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('Cierres Caja') || line.includes('Conciliación de Cierres') || line.includes('z-history') || line.includes('shifts')) {
      console.log(`${path.basename(filePath)} L${idx + 1}: ${line.slice(0, 120)}`);
    }
  });
}

check(path.join(__dirname, '..', 'src', 'modules', 'admin', 'AdminView.jsx'));
check(path.join(__dirname, '..', 'src', 'components', 'admin', 'AdminFinancesTab.tsx'));
