const fs = require('fs');
const path = require('path');

// 1x1 transparent PNG buffer as fallback
const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const dir = path.join(__dirname, '../electron');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'icon.png'), pngBuffer);
fs.writeFileSync(path.join(dir, 'default_icon.png'), pngBuffer);

console.log('✅ Created fallback Electron icons.');
