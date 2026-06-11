import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const convertPdfToImage = async (file: File): Promise<File[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const imageFiles: File[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      
      // Use a higher scale for better resolution
      const viewport = page.getViewport({ scale: 2.0 }); 
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error("Could not get canvas context");
      }
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // @ts-ignore
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      
      const imageFile = await new Promise<File>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const fileName = numPages > 1 
              ? file.name.replace('.pdf', `_page_${i}.png`)
              : file.name.replace('.pdf', '.png');
            resolve(new File([blob], fileName, { type: 'image/png' }));
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        }, 'image/png');
      });
      
      imageFiles.push(imageFile);
    }
    
    return imageFiles;
  } catch (error) {
    console.error("Error converting PDF to images:", error);
    throw error;
  }
};
