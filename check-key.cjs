const fs = require('fs');
const envContent = fs.readFileSync('e:/Igen/Architect-Assistant/.env', 'utf8');
const lines = envContent.split('\n');
const piapiLine = lines.find(l => l.startsWith('PIAPI_API_KEY='));
console.log('Raw line:', JSON.stringify(piapiLine));
const rawVal = piapiLine.split('=').slice(1).join('=').trim();
console.log('Value chars:', [...rawVal].slice(0, 5).map(c => c.charCodeAt(0)));
// Remove surrounding quotes
const cleaned = rawVal.replace(/^["']|["']$/g, '');
console.log('Cleaned prefix:', cleaned.substring(0, 15));
console.log('Cleaned length:', cleaned.length);
