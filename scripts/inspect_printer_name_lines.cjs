const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('Impresora Principal') || line.includes('printerName')) {
      console.log(`${path.basename(filePath)} L${idx + 1}: ${line}`);
    }
  });
}

checkFile(path.join(__dirname, '..', 'src', 'modules', 'admin', 'AdminView.jsx'));
checkFile(path.join(__dirname, '..', 'src', 'components', 'admin', 'GlobalSettingsPanel.jsx'));
