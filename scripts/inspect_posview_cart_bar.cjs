const fs = require('fs');
const path = require('path');

const posPath = path.join(__dirname, '..', 'src', 'modules', 'pos', 'PosView.jsx');
const content = fs.readFileSync(posPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('usePosStore')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
