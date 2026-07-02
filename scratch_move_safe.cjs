const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'render', 'FloorPlan3DViewer.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = `  // ── Draw helper to compile floorplan meshes ──────────────────────────────`;
const startIndex = content.indexOf(startMarker);
const endMarker = `  const handleZoomIn = () => {`;
const endIndex = content.indexOf(endMarker);

let draw3DSceneBlock = content.substring(startIndex, endIndex);
content = content.substring(0, startIndex) + content.substring(endIndex);

draw3DSceneBlock = draw3DSceneBlock.replace(
  /draw3DScene\s*=\s*function\s*\(/g,
  'function draw3DScene('
);

const refMarker = `  const cubeRenderTargetRef = useRef<THREE.WebGLCubeRenderTarget | null>(null);`;
const refIndex = content.indexOf(refMarker);
const insertIndex = refIndex + refMarker.length;

content = content.substring(0, insertIndex) + '\n\n' + draw3DSceneBlock.trim() + '\n\n' + content.substring(insertIndex);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Refactored to test");
