import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// History is in Profile 17/History
const historyPath = 'C:\\Users\\GIGABYTE\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 17\\History';
const scratchHistoryPath = path.resolve(__dirname, '../../History-copy-17');

try {
  const sourceStream = fs.createReadStream(historyPath);
  const destStream = fs.createWriteStream(scratchHistoryPath);
  sourceStream.pipe(destStream);
  
  destStream.on('finish', () => {
    console.log('Copia de History de Profile 17 finalizada.');
    const db = new sqlite3.Database(scratchHistoryPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('Error al abrir la base de datos:', err.message);
        return;
      }
      
      const query = `SELECT url, title, last_visit_time FROM urls WHERE url LIKE '%olaclick%' ORDER BY last_visit_time DESC LIMIT 20`;
      db.all(query, [], (err, rows) => {
        if (err) {
          console.error('Error en la consulta SQL:', err.message);
          return;
        }
        
        console.log('URLs de OlaClick en Profile 17:');
        rows.forEach(row => {
          console.log(`- ${row.url} (${row.title})`);
        });
        
        db.close();
        fs.unlinkSync(scratchHistoryPath);
      });
    });
  });
} catch (err) {
  console.error('Error:', err.message);
}
