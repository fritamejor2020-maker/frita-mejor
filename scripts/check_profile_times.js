import fs from 'fs';
import path from 'path';

const userDataDir = 'C:\\Users\\GIGABYTE\\AppData\\Local\\Google\\Chrome\\User Data';

try {
  const files = fs.readdirSync(userDataDir);
  const profiles = files.filter(f => {
    const fullPath = path.join(userDataDir, f);
    const isDir = fs.statSync(fullPath).isDirectory();
    return isDir && (f === 'Default' || f.startsWith('Profile '));
  });

  const profileStats = [];
  for (const profile of profiles) {
    const prefPath = path.join(userDataDir, profile, 'Preferences');
    if (fs.existsSync(prefPath)) {
      const stat = fs.statSync(prefPath);
      profileStats.push({
        profile,
        mtime: stat.mtime
      });
    }
  }

  // Sort by modification time descending
  profileStats.sort((a, b) => b.mtime - a.mtime);
  console.log('Profiles sorted by last modification time:');
  profileStats.forEach(p => {
    console.log(`- ${p.profile}: ${p.mtime.toISOString()}`);
  });

} catch (err) {
  console.error('Error:', err.message);
}
