const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      searchDir(full, pattern);
    } else if (f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.tsx')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes(pattern)) {
        console.log(`FOUND in: ${full}`);
      }
    }
  }
}

console.log('--- Searching for "attendance_logs" ---');
searchDir('C:\\Users\\GIGABYTE\\.gemini\\antigravity\\scratch\\frita_mejor\\src', 'attendance_logs');

console.log('\n--- Searching for "Sincronizar Biométrico" ---');
searchDir('C:\\Users\\GIGABYTE\\.gemini\\antigravity\\scratch\\frita_mejor\\src', 'Sincronizar Biométrico');
