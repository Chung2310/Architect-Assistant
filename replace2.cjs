const fs = require('fs');

let content = fs.readFileSync('src/components/Render.tsx', 'utf8');

content = content.replace(
  /new Promise<string>\(\(resolve, reject\) => {/g,
  `new Promise<string>(async (resolve, reject) => {`
);

content = content.replace(
  /new Promise<void>\(\(resolve, reject\) => {/g,
  `new Promise<void>(async (resolve, reject) => {`
);

fs.writeFileSync('src/components/Render.tsx', content);
console.log('Fixed async promises.');
