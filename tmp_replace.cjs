const fs = require('fs');

let content = fs.readFileSync('src/components/Render.tsx', 'utf8');

const target = `                <div className="relative w-full h-full group">
                  <img src={resultImage} alt="Result" className="w-full h-full object-contain" />
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={handleDownloadResult}
                      className="w-10 h-10 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors shadow-lg"
                      title="Tải xuống"
                    >
                      <Icon name="download" className="text-[20px]" />
                    </button>`;

const replacement = `                <div className="relative w-full h-full group">
                  <img src={resultImage} alt="Result" className="w-full h-full object-contain cursor-zoom-in" onClick={() => setFullscreenImage(resultImage)} />
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setFullscreenImage(resultImage)}
                      className="w-10 h-10 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors shadow-lg"
                      title="Phóng to"
                    >
                      <Icon name="zoom_in" className="text-[20px]" />
                    </button>
                    <button 
                      onClick={handleDownloadResult}
                      className="w-10 h-10 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors shadow-lg"
                      title="Tải xuống"
                    >
                      <Icon name="download" className="text-[20px]" />
                    </button>
                    <button 
                      onClick={handleDeleteResult}
                      className="w-10 h-10 bg-error/80 hover:bg-error backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors shadow-lg"
                      title="Xoá ảnh"
                    >
                      <Icon name="delete" className="text-[20px]" />
                    </button>`;

content = content.split(target).join(replacement);

fs.writeFileSync('src/components/Render.tsx', content);
console.log('Replaced all occurrences successfully.');
