const fs = require('fs');
const content = fs.readFileSync('src/components/Render.tsx', 'utf8');

const updated = content.replace(/<select\s+className="([^"]+)"/g, (match, classes) => {
  let classList = classes.split(/\s+/);
  
  const toAdd = ['pr-10', 'text-ellipsis', 'overflow-hidden', 'whitespace-nowrap'];
  
  toAdd.forEach(cls => {
    if (!classList.includes(cls)) {
      classList.push(cls);
    }
  });
  
  return `<select \n                    className="${classList.join(' ')}"`;
});

fs.writeFileSync('src/components/Render.tsx', updated);
console.log('Done');
