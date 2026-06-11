const fs = require('fs');

let t = fs.readFileSync('src/components/Render.tsx', 'utf8');

// 1. Replace default state values
t = t.replace(/useState\('gemini-2.5-flash-image'\)/g, "useState('gemini-3.1-flash-image-preview')");

// 2. Replace hardcoded model references
t = t.replace(/suggestion\.selectedModel \|\| 'gemini-2.5-flash-image'/g, "suggestion.selectedModel || 'gemini-3.1-flash-image-preview'");
t = t.replace(/selectedModel: 'gemini-2.5-flash-image'/g, "selectedModel: 'gemini-3.1-flash-image-preview'");
t = t.replace(/getAIClient\('gemini-2.5-flash-image'\)/g, "getAIClient('gemini-3.1-flash-image-preview')");

// 3. Fix hardcoded select options
t = t.replace(/<option value="gemini-2.5-flash-image">iGen 2.5 Flash Image<\/option>\s*<option value="gemini-3.1-flash-image-preview">iGen 3.1 Flash Image Preview<\/option>\s*<option value="imagen-4.0-generate-001">iGen 4 Pro Imagen<\/option>/g, 
  `{MODELS.map(model => (
  <option key={model.id} value={model.id}>
    {model.name} {model.isPro ? '(Pro)' : ''}
  </option>
))}`);

// 4. Update the manual selection UI at line 9688
t = t.replace(/setSelectedModel\('gemini-2.5-flash-image'\)/g, "setSelectedModel('gemini-3.1-flash-image-preview')");
t = t.replace(/selectedModel === 'gemini-2.5-flash-image'/g, "selectedModel === 'gemini-3.1-flash-image-preview'");
t = t.replace(/Gemini 2.5 \(Flash\/Free\)/g, "Gemini 3.1 Flash Image Preview");

// Write back
fs.writeFileSync('src/components/Render.tsx', t, 'utf8');
console.log('Update script finished.');
