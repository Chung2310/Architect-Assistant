export type CropBox = { x: number; y: number; width: number; height: number };

const DARK_LUMINANCE_THRESHOLD = 225;
const MIN_DARK_PIXELS = 32;
const MIN_CONTENT_AREA_RATIO = 0.1;
const PADDING_RATIO = 0.04;

export function calculateFloorplanCropBox(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): CropBox | null {
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) return null;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let darkPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (pixels[offset + 3] === 0) continue;
      const luminance = pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;
      if (luminance >= DARK_LUMINANCE_THRESHOLD) continue;
      darkPixels++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (darkPixels < MIN_DARK_PIXELS || maxX < minX || maxY < minY) return null;
  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  if ((contentWidth * contentHeight) / (width * height) < MIN_CONTENT_AREA_RATIO) return null;

  const padding = Math.ceil(Math.max(width, height) * PADDING_RATIO);
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + 1 + padding);
  const bottom = Math.min(height, maxY + 1 + padding);
  return { x, y, width: right - x, height: bottom - y };
}

export function preprocessFloorplanImageBase64(
  dataUrl: string,
  maxDimension = 1600,
): Promise<string> {
  if (typeof document === "undefined" || typeof Image === "undefined") return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const source = document.createElement("canvas");
        source.width = image.naturalWidth || image.width;
        source.height = image.naturalHeight || image.height;
        const sourceContext = source.getContext("2d", { willReadFrequently: true });
        if (!sourceContext) return resolve(dataUrl);
        sourceContext.drawImage(image, 0, 0);
        const imageData = sourceContext.getImageData(0, 0, source.width, source.height);
        const crop = calculateFloorplanCropBox(imageData.data, source.width, source.height) || {
          x: 0,
          y: 0,
          width: source.width,
          height: source.height,
        };
        const scale = Math.min(1, maxDimension / Math.max(crop.width, crop.height));
        const output = document.createElement("canvas");
        output.width = Math.max(1, Math.round(crop.width * scale));
        output.height = Math.max(1, Math.round(crop.height * scale));
        const outputContext = output.getContext("2d");
        if (!outputContext) return resolve(dataUrl);
        outputContext.filter = "contrast(1.15)";
        outputContext.drawImage(
          source,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          output.width,
          output.height,
        );
        resolve(output.toDataURL("image/png"));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}
