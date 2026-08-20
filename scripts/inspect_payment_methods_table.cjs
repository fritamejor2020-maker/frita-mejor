const fs = require('fs');
const path = require('path');

const adminViewPath = path.join(__dirname, '..', 'src', 'modules', 'admin', 'AdminView.jsx');
const content = fs.readFileSync(adminViewPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Hardware y Métodos') || line.includes('Añadir Método') || line.includes('opensDrawer') || line.includes('printTicket')) {
    console.log(`Línea ${idx + 1}: ${line}`);
  }
});
