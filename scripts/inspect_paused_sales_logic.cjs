const fs = require('fs');
const path = require('path');

const posStorePath = path.join(__dirname, '..', 'src', 'store', 'usePosStore.js');
const posStoreContent = fs.readFileSync(posStorePath, 'utf8');

const logStorePath = path.join(__dirname, '..', 'src', 'store', 'useLogisticsStore.js');
const logStoreContent = fs.readFileSync(logStorePath, 'utf8');

console.log('--- REVISANDO LÓGICA DE PAUSED SALES / PENDING REQUESTS ---');
console.log('usePosStore pending/paused:');
posStoreContent.split('\n').forEach((line, i) => {
  if (line.includes('pending') || line.includes('paused') || line.includes('remove') || line.includes('reject') || line.includes('delete')) {
    console.log(`PosStore L${i+1}: ${line}`);
  }
});

console.log('\nuseLogisticsStore pending/paused:');
logStoreContent.split('\n').forEach((line, i) => {
  if (line.includes('pending') || line.includes('paused') || line.includes('remove') || line.includes('reject') || line.includes('delete')) {
    console.log(`LogisticsStore L${i+1}: ${line}`);
  }
});
