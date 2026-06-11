const fs = require('fs');

let t = fs.readFileSync('src/components/Render.tsx', 'utf8');

// Update RESOLUTIONS
t = t.replace(/{\s*id:\s*'4K',\s*name:\s*'4K Ultra HD'\s*},?/g, '');

// Remove standard 4K options
t = t.replace(/<option value="4K">.*?<\/option>\n?/g, '');

fs.writeFileSync('src/components/Render.tsx', t, 'utf8');
console.log('Removed 4K from Render.tsx');
