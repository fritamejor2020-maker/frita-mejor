const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...searchDir(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('generateZReportHTML') || content.includes('ZReportReceipt') || content.includes('printZReport')) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const srcDir = path.join(__dirname, '..', 'src');
console.log('Archivos que usan generateZReportHTML o ZReportReceipt:');
searchDir(srcDir).forEach(f => console.log(' -', f));
