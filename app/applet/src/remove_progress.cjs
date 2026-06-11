const fs = require('fs');
let content = fs.readFileSync('src/components/Render.tsx', 'utf8');

content = content.replace(/\{isGeneratingPrompt && \(\s*<div\s*className="absolute left-0 top-0 bottom-0 bg-white\/20 transition-all duration-100 ease-linear"\s*style=\{\{ width: `\$\{Math\.min\(100, smoothPromptProgress\)\}%` \}\}\s*><\/div>\s*\)\}/g, '');

content = content.replace(/<span className="font-bold text-base">\{Math\.floor\(Math\.min\(100, smoothPromptProgress\)\)\}%<\/span>/g, '');

content = content.replace(/<span>Đang xử lý \(\{Math\.round\(smoothRenderProgress\)\}%\)\.\.\.<\/span>/g, '<span>Đang xử lý...</span>');

content = content.replace(/<span className="text-xl font-bold text-primary">\{Math\.round\(smoothRenderProgress\)\}%<\/span>/g, '');

content = content.replace(/<circle className="text-primary stroke-current transition-all duration-300 ease-out"\s*strokeWidth="8"\s*strokeLinecap="round"\s*cx="50"\s*cy="50"\s*r="40"\s*fill="transparent"\s*strokeDasharray=\{`\$\{2 \* Math\.PI \* 40\}`\}\s*strokeDashoffset=\{`\$\{2 \* Math\.PI \* 40 \* \(1 - smoothRenderProgress \/ 100\)\}`\}\s*><\/circle>/g, '<circle className="text-primary stroke-current animate-spin origin-center" strokeWidth="8" strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent" strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * 0.25}`}></circle>');

content = content.replace(/<circle className="text-white stroke-current transition-all duration-300 ease-out"\s*strokeWidth="8"\s*strokeLinecap="round"\s*cx="50"\s*cy="50"\s*r="40"\s*fill="transparent"\s*strokeDasharray=\{`\$\{2 \* Math\.PI \* 40\}`\}\s*strokeDashoffset=\{`\$\{2 \* Math\.PI \* 40 \* \(1 - smoothRenderProgress \/ 100\)\}`\}\s*><\/circle>/g, '<circle className="text-white stroke-current animate-spin origin-center" strokeWidth="8" strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent" strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * 0.25}`}></circle>');

fs.writeFileSync('src/components/Render.tsx', content);
