const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...searchDir(fullPath, pattern));
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (pattern.test(content)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const srcDir = path.join(__dirname, '..', 'src');
console.log('--- BUSCANDO CIERRE Z Y MANEJO DE TICKETS / CONTRATAS ---');
console.log('Archivos con "cierre" o "ZReport" o "contrata":');
const matches = searchDir(srcDir, /cierre|zreport|contrata|ticket|imprimir/i);
matches.forEach(m => console.log(' -', m));
