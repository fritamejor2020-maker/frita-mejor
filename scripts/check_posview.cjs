const fs = require('fs');
const path = require('path');

const posViewPath = path.join(__dirname, '..', 'src', 'modules', 'pos', 'PosView.jsx');
let content = fs.readFileSync(posViewPath, 'utf8');

// Verificamos si ShiftCloseModal está presente
console.log('Longitud de PosView.jsx:', content.length);
