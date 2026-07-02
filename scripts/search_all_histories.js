import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userDataDir = 'C:\\Users\\GIGABYTE\\AppData\\Local\\Google\\Chrome\\User Data';
const scratchBase = 'C:\\Users\\GIGABYTE\\.gemini\\antigravity\\scratch';

function queryHistory(profile) {
  return new Promise((resolve) => {
    const historyPath = path.join(userDataDir, profile, 'History');
    if (!fs.existsSync(historyPath)) {
      resolve([]);
      return;
    }

    const scratchHistory = path.join(scratchBase, `History-${profile.replace(' ', '_')}`);
    try {
      fs.copyFileSync(historyPath, scratchHistory);
      
      const db = new sqlite3.Database(scratchHistory, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          try { fs.unlinkSync(scratchHistory); } catch(e){}
          resolve([]);
          return;
        }
        
        const query = `SELECT url, title, last_visit_time FROM urls WHERE url LIKE '%olaclick%' ORDER BY last_visit_time DESC LIMIT 5`;
        db.all(query, [], (err, rows) => {
          db.close();
          try { fs.unlinkSync(scratchHistory); } catch(e){}
          if (err) {
            resolve([]);
          } else {
            resolve(rows.map(r => ({ ...r, profile })));
          }
        });
      });
    } catch (e) {
      resolve([]);
    }
  });
}

async function run() {
  const files = fs.readdirSync(userDataDir);
  const profiles = files.filter(f => {
    const fullPath = path.join(userDataDir, f);
    return fs.statSync(fullPath).isDirectory() && (f === 'Default' || f.startsWith('Profile '));
  });

  console.log('Searching OlaClick history in all profiles...');
  const allResults = [];
  for (const profile of profiles) {
    const results = await queryHistory(profile);
    allResults.push(...results);
  }

  // Sort all results by last_visit_time descending
  allResults.sort((a, b) => b.last_visit_time - a.last_visit_time);

  console.log('\n--- RESULTS FOUND ---');
  allResults.forEach(r => {
    console.log(`[${r.profile}] ${r.url} (${r.title})`);
  });
}

run().catch(err => console.error(err));
