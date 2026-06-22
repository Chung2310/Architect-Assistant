import React, { useState } from 'react';
import { Icon } from './Icon';
import { getAIClient, generateContentWithRetry, scaleToResolution } from '../lib/renderUtils';

interface Point {
  x: number;
  y: number;
}

interface Shape {
  id: number;
  points: Point[];
  category?: string;
  type?: 'polygon' | 'rect';
  label?: string;
}



export const VirtualStaging: React.FC = () => {
  const [type, setType] = useState('virtual');
  const [roomType, setRoomType] = useState('Living Room');
  const [style, setStyle] = useState('minimalist');
  const [prompt, setPrompt] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [numImages, setNumImages] = useState(1);
  const [resolution, setResolution] = useState('1K Full HD');
  const [aspectRatio, setAspectRatio] = useState('Tự động');
  const [detectedAspectRatio, setDetectedAspectRatio] = useState('1:1');
  const [aiEngine, setAiEngine] = useState('iGen 3.1 Pro Preview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedResults, setGeneratedResults] = useState<string[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [activeCategory, setActiveCategory] = useState('SOFA');
  const [drawMode, setDrawMode] = useState<'select' | 'polygon' | 'rect'>('select');
  const [viewMode, setViewMode] = useState<'edit' | 'result'>('edit');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [editingShapeId, setEditingShapeId] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [draggingInfo, setDraggingInfo] = useState<{
    shapeId: number;
    pointIndex: number | 'all';
    startX: number;
    startY: number;
    originalPoints: Point[];
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const resultContainerRef = React.useRef<HTMLDivElement>(null);

  const handleWheel = React.useCallback((e: WheelEvent) => {
    if (viewMode !== 'result') return;
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoomScale(prev => Math.min(Math.max(1, prev + delta), 5));
  }, [viewMode]);

  React.useEffect(() => {
    const el = resultContainerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [viewMode, handleWheel]);

  // Reset zoom when switching modes or images
  React.useEffect(() => {
    setTimeout(() => {
      setZoomScale(1);
      setPanPos({ x: 0, y: 0 });
    }, 0);
  }, [viewMode, uploadedImage]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || viewMode !== 'edit') return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (drawMode === 'select') {
      // Check for point dragging first
      for (const shape of shapes) {
        for (let i = 0; i < shape.points.length; i++) {
          const p = shape.points[i];
          const dist = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(y - p.y, 2));
          if (dist < 3) {
            setDraggingInfo({
              shapeId: shape.id,
              pointIndex: i,
              startX: x,
              startY: y,
              originalPoints: JSON.parse(JSON.stringify(shape.points))
            });
            setEditingShapeId(shape.id);
            return;
          }
        }
      }
      
      // Check for whole shape dragging
      // (Simple check for rect, more complex for polygons)
      for (const shape of shapes) {
        if (shape.type === 'rect') {
          const minX = Math.min(shape.points[0].x, shape.points[1].x);
          const maxX = Math.max(shape.points[0].x, shape.points[1].x);
          const minY = Math.min(shape.points[0].y, shape.points[1].y);
          const maxY = Math.max(shape.points[0].y, shape.points[1].y);
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            setDraggingInfo({
              shapeId: shape.id,
              pointIndex: 'all',
              startX: x,
              startY: y,
              originalPoints: JSON.parse(JSON.stringify(shape.points))
            });
            setEditingShapeId(shape.id);
            return;
          }
        }
      }
      setEditingShapeId(null);
      return;
    }

    if (drawMode === 'rect') {
      setIsDrawing(true);
      setCurrentPoints([{ x, y }, { x, y }]);
    } else {
      if (!isDrawing) {
        setIsDrawing(true);
        setCurrentPoints([{ x, y }]);
      } else {
        // Check if clicking near the first point to close the polygon
        const firstPoint = currentPoints[0];
        const dist = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
        if (dist < 8 && currentPoints.length >= 3) {
          finishPolygon();
        } else {
          // Add point to polygon
          setCurrentPoints([...currentPoints, { x, y }]);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });

    if (draggingInfo) {
      const { shapeId, pointIndex, startX, startY, originalPoints } = draggingInfo;
      const dx = x - startX;
      const dy = y - startY;
      
      setShapes(prev => prev.map(s => {
        if (s.id !== shapeId) return s;
        const newPoints = JSON.parse(JSON.stringify(originalPoints));
        if (pointIndex === 'all') {
          return { ...s, points: newPoints.map((p: Point) => ({ x: p.x + dx, y: p.y + dy })) };
        } else {
          newPoints[pointIndex] = { x: newPoints[pointIndex].x + dx, y: newPoints[pointIndex].y + dy };
          return { ...s, points: newPoints };
        }
      }));
      return;
    }

    if (!isDrawing) return;

    if (drawMode === 'rect') {
      const start = currentPoints[0];
      setCurrentPoints([start, { x, y }]);
    }
  };

  const handleMouseUp = () => {
    if (draggingInfo) {
      setDraggingInfo(null);
      return;
    }

    if (drawMode === 'rect' && isDrawing) {
      setIsDrawing(false);
      if (currentPoints.length === 2) {
        const newId = Date.now();
        setShapes([...shapes, { 
          type: 'rect', 
          points: currentPoints, 
          label: activeCategory,
          id: newId 
        }]);
        setEditingShapeId(newId);
      }
      setCurrentPoints([]);
    }
  };

  const finishPolygon = () => {
    if (drawMode === 'polygon' && currentPoints.length > 2) {
      const newId = Date.now();
      setShapes([...shapes, { 
        type: 'polygon', 
        points: currentPoints, 
        label: activeCategory,
        id: newId 
      }]);
      setEditingShapeId(newId);
    }
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  const clearAll = () => {
    setShapes([]);
    setCurrentPoints([]);
    setIsDrawing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setUploadedImage(result);
        setOriginalImage(result);
        
        // Detect aspect ratio
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          let detected = '1:1';
          if (ratio > 1.5) detected = '16:9';
          else if (ratio > 1.2) detected = '4:3';
          else if (ratio < 0.6) detected = '9:16';
          else if (ratio < 0.8) detected = '3:4';
          setDetectedAspectRatio(detected);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setUploadedImage(result);
        setOriginalImage(result);

        // Detect aspect ratio
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          let detected = '1:1';
          if (ratio > 1.5) detected = '16:9';
          else if (ratio > 1.2) detected = '4:3';
          else if (ratio < 0.6) detected = '9:16';
          else if (ratio < 0.8) detected = '3:4';
          setDetectedAspectRatio(detected);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const categories = [
    'SOFA', 'BÀN TRÀ', 'KỆ TV', 'KỆ TRANG TRÍ', 'TRANH DECOR', 'THẢM TRẢI SÀN', 
    'ĐÈN CHÙM', 'ĐÈN SÀN', 'CÂY CẢNH', 'RÈM CỬA', 'DECOR TƯỜNG', 'LOA/ÂM THANH', 
    'ĐỒNG HỒ TREO TƯỜNG', 'TƯỢNG DECOR', 'CỬA SỔ', 'CỬA RA VÀO'
  ];

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleGenerateContent = async () => {
    if (!uploadedImage) {
      alert("Vui lòng tải lên ảnh trước khi tạo!");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    
    // Simulate initial phase (analysis)
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 98) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 2;
      });
    }, 400);

    try {
      const selectedModel = aiEngine.includes('Pro') ? 'gemini-3-pro-image' : 'gemini-3.1-flash-image';
      const ai = await getAIClient(selectedModel);
      
      const shapesDescription = shapes.length > 0 
        ? `\nMARKERS: ${shapes.map((s, i) => `[Target ${i+1}: ${s.label} at polygon coordinates ${JSON.stringify(s.points)}]`).join(', ')}.\nCRITICAL ACTION: Focus editing EXCLUSIVELY inside these markers. The rest of the image MUST be a perfect 1:1 match with the source. DO NOT delete, move, or change any furniture, plants, or details outside these polygons.`
        : '';

      const basePrompt = type === 'virtual' 
        ? `You are an expert interior designer. Perform Virtual Staging on this empty room. Add high-quality furniture, professional lighting, and realistic textures to create a photorealistic ${style} ${roomType}.`
        : shapes.length > 0
          ? `You are an expert interior designer performing PRECISION SELECTIVE EDITING. Modify ONLY the items indicated in the markers. You MUST PRESERVE all surrounding furniture (like beds, sofas, tables), plants, decorations, and lighting exactly as they appear in original to maintain continuity. Non-annotated regions MUST remain identical to source.`
          : `You are an expert interior designer performing room RENOVATION. Modify the space based on user notes while PRESERVING the existing layout and all furniture or objects not specifically mentioned in notes. Do NOT remove essential furniture (like beds) unless explicitly requested. Maintain strict consistency with architectural and design details of the source.`;

      const parts: Record<string, unknown>[] = [
        { inlineData: { data: (originalImage || uploadedImage || '').split(',')[1], mimeType: 'image/jpeg' } },
        { text: `${basePrompt}${shapesDescription}\nUser notes: ${requestNotes}\nExtra instructions: ${prompt}` }
      ];

      if (referenceImage) {
        parts.push({ inlineData: { data: referenceImage.split(',')[1], mimeType: 'image/jpeg' } });
      }

      const newResults: string[] = [];

      // Generate sequentially to avoid rate limits
      for (let i = 0; i < numImages; i++) {
        const response = await generateContentWithRetry(ai, {
          model: selectedModel,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio === 'Tự động' ? detectedAspectRatio :
                           aspectRatio === '1:1 Square' ? '1:1' : 
                           aspectRatio === '16:9 Landscape' ? '16:9' :
                           aspectRatio === '9:16 Portrait' ? '9:16' :
                           aspectRatio === '4:3 Classic' ? '4:3' :
                           aspectRatio === '3:2 Photo' ? '3:2' : '1:1',
              imageSize: resolution.includes('1K') ? '1K' : resolution.includes('2K') ? '2K' : '4K'
            }
          }
        });
        
        if (response && response.candidates && response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              let base64EncodeString = part.inlineData.data;
              let mimeType = part.inlineData.mimeType || 'image/png';
              
              if (resolution.includes('2K') || resolution.includes('4K')) {
                const targetRes = resolution.includes('2K') ? '2K' : '4K';
                const scaled = await scaleToResolution(base64EncodeString, mimeType, targetRes);
                base64EncodeString = scaled.base64Data;
                mimeType = scaled.mimeType;
              }

              newResults.push(`data:${mimeType};base64,${base64EncodeString}`);
            }
          }
        }
        
        if (i < numImages - 1) await new Promise(r => setTimeout(r, 2000));
      }

      clearInterval(progressInterval);

      if (newResults.length > 0) {
        setGeneratedResults(prev => [...newResults, ...prev]);
        setUploadedImage(newResults[0]);
        setViewMode('result');
      } else {
        throw new Error("No image generated in the response");
      }

    } catch (error) {
      console.error("Generation failed:", error);
      alert("Đã có lỗi xảy ra trong quá trình tạo ảnh. Vui lòng kiểm tra API Key và thử lại.");
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const styles = [
    { id: 'scandinavian', name: 'Scandinavian' },
    { id: 'modern', name: 'Modern' },
    { id: 'minimalist', name: 'Minimalist' },
    { id: 'japandi', name: 'Japandi' },
    { id: 'industrial', name: 'Industrial' },
    { id: 'contemporary', name: 'Contemporary' },
    { id: 'classic', name: 'Classic' },
    { id: 'luxury', name: 'Luxury' },
    { id: 'wabi-sabi', name: 'Wabi Sabi' },
    { id: 'mid-century', name: 'Mid-Century Modern' },
  ];

  return (
    <div className="h-full flex overflow-hidden bg-surface">
      {/* Left Panel: Settings */}
      <section className="w-full lg:w-[440px] h-full bg-white flex flex-col border-r border-slate-100 overflow-y-auto custom-scrollbar">
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-on-surface font-headline font-semibold text-lg mb-1">Virtual Staging</h2>
            <p className="text-on-surface-variant text-sm font-body">Thiết lập tham số cho bản vẽ AI</p>
          </div>
          {/* Input Group 1: Loại hình */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 shadow-sm space-y-3">
            <h3 className="text-on-surface font-extrabold text-sm mb-2">Loại hình xử lý</h3>
            <div className="grid grid-cols-2 gap-2 bg-surface-container-low p-1 rounded-xl">
              <button 
                onClick={() => setType('virtual')}
                className={`py-2.5 rounded-lg text-sm font-medium transition-all ${type === 'virtual' ? 'bg-white shadow-sm text-on-surface' : 'text-on-surface-variant hover:bg-white/50'}`}
              >
                Virtual
              </button>
              <button 
                onClick={() => setType('renovation')}
                className={`py-2.5 rounded-lg text-sm font-medium transition-all ${type === 'renovation' ? 'bg-white shadow-sm text-on-surface' : 'text-on-surface-variant hover:bg-white/50'}`}
              >
                Renovation
              </button>
            </div>
          </div>
          {/* Input Group 2: Công năng */}
          <div className={`bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 shadow-sm space-y-3 transition-all duration-500 ${type === 'renovation' ? 'opacity-40 blur-[1px] pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
            <h3 className="text-on-surface font-extrabold text-sm mb-2">
              Công năng phòng
            </h3>
            <div className="relative group">
              <select 
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                disabled={type === 'renovation'}
                className="w-full appearance-none bg-surface-container-low border-none outline-none rounded-xl px-4 py-3.5 pr-10 text-on-surface text-sm focus:ring-1 focus:ring-primary transition-all cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap disabled:cursor-not-allowed"
              >
                <option>Living Room</option>
                <option>Bedroom</option>
                <option>Kitchen</option>
                <option>Dining Room</option>
                <option>Workspace</option>
              </select>
              <Icon name="expand_more" className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
            </div>
          </div>
          {/* Input Group 3: Phong cách */}
          <div className={`bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 shadow-sm space-y-4 transition-all duration-500 ${type === 'renovation' ? 'opacity-40 blur-[1px] pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
            <h3 className="text-on-surface font-extrabold text-sm mb-2">
              Phong cách thiết kế
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {styles.map(s => (
                <button 
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  disabled={type === 'renovation'}
                  className={`py-3.5 px-4 rounded-2xl text-[13px] font-bold transition-all border-2 flex items-center justify-center text-center disabled:cursor-not-allowed ${
                    style === s.id 
                      ? 'border-[#FF5722] bg-[#FF5722]/5 text-[#FF5722]' 
                      : 'border-transparent bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* New Section: Style Tham Khảo */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 shadow-sm space-y-3">
            <h3 className="text-on-surface font-extrabold text-sm mb-2">Style tham khảo</h3>
            <div 
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => setReferenceImage(event.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                };
                input.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('image/')) {
                  const reader = new FileReader();
                  reader.onload = (event) => setReferenceImage(event.target?.result as string);
                  reader.readAsDataURL(file);
                }
              }}
              className="w-full aspect-[2/1] bg-surface-container-low border-2 border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-all relative overflow-hidden group"
            >
              {referenceImage ? (
                <>
                  <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Icon name="add_photo_alternate" className="text-white text-2xl" />
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setReferenceImage(null);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-error shadow-lg hover:scale-110 active:scale-95 transition-all z-10"
                  >
                    <Icon name="close" className="text-lg" />
                  </button>
                </>
              ) : (
                <div className="text-center group-hover:scale-105 transition-transform">
                  <Icon name="cloud_upload" className="text-3xl text-[#00BCD4] mb-2" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kéo hoặc Thả ảnh tham khảo</p>
                  <p className="text-[8px] text-slate-400/60 font-medium">JPG, PNG, WEBP</p>
                </div>
              )}
            </div>
          </div>

          {/* New Section: Ghi Chú Yêu Cầu */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 shadow-sm space-y-3">
            <h3 className="text-on-surface font-extrabold text-sm mb-2">Ghi chú yêu cầu</h3>
            <textarea 
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              className="w-full bg-surface-container-low border-none outline-none rounded-2xl p-4 text-xs text-on-surface placeholder:text-slate-400 h-28 resize-none font-medium"
              placeholder="ví dụ: thêm nội thất vào phòng theo note trên hình ảnh. phòng ngủ thực tế như ảnh chụp tạp chí nội thất..."
            />
          </div>

          {/* 4. Tối ưu Prompt và Thông số */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface">4. Tối ưu Prompt và Thông số</h3>
              <div className="relative">
                <select 
                  value={aiEngine}
                  onChange={(e) => setAiEngine(e.target.value)}
                  className="bg-surface-container-low border border-outline-variant/20 rounded-lg px-2 py-1 text-[10px] font-bold text-on-surface outline-none appearance-none pr-6 cursor-pointer"
                >
                  <option>iGen 3 Flash Preview</option>
                  <option>iGen 3.1 Pro Preview</option>
                </select>
                <Icon name="expand_more" className="absolute right-1 top-1/2 -translate-y-1/2 text-on-surface-variant text-[12px] pointer-events-none" />
              </div>
            </div>

            <button className="w-full bg-[#00BCD4] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-all active:scale-[0.98]">
              <Icon name="auto_awesome" className="text-lg" />
              <span>Phân tích và hoàn thiện prompt</span>
            </button>

            <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-on-surface">Prompt tạo ảnh hoàn chỉnh:</h3>
              <textarea 
                className="w-full bg-surface-container-low/50 border border-outline-variant/20 rounded-xl p-3 text-xs text-on-surface placeholder:text-on-surface-variant/40 h-24 resize-none outline-none focus:border-[#00BCD4] transition-all font-medium"
                placeholder="Ảnh chụp thực tế công trình, giữ chính xác góc chụp 100% như ảnh đưa vào..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { label: 'VR 360 Living', p: '360 degree equirectangular panorama of a luxury living room' },
                  { label: 'VR 360 Studio', p: '360 degree panorama of a modern studio loft' },
                  { label: 'Industrial 360', p: 'Interior 360 degrees equirectangular scan of industrial loft' }
                ].map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setPrompt(item.p)}
                    className="px-2 py-1 rounded-md bg-white border border-[#00BCD4]/20 text-[9px] font-bold text-[#00BCD4] hover:bg-[#00BCD4] hover:text-white transition-all shadow-sm flex items-center gap-1"
                  >
                    <Icon name="auto_awesome" className="text-[10px]" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-outline-variant/10 text-nowrap">
              <div className="space-y-2">
                <h3 className="text-[11px] font-extrabold text-on-surface">AI Engine</h3>
                <div className="relative">
                  <select 
                    value={aiEngine}
                    onChange={(e) => setAiEngine(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-2 text-[11px] font-bold text-on-surface outline-none appearance-none cursor-pointer pr-8 overflow-hidden text-ellipsis"
                  >
                    <option>iGen 3.1 Flash Preview</option>
                    <option>iGen 3.1 Pro Preview</option>
                  </select>
                  <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-[11px] font-extrabold text-on-surface">Độ phân giải</h3>
                <div className="relative">
                  <select 
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-2 text-[11px] font-bold text-on-surface outline-none appearance-none cursor-pointer pr-8 overflow-hidden text-ellipsis"
                  >
                    <option>1K Full HD</option>
                    <option>2K QHD</option>
                  </select>
                  <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-[11px] font-extrabold text-on-surface">Số lượng ảnh</h3>
                <div className="flex bg-surface-container-low rounded-lg p-1">
                  {[1, 2, 4].map(n => (
                    <button 
                      key={n} 
                      onClick={() => setNumImages(n)}
                      className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${numImages === n ? 'bg-[#00BCD4] text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-[11px] font-extrabold text-on-surface">Tỷ lệ khung hình</h3>
                <div className="relative">
                  <select 
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-2 text-[11px] font-bold text-on-surface outline-none appearance-none cursor-pointer pr-8 overflow-hidden text-ellipsis"
                  >
                    <option>Tự động</option>
                    <option>1:1 Square</option>
                    <option>16:9 Landscape</option>
                    <option>9:16 Portrait</option>
                    <option>4:3 Classic</option>
                    <option>3:2 Photo</option>
                  </select>
                  <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={handleGenerateContent}
              disabled={isGenerating}
              className="w-full bg-[#87E0E7] text-white py-4 rounded-2xl font-bold shadow-lg shadow-cyan-100 hover:shadow-xl hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
            >
              {isGenerating ? (
                <>
                  <Icon name="hourglass_empty" className="text-xl animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Icon name="auto_awesome" className="text-xl" />
                  Tạo Ảnh Thực Tế
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Center area: Workspace */}
      <section className="flex-1 h-full p-8 flex flex-col gap-6 bg-surface overflow-y-auto custom-scrollbar">
        {/* Top Card: Upload Area */}
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 shadow-sm flex flex-col">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange} 
          />
          {!uploadedImage ? (
            <div 
              onClick={handleUpload}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="w-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/30 rounded-2xl bg-surface-container-low/30 relative group transition-all hover:bg-surface-container-low/50 cursor-pointer"
            >
              <div className="text-center space-y-6 max-w-md p-8">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Icon name="upload_file" className="text-4xl text-slate-400" />
                </div>
                <div>
                  <h3 className="text-on-surface font-bold text-xl">Tải lên hình ảnh kiến trúc</h3>
                  <p className="text-on-surface-variant text-sm mt-2 leading-relaxed">Kéo thả hoặc chọn ảnh hiện trạng phòng trống để AI tiến hành dàn dựng nội thất ảo.</p>
                </div>
                <button className="inline-flex items-center gap-2 bg-white ring-1 ring-outline-variant/40 px-6 py-3 rounded-full text-on-surface font-medium hover:bg-surface-container-low transition-all">
                  <Icon name="add_photo_alternate" className="text-xl" />
                  Chọn ảnh từ máy tính
                </button>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Định dạng hỗ trợ: JPG, PNG, WEBP</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-[800px] bg-white rounded-2xl overflow-hidden relative border border-outline-variant/20 shadow-xl">
              {/* Editor Top Navigation */}
              <div className="bg-slate-50 px-6 py-3 flex items-center justify-between border-b border-outline-variant/10">
                <button 
                  onClick={() => setUploadedImage(null)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-error/10 text-error text-[10px] font-bold uppercase tracking-wider hover:bg-error/20 transition-colors"
                >
                  <Icon name="delete" className="text-sm" />
                  Xóa ảnh
                </button>

                <div className="flex bg-slate-200/50 p-1 rounded-xl border border-outline-variant/10">
                  <button 
                    onClick={() => setViewMode('edit')}
                    className={`px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      viewMode === 'edit' ? 'bg-[#00BCD4] text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Ghi chú & Vẽ
                  </button>
                  <button 
                    onClick={() => setViewMode('result')}
                    className={`px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      viewMode === 'result' ? 'bg-[#00BCD4] text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Kết quả
                  </button>
                </div>

                <button 
                  onClick={handleUpload}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[#00BCD4] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#00ACC1] transition-all shadow-lg shadow-[#00BCD4]/20"
                >
                  <Icon name="upload" className="text-sm" />
                  Thay ảnh khác
                </button>
              </div>

              {/* Editor Sub Bar: Tools & Categories */}
              {viewMode === 'edit' && (
                <div className="bg-white px-4 py-2 flex flex-col border-b border-outline-variant/10 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-4 mb-2">
                  {/* Selection Tools */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-outline-variant/10">
                    <button 
                      onClick={() => { 
                        if (isDrawing && drawMode === 'polygon' && currentPoints.length >= 3) {
                          finishPolygon();
                        }
                        setDrawMode('select'); 
                        setCurrentPoints([]); 
                        setIsDrawing(false); 
                      }}
                      className={`p-1.5 rounded-md transition-all ${drawMode === 'select' ? 'bg-[#00BCD4] text-white' : 'text-slate-500 hover:text-slate-700'}`}
                      title="Chọn/Chỉnh sửa"
                    >
                      <Icon name="near_me" className="text-lg" />
                    </button>
                    <button 
                      onClick={() => { 
                        if (isDrawing && drawMode === 'polygon' && currentPoints.length >= 3) {
                          finishPolygon();
                        }
                        setDrawMode('polygon'); 
                        setCurrentPoints([]); 
                        setIsDrawing(false); 
                      }}
                      className={`p-1.5 rounded-md transition-all ${drawMode === 'polygon' ? 'bg-[#00BCD4] text-white' : 'text-slate-500 hover:text-slate-700'}`}
                      title="Vẽ đa giác"
                    >
                      <Icon name="pentagon" className="text-lg" />
                    </button>
                    <button 
                      onClick={() => { 
                        if (isDrawing && drawMode === 'polygon' && currentPoints.length >= 3) {
                          finishPolygon();
                        }
                        setDrawMode('rect'); 
                        setCurrentPoints([]); 
                        setIsDrawing(false); 
                      }}
                      className={`p-1.5 rounded-md transition-all ${drawMode === 'rect' ? 'bg-[#00BCD4] text-white' : 'text-slate-500 hover:text-slate-700'}`}
                      title="Vẽ hình chữ nhật"
                    >
                      <Icon name="rectangle" className="text-lg" />
                    </button>
                  </div>

                  {/* Undo/Redo */}
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 text-slate-300 hover:text-slate-600 transition-colors">
                      <Icon name="undo" className="text-lg" />
                    </button>
                    <button className="p-1.5 text-slate-300 hover:text-slate-600 transition-colors">
                      <Icon name="redo" className="text-lg" />
                    </button>
                  </div>

                  <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>

                  {/* Categories Scrollable */}
                  <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                          activeCategory === cat 
                            ? 'bg-[#00BCD4] text-white shadow-md' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>

                  {/* Right Tools */}
                  <div className="flex items-center gap-3">
                    <button className="p-1.5 text-slate-400 hover:text-[#00BCD4] transition-colors">
                      <Icon name="info" className="text-lg" />
                    </button>
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1 border border-outline-variant/10">
                      <button className="text-slate-400 hover:text-slate-700"><Icon name="remove" className="text-xs" /></button>
                      <span className="text-slate-700 text-[10px] font-bold min-w-[35px] text-center">100%</span>
                      <button className="text-slate-400 hover:text-slate-700"><Icon name="add" className="text-xs" /></button>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={finishPolygon}
                    disabled={drawMode !== 'polygon' || currentPoints.length < 3}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      drawMode === 'polygon' && currentPoints.length >= 3 
                        ? 'bg-[#00BCD4] text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    Chốt vùng ({shapes.length})
                  </button>
                  <button 
                    onClick={clearAll}
                    className="px-4 py-1.5 rounded-md bg-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 hover:text-slate-600 transition-all"
                  >
                    Xóa tất cả
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 flex relative overflow-hidden bg-slate-50">
                {/* Processing Overlay */}
                {isGenerating && (
                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-500">
                    <div className="relative w-64 h-64 mb-12">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50" cy="50" r="45"
                          className="stroke-white/10 fill-none"
                          strokeWidth="2"
                        />
                        <circle
                          cx="50" cy="50" r="45"
                          className="stroke-[#FF5722] fill-none transition-all duration-300 ease-out"
                          strokeWidth="4"
                          strokeDasharray={`${generationProgress * 2.827}, 282.7`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <div className="bg-[#FF5722]/10 border border-[#FF5722]/30 rounded-full px-4 py-1 mb-2">
                          <span className="text-[#FF5722] text-[10px] font-black tracking-tighter uppercase">AI IGEN3</span>
                        </div>
                        <div className="text-white text-3xl font-black tracking-tight">{Math.round(generationProgress)}<span className="text-sm opacity-50 ml-0.5">%</span></div>
                      </div>
                    </div>
                    <div className="text-center space-y-4 max-w-sm px-6">
                      <h2 className="text-white text-xl font-black uppercase tracking-[0.2em]">PROCESSING CORE</h2>
                      <div className="h-0.5 w-12 bg-[#FF5722] mx-auto mb-6"></div>
                      <p className="text-slate-400 text-xs font-bold leading-relaxed tracking-widest uppercase animate-pulse">
                        Đang phân tích không gian và vật liệu...
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Main Image Display */}
                <div className="flex-1 flex items-center justify-center p-4 relative group">
                  {viewMode === 'edit' ? (
                    <div 
                      ref={containerRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      className={`relative max-w-full max-h-[calc(100vh-180px)] shadow-2xl rounded-xl overflow-hidden border border-outline-variant/10 select-none bg-white ${drawMode === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
                    >
                      <img 
                        src={originalImage || uploadedImage || ''} 
                        alt="Uploaded Room" 
                        className="max-w-full max-h-[calc(100vh-180px)] object-contain pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* SVG Overlay for Drawing */}
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                        {/* Existing Shapes */}
                        {shapes.map(shape => {
                          const centerX = shape.type === 'rect' 
                            ? (shape.points[0].x + shape.points[1].x) / 2 
                            : shape.points.reduce((acc: number, p: Point) => acc + p.x, 0) / shape.points.length;
                          const centerY = shape.type === 'rect' 
                            ? (shape.points[0].y + shape.points[1].y) / 2 
                            : shape.points.reduce((acc: number, p: Point) => acc + p.y, 0) / shape.points.length;
                          
                          return (
                            <g key={shape.id} className="pointer-events-auto">
                              {shape.type === 'rect' ? (
                                <rect 
                                  x={Math.min(shape.points[0].x, shape.points[1].x)}
                                  y={Math.min(shape.points[0].y, shape.points[1].y)}
                                  width={Math.abs(shape.points[0].x - shape.points[1].x)}
                                  height={Math.abs(shape.points[0].y - shape.points[1].y)}
                                  className={editingShapeId === shape.id ? "fill-[#00BCD4]/25 stroke-[#00BCD4] stroke-[0.5]" : "fill-[#00BCD4]/15 stroke-[#00BCD4] stroke-[0.3]"}
                                />
                              ) : (
                                <polygon 
                                  points={shape.points.map((p: Point) => `${p.x},${p.y}`).join(' ')}
                                  className={editingShapeId === shape.id ? "fill-[#00BCD4]/25 stroke-[#00BCD4] stroke-[0.5]" : "fill-[#00BCD4]/15 stroke-[#00BCD4] stroke-[0.3]"}
                                  vectorEffect="non-scaling-stroke"
                                />
                              )}

                              {/* Control handles in select mode */}
                              {drawMode === 'select' && shape.points.map((p: Point, idx: number) => (
                                <circle 
                                  key={idx}
                                  cx={p.x}
                                  cy={p.y}
                                  r="1.2"
                                  fill="white"
                                  stroke={editingShapeId === shape.id ? "#00BCD4" : "#FF5722"}
                                  strokeWidth="0.3"
                                  className="cursor-move hover:scale-125 transition-transform"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (!containerRef.current) return;
                                    const r = containerRef.current.getBoundingClientRect();
                                    const sx = ((e.clientX - r.left) / r.width) * 100;
                                    const sy = ((e.clientY - r.top) / r.height) * 100;
                                    setDraggingInfo({
                                      shapeId: shape.id,
                                      pointIndex: idx,
                                      startX: sx,
                                      startY: sy,
                                      originalPoints: JSON.parse(JSON.stringify(shape.points))
                                    });
                                    setEditingShapeId(shape.id);
                                  }}
                                />
                              ))}
                              {/* Label inside the shape */}
                              <foreignObject
                                x={centerX - 10}
                                y={centerY - 5}
                                width="20"
                                height="10"
                                className="pointer-events-auto"
                              >
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingShapeId(shape.id);
                                  }}
                                  className="w-full h-full text-white text-[2.5px] font-bold text-center flex items-center justify-center cursor-pointer drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] leading-tight select-none"
                                >
                                  {editingShapeId === shape.id ? (
                                    <input
                                      autoFocus
                                      className="bg-white/90 text-[#00BCD4] border-none outline-none w-[90%] text-center rounded px-0.5"
                                      style={{ fontSize: '2.5px' }}
                                      value={shape.label}
                                      onChange={(e) => {
                                        const newLabel = e.target.value;
                                        setShapes(shapes.map(s => s.id === shape.id ? { ...s, label: newLabel } : s));
                                      }}
                                      onBlur={() => setEditingShapeId(null)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') setEditingShapeId(null);
                                        if (e.key === 'Delete' || e.key === 'Backspace' && shape.label === '') {
                                          setShapes(shapes.filter(s => s.id !== shape.id));
                                          setEditingShapeId(null);
                                        }
                                      }}
                                    />
                                  ) : (
                                    <span className="px-1 py-0.5 bg-black/10 rounded-sm inline-block">
                                      {shape.label}
                                    </span>
                                  )}
                                </div>
                              </foreignObject>
                            </g>
                          );
                        })}

                        {/* Current Drawing Shape */}
                        {isDrawing && currentPoints.length > 0 && (
                          <g>
                            {drawMode === 'rect' && currentPoints.length === 2 ? (
                              <rect 
                                x={Math.min(currentPoints[0].x, currentPoints[1].x)}
                                y={Math.min(currentPoints[0].y, currentPoints[1].y)}
                                width={Math.abs(currentPoints[0].x - currentPoints[1].x)}
                                height={Math.abs(currentPoints[0].y - currentPoints[1].y)}
                                className="fill-[#00BCD4]/10 stroke-[#00BCD4] stroke-[0.5] stroke-dasharray-1"
                              />
                            ) : (
                              <g>
                                {/* Preview line to mouse */}
                                <line 
                                  x1={currentPoints[currentPoints.length - 1].x}
                                  y1={currentPoints[currentPoints.length - 1].y}
                                  x2={mousePos.x}
                                  y2={mousePos.y}
                                  className="stroke-[#00BCD4] stroke-[0.3] stroke-dasharray-1"
                                />
                                <polyline 
                                  points={currentPoints.map((p: Point) => `${p.x},${p.y}`).join(' ')}
                                  className="fill-none stroke-[#00BCD4] stroke-[0.5]"
                                  vectorEffect="non-scaling-stroke"
                                />
                                {currentPoints.map((p, i) => (
                                  <circle key={i} cx={p.x} cy={p.y} r="1.2" className="fill-[#00BCD4] stroke-white stroke-[0.2]" />
                                ))}
                              </g>
                            )}
                          </g>
                        )}
                      </svg>

                      {/* Simulated Selection Cursor */}
                      {drawMode !== 'select' && !isDrawing && (
                        <div className="absolute inset-0 cursor-crosshair flex items-center justify-center pointer-events-none">
                          <div className="w-8 h-8 border-2 border-[#00BCD4] rounded-full flex items-center justify-center bg-[#00BCD4]/20 shadow-[0_0_20px_rgba(0,188,212,0.4)]">
                            <Icon name="add" className="text-[#00BCD4] text-sm" />
                          </div>
                        </div>
                      )}
                      
                      {/* Active Drawing Point Follower */}
                      {isDrawing && drawMode === 'polygon' && (
                        <div 
                          className="absolute pointer-events-none w-4 h-4 border border-[#00BCD4] rounded-full bg-white/50 flex items-center justify-center"
                          style={{ left: `${mousePos.x}%`, top: `${mousePos.y}%`, transform: 'translate(-50%, -50%)' }}
                        >
                          <div className="w-1 h-1 bg-[#00BCD4] rounded-full"></div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center bg-black/5 rounded-2xl overflow-hidden shadow-inner group-hover:shadow-2xl transition-all duration-500">
                      {/* Before/After Comparison Slider */}
                      <div className="absolute inset-0 flex items-center justify-center p-0 md:p-4">
                        <div 
                          ref={resultContainerRef}
                          className={`relative w-full h-full md:max-w-[calc(100vw-500px)] rounded-none md:rounded-xl overflow-hidden shadow-2xl border-0 md:border border-white/20 select-none group/slider transition-colors bg-black/10 ${zoomScale > 1 ? 'cursor-move bg-slate-800' : 'cursor-crosshair'}`}
                          onMouseDown={(e) => {
                            if (e.button !== 0) return; // Only left click
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startPanX = panPos.x;
                            const startPanY = panPos.y;
                            let hasMoved = false;

                            const onMouseMove = (moveEvent: MouseEvent) => {
                              const dx = moveEvent.clientX - startX;
                              const dy = moveEvent.clientY - startY;
                              if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                                hasMoved = true;
                                if (zoomScale > 1) {
                                  setIsPanning(true);
                                  setPanPos({
                                    x: startPanX + dx,
                                    y: startPanY + dy
                                  });
                                }
                              }
                            };

                            const onMouseUp = (upEvent: MouseEvent) => {
                              window.removeEventListener('mousemove', onMouseMove);
                              window.removeEventListener('mouseup', onMouseUp);
                              setIsPanning(false);

                              if (!hasMoved) {
                                // It's a click: Move slider
                                if (resultContainerRef.current) {
                                  const rect = resultContainerRef.current.getBoundingClientRect();
                                  const relativeX = (upEvent.clientX - rect.left - panPos.x) / zoomScale;
                                  const pos = (relativeX / (rect.width / zoomScale)) * 100;
                                  setSliderPos(Math.max(0, Math.min(100, pos)));
                                }
                              }
                            };

                            window.addEventListener('mousemove', onMouseMove);
                            window.addEventListener('mouseup', onMouseUp);
                          }}
                        >
                          {/* Zoomable Content Wrapper */}
                          <div 
                            className={`w-full h-full flex items-center justify-center ${zoomScale > 1 ? 'absolute inset-0' : 'relative'}`}
                            style={{ 
                              transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomScale})`,
                              transformOrigin: 'center center'
                            }}
                          >
                            {/* Generated Image (Bottom/Staged) - This relative image defines container size when scale=1 */}
                            <img 
                              src={uploadedImage || ''} 
                              alt="Staged" 
                              className={`max-w-full max-h-[calc(100vh-80px)] object-contain bg-slate-900 shadow-2xl ${zoomScale > 1 ? 'w-full h-full' : ''}`}
                              referrerPolicy="no-referrer"
                            />
                            
                            {/* Original Image (Top Clipped) */}
                            <div 
                              className="absolute inset-0 w-full h-full z-10 pointer-events-none flex items-center justify-center"
                              style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                            >
                              <img 
                                src={originalImage || ''} 
                                alt="Original" 
                                className={`w-full h-full object-contain ${zoomScale > 1 ? '' : ''}`}
                                style={{
                                   // Ensure it matches the staged image perfectly
                                }}
                                referrerPolicy="no-referrer"
                              />
                            </div>

                            {/* Slider Control Handle (Moved inside zoomable area) */}
                            <div 
                              className="absolute inset-y-0 z-30 flex items-center justify-center -translate-x-1/2 cursor-ew-resize group/handle"
                              style={{ left: `${sliderPos}%` }}
                              onMouseDown={(e) => {
                                e.stopPropagation(); // Prevents the container's pan/click logic
                                const container = resultContainerRef.current;
                                if (!container) return;
                                const handleMove = (moveEvent: MouseEvent) => {
                                  const rect = container.getBoundingClientRect();
                                  const relativeX = (moveEvent.clientX - rect.left - panPos.x) / zoomScale;
                                  const pos = (relativeX / (rect.width / zoomScale)) * 100;
                                  setSliderPos(Math.max(0, Math.min(100, pos)));
                                };
                                const handleUp = () => {
                                  window.removeEventListener('mousemove', handleMove);
                                  window.removeEventListener('mouseup', handleUp);
                                };
                                window.addEventListener('mousemove', handleMove);
                                window.addEventListener('mouseup', handleUp);
                              }}
                            >
                              {/* Line */}
                              <div className="h-full w-0.5 bg-[#FF5722] shadow-[0_0_15px_rgba(255,87,34,0.8)] relative">
                                <div className="absolute inset-y-0 -left-6 -right-6"></div>
                              </div>
                              
                              {/* Circle Handle */}
                              <div className="absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-[#FF5722] rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(255,87,34,0.5)] border-[3px] border-white transition-all group-hover/handle:scale-110 active:scale-90 group-hover/handle:shadow-[0_15px_40px_rgba(255,87,34,0.7)] group-active/handle:shadow-inner">
                                <Icon name="swap_horiz" className="text-white text-2xl" />
                              </div>
                            </div>
                          </div>

                          {/* Fixed UI Labels (NOT zoomed) */}
                          <div className="absolute top-6 left-6 z-40 pointer-events-none">
                            <div className="bg-black/60 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full">
                              <span className="text-white text-[10px] font-black tracking-widest uppercase">ORIGINAL</span>
                            </div>
                          </div>

                          <div className="absolute top-6 right-6 z-40 pointer-events-none">
                            <div className="bg-[#FF5722] border border-white/20 px-4 py-1.5 rounded-full shadow-lg shadow-[#FF5722]/40">
                              <span className="text-white text-[10px] font-black tracking-widest uppercase">STAGED</span>
                            </div>
                          </div>

                          {/* Slider Tooltip (Fixed) */}
                          <div 
                            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover/slider:opacity-100 transition-opacity bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#FF5722]/20 shadow-xl pointer-events-none whitespace-nowrap"
                            style={{ 
                              left: `${sliderPos}%`,
                              display: isPanning ? 'none' : 'block'
                            }}
                          >
                            <span className="text-[#FF5722] text-[9px] font-black uppercase tracking-widest italic">Kéo để so sánh</span>
                          </div>

                          {/* Bottom Action Overlays */}
                          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 z-40 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                            {/* Help / Status Pill */}
                            <div className="bg-[#2C2C2C]/90 backdrop-blur-md px-6 py-2.5 rounded-2xl flex items-center gap-6 border border-white/5 shadow-2xl">
                              <div className="flex items-center gap-2">
                                <span className="bg-[#444444] text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase">Cuộn</span>
                                <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Phóng to</span>
                              </div>
                              <div className="w-px h-4 bg-white/10" />
                              <div className="flex items-center gap-2">
                                <span className="bg-[#444444] text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase">Kéo</span>
                                <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Di chuyển</span>
                              </div>
                              <div className="w-px h-4 bg-white/10" />
                              <span className="text-[#FF5722] text-[10px] font-black tracking-widest">{Math.round(zoomScale * 100)}%</span>
                            </div>

                            {/* Main Actions */}
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (uploadedImage) {
                                    setOriginalImage(uploadedImage);
                                    setViewMode('edit');
                                    setShapes([]);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }}
                                className="bg-[#FF5722] hover:bg-[#F4511E] text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl hover:-translate-y-1 active:scale-95 shadow-[#FF5722]/20 whitespace-nowrap"
                              >
                                Cải tạo tiếp từ đây
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (uploadedImage) {
                                    const link = document.createElement('a');
                                    link.href = uploadedImage;
                                    link.download = `igen3-staging-result-${Date.now()}.png`;
                                    link.click();
                                  }
                                }}
                                className="bg-black text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl hover:-translate-y-1 active:scale-95 border border-white/10 whitespace-nowrap"
                              >
                                Tải ảnh kết quả
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mode Indicator */}
                <div className="absolute bottom-6 right-6">
                  <div className="bg-[#00BCD4]/10 backdrop-blur-md border border-[#00BCD4]/20 rounded-lg px-4 py-2 shadow-lg">
                    <span className="text-[#00BCD4] text-[10px] font-bold uppercase tracking-[0.25em]">Living Room Mode</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Card: History Area */}
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-on-surface font-bold text-base">Lịch Sử Sáng Tạo</h3>
            <button 
              onClick={() => setGeneratedResults([])}
              className="flex items-center gap-1.5 text-error text-xs font-bold hover:bg-error/5 px-3 py-1.5 rounded-lg transition-colors group"
            >
              <Icon name="delete" className="text-[18px] group-hover:scale-110 transition-transform" />
              Xóa Tất Cả
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {generatedResults.slice(0, 20).map((img, i) => (
              <div 
                key={i} 
                onClick={() => {
                  setUploadedImage(img);
                  setSliderPos(50);
                  setViewMode('result');
                }}
                className={`aspect-square rounded-2xl overflow-hidden border group relative cursor-pointer shadow-sm hover:shadow-md transition-all ${uploadedImage === img ? 'border-[#00BCD4] border-2 scale-[1.02]' : 'border-outline-variant/20'}`}
              >
                <img 
                  src={img} 
                  alt={`Result ${i}`} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedImage(img);
                      setSliderPos(50);
                      setViewMode('result');
                    }}
                    className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-on-surface hover:bg-primary hover:text-white transition-all shadow-lg"
                  >
                    <Icon name="visibility" className="text-[20px]" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = document.createElement('a');
                      link.href = img;
                      link.download = `igen3-staging-result-${i}.png`;
                      link.click();
                    }}
                    className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-on-surface hover:bg-primary hover:text-white transition-all shadow-lg"
                  >
                    <Icon name="download" className="text-[20px]" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setGeneratedResults(prev => prev.filter((_, index) => index !== i));
                      if (uploadedImage === img) {
                        setUploadedImage(null);
                        setViewMode('edit');
                      }
                    }}
                    className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-error hover:bg-error hover:text-white transition-all shadow-lg"
                  >
                    <Icon name="delete" className="text-[20px]" />
                  </button>
                </div>
              </div>
            ))}
            {generatedResults.length === 0 && [1, 2, 3, 4, 5].map(i => (
              <div key={i} className="aspect-square rounded-2xl bg-surface-container-low/30 border border-outline-variant/10 flex items-center justify-center">
                <Icon name="image_not_supported" className="text-2xl text-slate-300" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
