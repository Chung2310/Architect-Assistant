import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Arrow, Text, Transformer } from 'react-konva';
import useImage from 'use-image';

const StageAny = Stage as any;
const LayerAny = Layer as any;
const KonvaImageAny = KonvaImage as any;
const ArrowAny = Arrow as any;
const TextAny = Text as any;
const TransformerAny = Transformer as any;
import { toast } from 'sonner';
import { Icon } from './Icon';
import { getImageBase64 } from '../lib/renderUtils';

interface ImageAnnotatorProps {
  imageUrl: string;
  onSave: (annotatedImageUrl: string, maskImageUrl: string) => void;
  onCancel: () => void;
}

type Tool = 'select' | 'arrow' | 'text';
type Color = '#ff0000' | '#ffffff' | '#000000' | '#ffff00' | '#0000ff' | '#00ff00';

type Element = 
  | { type: 'arrow', id: string, points: number[], color: string, strokeWidth: number }
  | { type: 'text', id: string, text: string, x: number, y: number, color: string, fontSize: number };

export const ImageAnnotator: React.FC<ImageAnnotatorProps> = ({ imageUrl, onSave, onCancel }) => {
  const [base64Url, setBase64Url] = useState<string>('');
  
  useEffect(() => {
    const loadBase64 = async () => {
      try {
        const data = await getImageBase64(imageUrl);
        setBase64Url(`data:${data.mimeType};base64,${data.base64Data}`);
      } catch (error) {
        console.error("Error loading image for annotation:", error);
        setBase64Url(imageUrl); // Fallback
      }
    };
    loadBase64();
  }, [imageUrl]);

  const [image] = useImage(base64Url || undefined);
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState<Color>('#ff0000');
  const [size, setSize] = useState<number>(4);
  const [elements, setElements] = useState<Element[]>([]);
  const [history, setHistory] = useState<Element[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });
  const [textInputValue, setTextInputValue] = useState('');

  const stageRef = useRef<any>(null);
  const imageLayerRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);

  // Calculate dimensions to fit the screen
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current && image) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        
        if (containerWidth === 0 || containerHeight === 0) return;
        
        const imageRatio = image.width / image.height;
        const containerRatio = containerWidth / containerHeight;
        
        let newWidth, newHeight, newScale;
        
        if (imageRatio > containerRatio) {
          newWidth = containerWidth;
          newHeight = containerWidth / imageRatio;
          newScale = containerWidth / image.width;
        } else {
          newHeight = containerHeight;
          newWidth = containerHeight * imageRatio;
          newScale = containerHeight / image.height;
        }
        
        setDimensions({ width: newWidth, height: newHeight });
        setScale(newScale);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [image]);

  // Handle history
  const saveHistory = (newElements: Element[]) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      setElements(history[historyStep - 1]);
      setSelectedId(null);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      setElements(history[historyStep + 1]);
      setSelectedId(null);
    }
  };

  const handleDelete = () => {
    if (selectedId) {
      const newElements = elements.filter(el => el.id !== selectedId);
      setElements(newElements);
      saveHistory(newElements);
      setSelectedId(null);
    }
  };

  const handleClear = () => {
    setElements([]);
    saveHistory([]);
    setSelectedId(null);
  };

  // Mouse events
  const handleMouseDown = (e: any) => {
    if (editingTextId) return; // Don't start drawing if editing text

    const clickedOnEmpty = e.target === e.target.getStage() || e.target.hasName('bg-image');
    if (clickedOnEmpty) {
      setSelectedId(null);
    }

    if (tool === 'select') return;

    const pos = e.target.getStage().getPointerPosition();
    const x = pos.x / scale;
    const y = pos.y / scale;

    if (tool === 'arrow') {
      setIsDrawing(true);
      const newArrow: Element = {
        type: 'arrow',
        id: Date.now().toString(),
        points: [x, y, x, y],
        color,
        strokeWidth: size
      };
      setElements([...elements, newArrow]);
    } else if (tool === 'text') {
      const newText: Element = {
        type: 'text',
        id: Date.now().toString(),
        text: 'Nhập chữ...',
        x,
        y,
        color,
        fontSize: size * 5 // Scale size for text
      };
      setElements([...elements, newText]);
      saveHistory([...elements, newText]);
      setTool('select');
      setSelectedId(newText.id);
      
      // Start editing immediately
      setEditingTextId(newText.id);
      setTextInputValue('');
      
      // Calculate screen position for textarea
      const stageBox = stageRef.current?.container()?.getBoundingClientRect();
      if (stageBox) {
        setTextInputPos({
          x: stageBox.left + pos.x,
          y: stageBox.top + pos.y
        });
      }
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || tool !== 'arrow') return;

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const x = pos.x / scale;
    const y = pos.y / scale;

    setElements(prev => {
      const lastElement = prev[prev.length - 1];
      if (lastElement.type === 'arrow') {
        const newPoints = [...lastElement.points];
        newPoints[2] = x;
        newPoints[3] = y;
        const updatedElement = { ...lastElement, points: newPoints };
        return [...prev.slice(0, -1), updatedElement];
      }
      return prev;
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && tool === 'arrow') {
      setIsDrawing(false);
      saveHistory(elements);
    }
  };

  // Transformer
  useEffect(() => {
    if (selectedId && tool === 'select') {
      const selectedNode = stageRef.current?.findOne(`#${selectedId}`);
      if (selectedNode) {
        trRef.current?.nodes([selectedNode]);
        trRef.current?.getLayer()?.batchDraw();
      }
    } else {
      trRef.current?.nodes([]);
      trRef.current?.getLayer()?.batchDraw();
    }
  }, [selectedId, tool, elements]);

  // Text Editing
  const handleTextDblClick = (e: any, id: string) => {
    if (tool !== 'select') return;
    
    const textNode = e.target;
    const textElement = elements.find(el => el.id === id) as any;
    
    if (textElement) {
      setEditingTextId(id);
      setTextInputValue(textElement.text === 'Nhập chữ...' ? '' : textElement.text);
      
      const stageBox = stageRef.current?.container()?.getBoundingClientRect();
      const absPos = textNode.getAbsolutePosition();
      
      if (stageBox) {
        setTextInputPos({
          x: stageBox.left + absPos.x,
          y: stageBox.top + absPos.y
        });
      }
    }
  };

  const finishTextEdit = () => {
    if (editingTextId) {
      const finalValue = textInputValue.trim() === '' ? 'Nhập chữ...' : textInputValue;
      const newElements = elements.map(el => 
        el.id === editingTextId ? { ...el, text: finalValue } : el
      );
      setElements(newElements);
      saveHistory(newElements);
      setEditingTextId(null);
    }
  };

  const handleSave = () => {
    // Deselect before saving
    setSelectedId(null);
    trRef.current?.nodes([]);
    setEditingTextId(null);
    
    setTimeout(() => {
      if (stageRef.current) {
        try {
          const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
          
          if (imageLayerRef.current) {
            imageLayerRef.current.hide();
          }
          const maskDataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
          if (imageLayerRef.current) {
            imageLayerRef.current.show();
          }
          
          onSave(dataURL, maskDataURL);
        } catch (error) {
          console.error("Failed to save annotated image (likely due to CORS):", error);
          toast.error("Không thể lưu ảnh do lỗi bảo mật (CORS). Vui lòng thử lại với ảnh khác.");
          onCancel();
        }
      }
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1b26] flex flex-col">
      {/* Toolbar */}
      <div className="h-14 bg-[#24283b] border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setTool('select')}
              className={`p-2 rounded-lg transition-colors ${tool === 'select' ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10'}`}
              title="Chọn"
            >
              <Icon name="near_me" className="text-[20px]" />
            </button>
            <button 
              onClick={() => setTool('arrow')}
              className={`p-2 rounded-lg transition-colors ${tool === 'arrow' ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10'}`}
              title="Vẽ mũi tên"
            >
              <Icon name="north_east" className="text-[20px]" />
            </button>
            <button 
              onClick={() => setTool('text')}
              className={`p-2 rounded-lg transition-colors ${tool === 'text' ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10'}`}
              title="Ghi chú"
            >
              <Icon name="title" className="text-[20px]" />
            </button>
          </div>

          <div className="h-6 w-px bg-white/10"></div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-white/70">Cỡ chữ/nét</span>
            <input 
              type="range" 
              min="2" 
              max="20" 
              value={size} 
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-24 accent-primary"
            />
          </div>

          <div className="h-6 w-px bg-white/10"></div>

          <div className="flex items-center gap-2">
            {(['#ff0000', '#ffffff', '#000000', '#ffff00', '#0000ff', '#00ff00'] as Color[]).map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white' : 'border-transparent hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="h-6 w-px bg-white/10"></div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleUndo}
              disabled={historyStep === 0}
              className="p-2 rounded-lg text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Hoàn tác"
            >
              <Icon name="undo" className="text-[20px]" />
            </button>
            <button 
              onClick={handleRedo}
              disabled={historyStep === history.length - 1}
              className="p-2 rounded-lg text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Làm lại"
            >
              <Icon name="redo" className="text-[20px]" />
            </button>
            <button 
              onClick={handleDelete}
              disabled={!selectedId}
              className="p-2 rounded-lg text-red-400 hover:bg-red-400/20 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Xóa đã chọn"
            >
              <Icon name="delete" className="text-[20px]" />
            </button>
            <button 
              onClick={handleClear}
              className="p-2 rounded-lg text-red-400 hover:bg-red-400/20"
              title="Xóa tất cả"
            >
              <Icon name="delete_sweep" className="text-[20px]" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white/70 hover:bg-white/10 transition-colors"
          >
            Hủy
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Icon name="check_circle" className="text-[18px]" />
            Hoàn Tất
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className="flex-1 overflow-hidden flex items-center justify-center bg-[#1a1b26] relative"
      >
        {!image && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-white/70 font-medium">Đang tải ảnh...</p>
          </div>
        )}
        {image && (
          <StageAny
            width={dimensions.width}
            height={dimensions.height}
            onMouseDown={handleMouseDown}
            onMousemove={handleMouseMove}
            onMouseup={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            ref={stageRef}
            className="shadow-2xl"
          >
            <LayerAny ref={imageLayerRef}>
              <KonvaImageAny 
                image={image} 
                width={dimensions.width} 
                height={dimensions.height} 
                name="bg-image"
              />
            </LayerAny>
            <LayerAny scaleX={scale} scaleY={scale}>
              {elements.map((el) => {
                if (el.type === 'arrow') {
                  return (
                    <ArrowAny
                      key={el.id}
                      id={el.id}
                      points={el.points}
                      stroke={el.color}
                      fill={el.color}
                      strokeWidth={el.strokeWidth}
                      pointerLength={el.strokeWidth * 3}
                      pointerWidth={el.strokeWidth * 3}
                      draggable={tool === 'select'}
                      onClick={(e) => {
                        if (tool === 'select') {
                          e.cancelBubble = true;
                          setSelectedId(el.id);
                        }
                      }}
                      onDragEnd={(e) => {
                        const newElements = elements.map(item => {
                          if (item.id === el.id) {
                            // Update points based on drag
                            const node = e.target;
                            const dx = node.x();
                            const dy = node.y();
                            node.position({ x: 0, y: 0 }); // Reset position
                            
                            const newPoints = [...el.points];
                            newPoints[0] += dx;
                            newPoints[1] += dy;
                            newPoints[2] += dx;
                            newPoints[3] += dy;
                            
                            return { ...item, points: newPoints };
                          }
                          return item;
                        });
                        setElements(newElements);
                        saveHistory(newElements);
                      }}
                    />
                  );
                } else if (el.type === 'text') {
                  return (
                    <TextAny
                      key={el.id}
                      id={el.id}
                      text={el.text}
                      x={el.x}
                      y={el.y}
                      fill={el.color}
                      fontSize={el.fontSize}
                      fontFamily="Inter, sans-serif"
                      fontStyle="bold"
                      draggable={tool === 'select'}
                      onClick={(e) => {
                        if (tool === 'select') {
                          e.cancelBubble = true;
                          setSelectedId(el.id);
                        }
                      }}
                      onDblClick={(e) => handleTextDblClick(e, el.id)}
                      onDragEnd={(e) => {
                        const newElements = elements.map(item => {
                          if (item.id === el.id) {
                            return { ...item, x: e.target.x(), y: e.target.y() };
                          }
                          return item;
                        });
                        setElements(newElements);
                        saveHistory(newElements);
                      }}
                    />
                  );
                }
                return null;
              })}
              <TransformerAny 
                ref={trRef} 
                boundBoxFunc={(oldBox, newBox) => {
                  // limit resize
                  if (newBox.width < 5 || newBox.height < 5) {
                    return oldBox;
                  }
                  return newBox;
                }}
              />
            </LayerAny>
          </StageAny>
        )}

        {/* Text Input Overlay */}
        {editingTextId && (
          <textarea
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                finishTextEdit();
              }
            }}
            onBlur={finishTextEdit}
            autoFocus
            placeholder="Nhập chữ..."
            style={{
              position: 'absolute',
              top: textInputPos.y,
              left: textInputPos.x,
              background: 'rgba(255, 255, 255, 0.8)',
              border: '2px dashed #000',
              color: color,
              fontSize: `${size * 5 * scale}px`,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 'bold',
              outline: 'none',
              resize: 'both',
              overflow: 'hidden',
              lineHeight: 1,
              padding: '4px',
              margin: 0,
              transform: 'translate(-1px, -1px)', // Adjust for border
              minWidth: '100px',
              minHeight: '1.5em',
            }}
            className="z-50 rounded shadow-sm"
          />
        )}
      </div>
    </div>
  );
};
