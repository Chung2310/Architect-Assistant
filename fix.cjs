const fs = require('fs');
let content = fs.readFileSync('src/components/Render.tsx', 'utf8');
content = content.replace(/const handleDownloadImage = async \(url: string, filename: string\) => \{\n    try \{\n      const imageData = await getImageBase64\(url, true\);/g, 'const handleDownloadImage = async (url: string, filename: string) => {\n    try {\n      const imageData = await getImageBase64(url, false);');
fs.writeFileSync('src/components/Render.tsx', content);
