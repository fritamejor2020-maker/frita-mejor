const fs = require('fs');
const path = require('path');

const posReceiptPath = path.join(__dirname, '..', 'src', 'modules', 'pos', 'PosReceipt.jsx');
const zReceiptPath = path.join(__dirname, '..', 'src', 'modules', 'pos', 'ZReportReceipt.jsx');

function findEmojis(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Regex to match emojis
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;
  const matches = content.match(emojiRegex) || [];
  console.log(`Emojis encontrados en ${path.basename(filePath)} (${matches.length}):`, [...new Set(matches)]);
}

findEmojis(posReceiptPath);
findEmojis(zReceiptPath);
