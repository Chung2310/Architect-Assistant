import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, RotateCw } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtFt = (meters: number) => {
  const totalFt = meters * 3.2808399;
  const ft = Math.floor(totalFt);
  const inch = Math.round((totalFt - ft) * 12);
  return inch === 12 ? `${ft + 1}'0"` : `${ft}'${inch}"`;
};
const fmtSqFt = (sqm: number) => `${Math.round(sqm * 10.76391)} ft²`;

interface Point { x: number; y: number; }
interface Placement {
  id: string;
  type: "door" | "garage_1" | "garage_2" | "garage_3" | "deck" | "porch";
  label: string;
  x: number;
  y: number;
  angle: number;
}

interface ChooseShapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  landWidth: number;
  landLength: number;
  onSelectShape: (
    shapeName: string,
    points: Point[],
    placements: Placement[],
    width: number,
    length: number
  ) => void;
}

// ── Shape Templates (normalized 0→100) ───────────────────────────────────────
const SHAPE_TEMPLATES = [
  { name: "Rectangle", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] },
  { name: "L-Shape (Top-Right)", points: [{ x: 0, y: 0 }, { x: 65, y: 0 }, { x: 65, y: 35 }, { x: 100, y: 35 }, { x: 100, y: 100 }, { x: 0, y: 100 }] },
  { name: "U-Shape", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 70, y: 100 }, { x: 70, y: 80 }, { x: 30, y: 80 }, { x: 30, y: 100 }, { x: 0, y: 100 }] },
  { name: "T-Shape", points: [{ x: 25, y: 0 }, { x: 75, y: 0 }, { x: 75, y: 35 }, { x: 100, y: 35 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 35 }, { x: 25, y: 35 }] },
  { name: "H-Shape", points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 25 }, { x: 70, y: 25 }, { x: 70, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 70, y: 100 }, { x: 70, y: 75 }, { x: 30, y: 75 }, { x: 30, y: 100 }, { x: 0, y: 100 }] },
  { name: "Cross", points: [{ x: 30, y: 0 }, { x: 70, y: 0 }, { x: 70, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 70 }, { x: 70, y: 70 }, { x: 70, y: 100 }, { x: 30, y: 100 }, { x: 30, y: 70 }, { x: 0, y: 70 }, { x: 0, y: 30 }, { x: 30, y: 30 }] },
  { name: "L-Shape (Bottom-Left)", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 35, y: 100 }, { x: 35, y: 65 }, { x: 0, y: 65 }] },
  { name: "L-Shape (Bottom-Right)", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 65 }, { x: 65, y: 65 }, { x: 65, y: 100 }, { x: 0, y: 100 }] },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export const ChooseShapeModal: React.FC<ChooseShapeModalProps> = ({
  isOpen,
  onClose,
  landWidth,
  landLength,
  onSelectShape,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // ── Local resizable dimensions ──────────────────────────────────────────────
  const [localWidth, setLocalWidth] = useState(landWidth);
  const [localLength, setLocalLength] = useState(landLength);
  const [widthInput, setWidthInput] = useState(String(landWidth));
  const [lengthInput, setLengthInput] = useState(String(landLength));

  // ── Drag-to-resize state ───────────────────────────────────────────
  // corner = which corner is being dragged ("tl","tr","bl","br")
  const [resizingCorner, setResizingCorner] = useState<string | null>(null);
  const resizeStart = useRef<{ svgX: number; svgY: number; origW: number; origL: number }>({
    svgX: 0, svgY: 0, origW: 5, origL: 15,
  });

  const svgRef = useRef<SVGSVGElement>(null);

  // Sync inputs ↔ state
  useEffect(() => { setLocalWidth(landWidth); setWidthInput(String(landWidth)); }, [landWidth]);
  useEffect(() => { setLocalLength(landLength); setLengthInput(String(landLength)); }, [landLength]);

  // ── Geometry helpers ─────────────────────────────────────────────────────
  const projectPointToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const len2 = abx * abx + aby * aby;
    if (len2 === 0) return { x: ax, y: ay, dist: Math.sqrt(apx * apx + apy * apy), t: 0 };
    let t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / len2));
    const cx = ax + t * abx, cy = ay + t * aby;
    return { x: cx, y: cy, dist: Math.sqrt((px - cx) ** 2 + (py - cy) ** 2), t };
  };

  const getClosestOnPolygon = (px: number, py: number, poly: Point[], snap: number) => {
    let best = { x: 0, y: 0, angle: 0, dist: Infinity };
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const p = projectPointToSegment(px, py, a.x, a.y, b.x, b.y);
      if (p.dist < best.dist) {
        const abx = b.x - a.x, aby = b.y - a.y;
        const segLen = Math.sqrt(abx * abx + aby * aby);
        let d = p.t * segLen;
        if (snap > 0) d = Math.max(0, Math.min(segLen, Math.round(d / snap) * snap));
        const r = d / segLen;
        best = { x: a.x + abx * r, y: a.y + aby * r, angle: Math.atan2(aby, abx) * (180 / Math.PI), dist: p.dist };
      }
    }
    return best;
  };

  // ── Transform shape ──────────────────────────────────────────────────────
  const getTransformedPoints = useCallback((): Point[] => {
    const tpl = SHAPE_TEMPLATES[selectedIdx];
    if (!tpl) return [];
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    tpl.points.forEach(p => { xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); });
    const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;

    let pts = tpl.points.map(p => {
      let x = flipH ? 2 * cx - p.x : p.x;
      let y = flipV ? 2 * cy - p.y : p.y;
      if (rotation === 90)  { const dx = x - cx, dy = y - cy; x = cx - dy; y = cy + dx; }
      else if (rotation === 180) { x = 2 * cx - x; y = 2 * cy - y; }
      else if (rotation === 270) { const dx = x - cx, dy = y - cy; x = cx + dy; y = cy - dx; }
      return { x, y };
    });

    let txmin = Infinity, txmax = -Infinity, tymin = Infinity, tymax = -Infinity;
    pts.forEach(p => { txmin = Math.min(txmin, p.x); txmax = Math.max(txmax, p.x); tymin = Math.min(tymin, p.y); tymax = Math.max(tymax, p.y); });
    const tw = txmax - txmin, th = tymax - tymin;
    return pts.map(p => ({
      x: tw > 0 ? ((p.x - txmin) / tw) * localWidth : 0,
      y: th > 0 ? ((p.y - tymin) / th) * localLength : 0,
    }));
  }, [selectedIdx, rotation, flipH, flipV, localWidth, localLength]);

  const currentPolygon = getTransformedPoints();

  // Place initial front door on bottom wall
  useEffect(() => {
    if (currentPolygon.length === 0) return;
    let maxY = -Infinity, bottomIdx = 0;
    for (let i = 0; i < currentPolygon.length; i++) {
      const mid = (currentPolygon[i].y + currentPolygon[(i + 1) % currentPolygon.length].y) / 2;
      if (mid > maxY) { maxY = mid; bottomIdx = i; }
    }
    const a = currentPolygon[bottomIdx], b = currentPolygon[(bottomIdx + 1) % currentPolygon.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    if (placements.length > 0) {
      const snap = 0.1524;
      setPlacements(prev => prev.map(p => {
        const { x, y, angle } = getClosestOnPolygon(p.x, p.y, currentPolygon, snap);
        return { ...p, x, y, angle };
      }));
    } else {
      setPlacements([{ id: "door", type: "door", label: "Front door", x: a.x + dx * 0.5, y: a.y + dy * 0.5, angle: Math.atan2(dy, dx) * (180 / Math.PI) }]);
    }
  }, [selectedIdx, rotation, flipH, flipV, localWidth, localLength]);

  if (!isOpen) return null;

  // ── SVG viewport ──────────────────────────────────────────────────────────
  const padding = 40;
  const renderW = 400 - padding * 2;
  const renderH = 350 - padding * 2;
  const scale = Math.min(renderW / localWidth, renderH / localLength);
  const offsetX = 200 - (localWidth * scale) / 2;
  const offsetY = 175 - (localLength * scale) / 2;
  const shapeW = localWidth * scale;
  const shapeH = localLength * scale;

  const toSvg = (p: Point) => ({ x: offsetX + p.x * scale, y: offsetY + p.y * scale });
  const fromSvg = (sx: number, sy: number) => ({ x: (sx - offsetX) / scale, y: (sy - offsetY) / scale });

  const getArea = () => {
    if (currentPolygon.length === 0) return 0;
    let area = 0;
    for (let i = 0; i < currentPolygon.length; i++) {
      const p1 = currentPolygon[i], p2 = currentPolygon[(i + 1) % currentPolygon.length];
      area += (p1.x + p2.x) * (p1.y - p2.y);
    }
    return Math.abs(area / 2);
  };

  const getCentroid = () => {
    if (currentPolygon.length === 0) return { x: 200, y: 175 };
    let sx = 0, sy = 0;
    currentPolygon.forEach(p => { sx += p.x; sy += p.y; });
    return toSvg({ x: sx / currentPolygon.length, y: sy / currentPolygon.length });
  };

  const centroid = getCentroid();
  const area = getArea();

  // ── SVG event helpers ─────────────────────────────────────────────────────
  const getSvgPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * 400,
      y: ((clientY - rect.top) / rect.height) * 350,
    };
  };

  // ── Placement drag ────────────────────────────────────────────────────────
  const handleStartDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (resizingCorner) return;
    setDraggedId(id);
  };

  // ── Resize drag start ───────────────────────────────────────────
  const handleCornerResizeStart = (corner: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pt = getSvgPoint(e);
    resizeStart.current = { svgX: pt.x, svgY: pt.y, origW: localWidth, origL: localLength };
    setResizingCorner(corner);
  };

  // ── Mouse/Touch move ──────────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const pt = getSvgPoint(e);

    // Proportional corner resize
    if (resizingCorner) {
      const dx = pt.x - resizeStart.current.svgX;
      const dy = pt.y - resizeStart.current.svgY;
      const signX = resizingCorner.includes("r") ? 1 : -1;
      const signY = resizingCorner.includes("b") ? 1 : -1;
      const newW = Math.max(2, Math.min(50, Math.round((resizeStart.current.origW + (dx * signX) / scale) * 10) / 10));
      const newL = Math.max(2, Math.min(80, Math.round((resizeStart.current.origL + (dy * signY) / scale) * 10) / 10));
      setLocalWidth(newW);
      setLocalLength(newL);
      setWidthInput(String(newW));
      setLengthInput(String(newL));
      return;
    }

    // Placement drag
    if (!draggedId) return;
    const real = fromSvg(pt.x, pt.y);
    const snap = 0.1524;
    const { x, y, angle } = getClosestOnPolygon(real.x, real.y, currentPolygon, snap);
    setPlacements(prev => prev.map(p => p.id === draggedId ? { ...p, x, y, angle } : p));
  };

  const handleMouseUp = () => {
    setDraggedId(null);
    setResizingCorner(null);
  };

  // ── Toggle placement items ────────────────────────────────────────────────
  const handleTogglePlacement = (type: Placement["type"], label: string) => {
    if (placements.find(p => p.type === type)) {
      setPlacements(prev => prev.filter(p => p.type !== type));
      return;
    }
    const a = currentPolygon[0], b = currentPolygon[1 % currentPolygon.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const np: Placement = { id: `${type}_${Date.now()}`, type, label, x: a.x + dx * 0.5, y: a.y + dy * 0.5, angle: Math.atan2(dy, dx) * (180 / Math.PI) };
    setPlacements(prev => [...prev, np]);
    setDraggedId(np.id);
  };

  // ── Confirm ──────────────────────────────────────────────────────────────
  const handleUseShape = () => {
    const name = SHAPE_TEMPLATES[selectedIdx]?.name || "Custom";
    onSelectShape(name, currentPolygon, placements, localWidth, localLength);
  };

  // Corner handle positions
  const corners = [
    { id: "tl", cx: offsetX,          cy: offsetY,          cursor: "nwse-resize" },
    { id: "tr", cx: offsetX + shapeW, cy: offsetY,          cursor: "nesw-resize" },
    { id: "bl", cx: offsetX,          cy: offsetY + shapeH, cursor: "nesw-resize" },
    { id: "br", cx: offsetX + shapeW, cy: offsetY + shapeH, cursor: "nwse-resize" },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-[#141415] border border-[#2d2d30] rounded-2xl w-full max-w-[700px] h-[92vh] max-h-[780px] flex flex-col shadow-2xl overflow-hidden text-slate-100 font-sans"
        onClick={() => {}}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2d2d30] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-bold tracking-wide text-slate-100">Choose Shape</h2>
            {/* Dimension inputs */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">W:</span>
              <input
                type="number"
                value={widthInput}
                min={2} max={50} step={0.5}
                onChange={e => {
                  setWidthInput(e.target.value);
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 2 && v <= 50) setLocalWidth(v);
                }}
                className="w-16 bg-[#1d1d1f] border border-[#2d2d30] rounded-lg px-2 py-1 text-[#00B5CD] font-bold focus:outline-none focus:border-[#00B5CD] text-center"
              />
              <span className="text-slate-500">m × L:</span>
              <input
                type="number"
                value={lengthInput}
                min={2} max={80} step={0.5}
                onChange={e => {
                  setLengthInput(e.target.value);
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 2 && v <= 80) setLocalLength(v);
                }}
                className="w-16 bg-[#1d1d1f] border border-[#2d2d30] rounded-lg px-2 py-1 text-[#00B5CD] font-bold focus:outline-none focus:border-[#00B5CD] text-center"
              />
              <span className="text-slate-500">m</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#252526] rounded-lg text-slate-400 hover:text-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-[#0b0b0c] relative flex items-center justify-center p-4 select-none">
          <svg
            ref={svgRef}
            viewBox="0 0 400 350"
            className="w-full h-full max-w-[450px] max-h-[350px] touch-none"
            style={{ cursor: resizingCorner ? "nwse-resize" : draggedId ? "grabbing" : "default" }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          >
            <defs>
              <pattern id="dot-grid-csm" width="16" height="16" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#2d2d30" />
              </pattern>
            </defs>
            <rect width="400" height="350" fill="url(#dot-grid-csm)" />

            {/* Shape polygon */}
            {currentPolygon.length > 0 && (
              <polygon
                points={currentPolygon.map(p => { const s = toSvg(p); return `${s.x},${s.y}`; }).join(" ")}
                fill="#161617"
                stroke="#00B5CD"
                strokeWidth="2.5"
                className="transition-all duration-300"
              />
            )}

            {/* Centroid label */}
            <g transform={`translate(${centroid.x}, ${centroid.y})`} className="pointer-events-none">
              <text textAnchor="middle" y="-6" className="text-[11px] font-semibold fill-slate-400 tracking-wide">Living space</text>
              <text textAnchor="middle" y="12" className="text-[14px] font-bold fill-[#00B5CD]">{fmtSqFt(area)}</text>
              <text textAnchor="middle" y="26" className="text-[10px] fill-slate-500">{area.toFixed(1)} m²</text>
            </g>

            {/* Dimension annotations */}
            {currentPolygon.length > 0 && currentPolygon.map((a, idx) => {
              const b = currentPolygon[(idx + 1) % currentPolygon.length];
              const aS = toSvg(a), bS = toSvg(b);
              const midx = (aS.x + bS.x) / 2, midy = (aS.y + bS.y) / 2;
              const dx = bS.x - aS.x, dy = bS.y - aS.y;
              const n1 = { x: -dy, y: dx }, n2 = { x: dy, y: -dx };
              const vx = midx - centroid.x, vy = midy - centroid.y;
              const chosen = (n1.x * vx + n1.y * vy > 0) ? n1 : n2;
              const len = Math.sqrt(chosen.x ** 2 + chosen.y ** 2);
              const tx = midx + (chosen.x / len) * 15, ty = midy + (chosen.y / len) * 15;
              const realLen = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
              return (
                <g key={`dim-${idx}`} className="pointer-events-none">
                  <text x={tx} y={ty + 3} textAnchor="middle" className="text-[9px] fill-[#00B5CD] font-medium">{fmtFt(realLen)}</text>
                </g>
              );
            })}

            {/* Dimension labels on bounding box edges */}
            {/* Width label (top) */}
            <g className="pointer-events-none">
              <text x={offsetX + shapeW / 2} y={offsetY - 8} textAnchor="middle" className="text-[10px] fill-slate-400 font-bold">
                {localWidth}m
              </text>
              {/* Length label (left) */}
              <text
                x={offsetX - 10}
                y={offsetY + shapeH / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(-90, ${offsetX - 10}, ${offsetY + shapeH / 2})`}
                className="text-[10px] fill-slate-400 font-bold"
              >
                {localLength}m
              </text>
            </g>

            {/* ── CORNER RESIZE HANDLES ──────────────────── */}
            {corners.map(corner => (
              <g key={corner.id} style={{ cursor: corner.cursor }}
                onMouseDown={(e) => handleCornerResizeStart(corner.id, e)}>
                {/* Invisible large hit area */}
                <circle cx={corner.cx} cy={corner.cy} r={12} fill="transparent" />
                {/* Visible dot */}
                <circle
                  cx={corner.cx} cy={corner.cy} r={5}
                  fill={resizingCorner === corner.id ? "#00B5CD" : "#1a1a1b"}
                  stroke="#00B5CD"
                  strokeWidth="2"
                  className="transition-colors"
                />
              </g>
            ))}

            {/* Placements */}
            {placements.map(p => {
              const svgPos = toSvg(p);
              let color = "#00B5CD", w = 24, h = 8, isDashed = false, fillOpacity = 0.95;
              if (p.type.startsWith("garage")) { color = "#64748b"; w = p.type === "garage_3" ? 54 : p.type === "garage_2" ? 42 : 30; h = 10; fillOpacity = 0.85; }
              else if (p.type === "deck" || p.type === "porch") { color = "#10b981"; w = 40; h = 7; isDashed = true; fillOpacity = 0.25; }
              return (
                <g key={p.id} transform={`translate(${svgPos.x}, ${svgPos.y}) rotate(${p.angle})`}
                  className="cursor-move" onMouseDown={(e) => handleStartDrag(p.id, e)} onTouchStart={(e) => handleStartDrag(p.id, e)}>
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={color} fillOpacity={fillOpacity}
                    stroke={color} strokeWidth={isDashed ? "1" : "0"} strokeDasharray={isDashed ? "3,2" : undefined} rx="1.5" />
                  {p.type === "door" && <path d="M -6 -4 A 8 8 0 0 1 2 -4" fill="none" stroke="#00B5CD" strokeWidth="1" strokeDasharray="2,1" />}
                  <text x="0" y={h + 7} textAnchor="middle" transform={`rotate(${-p.angle})`} className="text-[8px] font-bold fill-slate-300 pointer-events-none">{p.label}</text>
                </g>
              );
            })}
          </svg>

          {/* Floating rotate/flip buttons */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
            <button onClick={() => setRotation(r => (r + 90) % 360)}
              className="w-8 h-8 rounded-full bg-[#171718]/85 backdrop-blur border border-[#2d2d30] flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#252526] transition-all" title="Rotate">
              <RotateCw className="w-4 h-4" />
            </button>
            <button onClick={() => setFlipH(h => !h)}
              className="w-8 h-8 rounded-full bg-[#171718]/85 backdrop-blur border border-[#2d2d30] flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#252526] transition-all" title="Flip Horizontal">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round"><line x1="2" y1="12" x2="22" y2="12" /><path d="M7 6l-5 5 5 5" /><path d="M17 6l5 5-5 5" /></svg>
            </button>
            <button onClick={() => setFlipV(v => !v)}
              className="w-8 h-8 rounded-full bg-[#171718]/85 backdrop-blur border border-[#2d2d30] flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#252526] transition-all" title="Flip Vertical">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22" /><path d="M6 7l5-5 5 5" /><path d="M6 17l5 5 5-5" /></svg>
            </button>
          </div>

          {/* Resize hint */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-600 pointer-events-none">
            Drag <span className="text-[#00B5CD]">→</span> right handle to resize width · <span className="text-[#00B5CD]">↓</span> bottom handle to resize length
          </div>
        </div>

        {/* Placement toolbar */}
        <div className="px-6 py-3 bg-[#111112] border-t border-b border-[#2d2d30] flex flex-wrap items-center justify-between gap-4 text-xs z-20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Place:</span>
            <button onClick={() => handleTogglePlacement("door", "Front door")}
              className={`px-3 py-1.5 rounded-lg border font-bold ${placements.some(p => p.type === "door") ? "bg-[#00B5CD]/10 border-[#00B5CD] text-[#00B5CD]" : "bg-[#1d1d1f] border-[#2d2d30] text-slate-400 hover:bg-[#252526]"}`}>
              Front door
            </button>
            <button onClick={() => handleTogglePlacement("garage_1", "1-car garage")}
              className={`px-3 py-1.5 rounded-lg border font-bold ${placements.some(p => p.type === "garage_1") ? "bg-slate-800 border-slate-600 text-slate-300" : "bg-[#1d1d1f] border-[#2d2d30] text-slate-400 hover:bg-[#252526]"}`}>
              Garage (1)
            </button>
            <button onClick={() => handleTogglePlacement("garage_2", "2-car garage")}
              className={`px-3 py-1.5 rounded-lg border font-bold ${placements.some(p => p.type === "garage_2") ? "bg-slate-800 border-slate-600 text-slate-300" : "bg-[#1d1d1f] border-[#2d2d30] text-slate-400 hover:bg-[#252526]"}`}>
              Garage (2)
            </button>
            <button onClick={() => handleTogglePlacement("deck", "Deck / balcony")}
              className={`px-3 py-1.5 rounded-lg border font-bold ${placements.some(p => p.type === "deck") ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-400" : "bg-[#1d1d1f] border-[#2d2d30] text-slate-400 hover:bg-[#252526]"}`}>
              Deck
            </button>
            <button onClick={() => handleTogglePlacement("porch", "Front porch")}
              className={`px-3 py-1.5 rounded-lg border font-bold ${placements.some(p => p.type === "porch") ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-400" : "bg-[#1d1d1f] border-[#2d2d30] text-slate-400 hover:bg-[#252526]"}`}>
              Porch
            </button>
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            {localWidth}m × {localLength}m = <span className="text-[#00B5CD]">{(localWidth * localLength).toFixed(0)} m²</span>
          </div>
        </div>

        {/* Shape grid */}
        <div className="p-4 bg-[#141415] space-y-2">
          <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] px-2 block">Select Base Layout Shape</span>
          <div className="flex gap-3 overflow-x-auto py-1 px-2 scrollbar-thin">
            {SHAPE_TEMPLATES.map((item, idx) => {
              const isSelected = selectedIdx === idx;
              return (
                <button key={idx} onClick={() => setSelectedIdx(idx)}
                  className={`w-14 h-14 shrink-0 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer ${isSelected ? "border-[#00B5CD] bg-[#00B5CD]/10 text-[#00B5CD]" : "border-[#2d2d30] bg-[#171718] text-slate-500 hover:border-slate-700 hover:text-slate-300"}`}
                  title={item.name}>
                  <svg viewBox="0 0 120 120" className="w-10 h-10">
                    <polygon points={item.points.map(p => `${10 + p.x * 0.8},${10 + p.y * 0.8}`).join(" ")}
                      fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2d2d30] bg-[#111112] flex items-center justify-center gap-4">
          <button onClick={onClose} className="px-8 py-2.5 rounded-full border border-[#2d2d30] hover:bg-slate-800 text-slate-300 font-bold text-xs">
            Cancel
          </button>
          <button onClick={handleUseShape} className="px-8 py-2.5 rounded-full bg-[#00B5CD] hover:bg-[#00B5CD]/90 text-white font-bold text-xs shadow-lg shadow-[#00B5CD]/10">
            Use this shape
          </button>
        </div>
      </div>
    </div>
  );
};
