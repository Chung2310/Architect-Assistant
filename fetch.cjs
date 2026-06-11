const http = require('http');

http.get('http://localhost:3000/src/components/Render.tsx', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data.substring(0, 500));
    const fs = require('fs');
    fs.writeFileSync('recovered.tsx', data);
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
