const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, '..', 'src', 'lib', 'supabaseClient.js');
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(clientPath)) console.log(fs.readFileSync(clientPath, 'utf8'));
if (fs.existsSync(envPath)) console.log(fs.readFileSync(envPath, 'utf8'));
