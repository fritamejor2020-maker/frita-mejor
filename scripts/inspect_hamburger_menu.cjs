const fs = require('fs');
const path = require('path');

const posViewPath = path.join(__dirname, '..', 'src', 'modules', 'pos', 'PosView.jsx');
const content = fs.readFileSync(posViewPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('hamburguesa') || line.includes('showMenu') || line.includes('setShowMenu') || line.includes('Menu') || line.includes('svg')) {
    if (line.includes('Menu') || line.includes('menu')) {
      console.log(`Línea ${idx + 1}: ${line.slice(0, 100)}`);
    }
  }
});
