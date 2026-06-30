import React, { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Rect, Text, Line, Group, Circle, Wedge } from "react-konva";
import {
  Download, Sparkles, ZoomIn, ZoomOut, RotateCw,
  Send, CheckCircle2, Circle as LucideCircle,
  Maximize2, Plus, Minus, ChevronLeft, Trash2,
  X, Search, Check, ChevronDown, ArrowLeft, Settings2
} from "lucide-react";

import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { apiClient, ApiResponse } from "../../services/apiClient";
import { useAuth } from "../../context/useAuth";
import {
  getAIClient,
  generateContentWithRetry,
  safeJsonParse,
  checkUserCredits,
} from "../../lib/renderUtils";
import { ChooseShapeModal } from "./ChooseShapeModal";
import { ChooseRoomsModal } from "./ChooseRoomsModal";
import { FloorPlan3DViewer } from "./FloorPlan3DViewer";

// ── Constants ──────────────────────────────────────────────────────────────
const METER_TO_PX = 48;
const _GRID_SIZE = 0.5;

// ── Types ──────────────────────────────────────────────────────────────────
export interface FurnitureItem {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  style?: string;
  material?: string;
  color?: string;
}

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  furniture?: FurnitureItem[];
  style?: string;
  finishes?: {
    flooring?: string;
    walls?: string;
    ceiling?: string;
    doors?: string;
    windows?: string;
  };
}

export interface Opening {
  id: string;
  type: "door" | "window";
  x: number;
  y: number;
  w: number;
  rotation: number;
}

export interface FloorPlanData {
  rooms: Room[];
  openings: Opening[];
  architectNotes?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type GatherStep =
  | "floors"
  | "area"
  | "shape"
  | "rooms"
  | "extras"
  | "done";

interface GatherInfo {
  floors?: number;
  area?: string;
  shape?: string;
  rooms?: string;
  extras?: string;
  projectType?: string;
  style?: string;
  landWidth?: number;
  landLength?: number;
  roomSelection?: Record<number, { name: string; count: number }[]>;
}

const CHECKLIST_STEPS: { key: GatherStep; label: string }[] = [
  { key: "floors", label: "Số tầng" },
  { key: "area", label: "Diện tích mặt bằng" },
  { key: "shape", label: "Hình dạng mặt bằng" },
  { key: "rooms", label: "Phòng yêu cầu" },
  { key: "extras", label: "Yêu cầu bổ sung" },
];

// ── Helper: parse user text for numbers ──────────────────────────────────
function _extractDimensions(text: string): { w?: number; l?: number } {
  const matched = text.match(/(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)/);
  if (matched) return { w: parseFloat(matched[1]), l: parseFloat(matched[2]) };
  const single = text.match(/(\d+(?:\.\d+)?)/);
  if (single) {
    const n = parseFloat(single[1]);
    return { w: n, l: n * 3 };
  }
  return {};
}

// ── Room color palette ───────────────────────────────────────────────────
const ROOM_COLORS: Record<string, string> = {
  "Phòng khách": "#3b82f6",
  "Phòng ngủ": "#8b5cf6",
  "Phòng bếp": "#f59e0b",
  "Phòng ăn": "#f97316",
  "Toilet": "#10b981",
  "WC": "#10b981",
  "Hành lang": "#6b7280",
  "Gara": "#64748b",
  "Sân vườn": "#22c55e",
  default: "#60a5fa",
};

function getRoomColor(name: string): string {
  for (const [k, v] of Object.entries(ROOM_COLORS)) {
    if (name.includes(k)) return v;
  }
  return ROOM_COLORS.default;
}

const FURNITURE_METADATA: Record<string, {
  name: string;
  materials: { name: string; value: string; color?: string }[];
  styles: { name: string; value: string }[];
}> = {
  living_sofa: {
    name: "Sofa Phòng Khách",
    materials: [
      { name: "Vải Nỉ Xám", value: "grey_fabric", color: "#94a3b8" },
      { name: "Da Bò Nâu", value: "brown_leather", color: "#854d0e" },
      { name: "Da Thật Đen", value: "black_leather", color: "#1e293b" },
      { name: "Nhung Xanh Lá", value: "green_velvet", color: "#166534" }
    ],
    styles: [
      { name: "Hiện Đại (Modern)", value: "modern" },
      { name: "Bắc Âu (Scandinavian)", value: "scandinavian" },
      { name: "Cổ Điển (Classic)", value: "classic" }
    ]
  },
  living_tv: {
    name: "Kệ Tivi",
    materials: [
      { name: "Gỗ Sồi Tự Nhiên", value: "natural_oak", color: "#d6c2a4" },
      { name: "Gỗ Óc Chó", value: "walnut", color: "#5c4033" },
      { name: "MDF Sơn Trắng", value: "white_mdf", color: "#f8fafc" },
      { name: "Kính & Thép Đen", value: "glass_steel", color: "#334155" }
    ],
    styles: [
      { name: "Treo tường tối giản", value: "wall_mounted" },
      { name: "Kệ tủ bệt dài", value: "floor_cabinet" }
    ]
  },
  bed_bed: {
    name: "Giường Ngủ",
    materials: [
      { name: "Vải Cotton Trắng", value: "white_cotton", color: "#f8fafc" },
      { name: "Da Bọc Đầu Giường", value: "padded_leather", color: "#78350f" },
      { name: "Gỗ Tự Nhiên", value: "wood_frame", color: "#a16207" }
    ],
    styles: [
      { name: "Giường bọc nệm hiện đại", value: "padded" },
      { name: "Giường chân gỗ Scandinavian", value: "wooden" },
      { name: "Giường bệt kiểu Nhật", value: "tatami" }
    ]
  },
  bed_wardrobe: {
    name: "Tủ Quần Áo",
    materials: [
      { name: "Gỗ Sồi Natural", value: "oak", color: "#eab308" },
      { name: "Cánh Kính Trượt", value: "glass_sliding", color: "#38bdf8" },
      { name: "Tủ Âm Tường Trắng", value: "white_built_in", color: "#ffffff" }
    ],
    styles: [
      { name: "Cánh mở truyền thống", value: "hinged" },
      { name: "Cánh lùa hiện đại", value: "sliding" }
    ]
  },
  dining_table: {
    name: "Bàn Ăn",
    materials: [
      { name: "Đá Cẩm Thạch Trắng", value: "white_marble", color: "#f1f5f9" },
      { name: "Gỗ Óc Chó", value: "walnut", color: "#78350f" },
      { name: "Kính Cường Lực", value: "tempered_glass", color: "#0ea5e9" }
    ],
    styles: [
      { name: "Bàn chữ nhật hiện đại", value: "rectangular" },
      { name: "Bàn tròn gia đình", value: "round" }
    ]
  },
  kitchen_counter: {
    name: "Bàn Bếp / Hệ Tủ Bếp",
    materials: [
      { name: "Đá Granite Đen", value: "black_granite", color: "#0f172a" },
      { name: "Mặt Gỗ Sồi chống ẩm", value: "oak_wood", color: "#ca8a04" },
      { name: "Đá Thạch Anh Trắng", value: "white_quartz", color: "#f8fafc" }
    ],
    styles: [
      { name: "Bếp chữ I nhỏ gọn", value: "i_shape" },
      { name: "Bếp chữ L tiện nghi", value: "l_shape" }
    ]
  },
  wc_bathtub: {
    name: "Bồn Tắm",
    materials: [
      { name: "Sứ Trắng Cao Cấp", value: "white_porcelain", color: "#ffffff" },
      { name: "Đá Tự Nhiên Xám", value: "grey_stone", color: "#64748b" }
    ],
    styles: [
      { name: "Bồn tắm nằm độc lập", value: "freestanding" },
      { name: "Bồn tắm massage sục", value: "jacuzzi" }
    ]
  },
  garage_car: {
    name: "Xe Ô tô (Trang Trí)",
    materials: [
      { name: "Đỏ Thể Thao", value: "red", color: "#ef4444" },
      { name: "Đen Lịch Lãm", value: "black", color: "#0f172a" },
      { name: "Trắng Ngọc Trai", value: "white", color: "#ffffff" }
    ],
    styles: [
      { name: "Sedan gia đình", value: "sedan" },
      { name: "SUV thể thao đa dụng", value: "suv" }
    ]
  }
};

const ALL_MATERIALS = [
  // Metal
  { category: "Metal", name: "Metal - Zinc", value: "metal_zinc", color: "#373a3c" },
  { category: "Metal", name: "Metal - Stainless Steel", value: "metal_steel", color: "#b0b5b9" },
  { category: "Metal", name: "Metal - Gold", value: "metal_gold", color: "#d4af37" },
  { category: "Metal", name: "Metal - Bronze", value: "metal_bronze", color: "#a87c43" },
  // Wood
  { category: "Wood", name: "Wood - Natural Oak", value: "wood_oak", color: "#e3c29b" },
  { category: "Wood", name: "Wood - Dark Walnut", value: "wood_walnut", color: "#543e2b" },
  { category: "Wood", name: "Wood - Painted White", value: "wood_white", color: "#f8fafc" },
  // Fabric
  { category: "Fabric", name: "Fabric - Grey Linen", value: "fabric_grey", color: "#94a3b8" },
  { category: "Fabric", name: "Fabric - Velvet Green", value: "fabric_green", color: "#1b4d3e" },
  { category: "Fabric", name: "Fabric - Beige Cotton", value: "fabric_beige", color: "#f5f5dc" },
  // Stone
  { category: "Stone", name: "Stone - White Marble", value: "stone_marble", color: "#e2e8f0" },
  { category: "Stone", name: "Stone - Black Granite", value: "stone_granite", color: "#0f172a" },
];

const ALL_COLOURS = [
  { name: "Gold Yellow", value: "#eab308" },
  { name: "Emerald Green", value: "#10b981" },
  { name: "Ocean Blue", value: "#0ea5e9" },
  { name: "Crimson Red", value: "#ef4444" },
  { name: "Charcoal Black", value: "#1e293b" },
  { name: "Soft White", value: "#f8fafc" },
  { name: "Warm Beige", value: "#faf5ff" },
  { name: "Salmon Pink", value: "#f43f5e" }
];

function getFurnitureColor(item: FurnitureItem): string {
  if (item.color) {
    return item.color;
  }
  if (item.material) {
    const mat = ALL_MATERIALS.find((m) => m.value === item.material);
    if (mat) return mat.color;
    
    // Fallback if it is a local category-specific material value
    // e.g. "red" or "black" or "white_porcelain"
    if (item.material === "red") return "#ef4444";
    if (item.material === "black") return "#0f172a";
    if (item.material === "white" || item.material === "white_porcelain" || item.material === "white_cotton") return "#ffffff";
    if (item.material === "grey_fabric") return "#94a3b8";
    if (item.material === "brown_leather") return "#854d0e";
    if (item.material === "black_leather") return "#1e293b";
    if (item.material === "green_velvet") return "#166534";
    if (item.material === "natural_oak" || item.material === "oak") return "#d6c2a4";
    if (item.material === "walnut") return "#5c4033";
    if (item.material === "white_mdf") return "#f8fafc";
    if (item.material === "glass_steel") return "#334155";
    if (item.material === "padded_leather") return "#78350f";
    if (item.material === "wood_frame") return "#a16207";
    if (item.material === "glass_sliding") return "#38bdf8";
    if (item.material === "white_built_in") return "#ffffff";
    if (item.material === "white_marble") return "#f1f5f9";
    if (item.material === "tempered_glass") return "#0ea5e9";
    if (item.material === "black_granite") return "#0f172a";
    if (item.material === "oak_wood") return "#ca8a04";
    if (item.material === "white_quartz") return "#f8fafc";
    if (item.material === "grey_stone") return "#64748b";
  }
  return "white";
}

const ROOM_STYLES = [
  {
    name: "Rustic",
    value: "Rustic",
    color: "#f5ebe0",
    image: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=300&auto=format&fit=crop&q=80"
  },
  {
    name: "Traditional",
    value: "Traditional",
    color: "#faf5ff",
    image: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=300&auto=format&fit=crop&q=80"
  },
  {
    name: "Mid-century Modern",
    value: "Mid-century Modern",
    color: "#ffedd5",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300&auto=format&fit=crop&q=80"
  },
  {
    name: "Scandinavian",
    value: "Scandinavian",
    color: "#f1f5f9",
    image: "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=300&auto=format&fit=crop&q=80"
  },
  {
    name: "Modern",
    value: "Modern",
    color: "#e2e8f0",
    image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=300&auto=format&fit=crop&q=80"
  },
  {
    name: "Farmhouse",
    value: "Farmhouse",
    color: "#fef3c7",
    image: "https://images.unsplash.com/photo-1615876234886-fd9a39fda97f?w=300&auto=format&fit=crop&q=80"
  },
  {
    name: "Coastal",
    value: "Coastal",
    color: "#f0f9ff",
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=300&auto=format&fit=crop&q=80"
  },
  {
    name: "Industrial",
    value: "Industrial",
    color: "#cbd5e1",
    image: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=300&auto=format&fit=crop&q=80"
  }
];

const ROOM_FLOORINGS = [
  { name: "Terrazzo", value: "Terrazzo", color: "#cbd5e1" }, // Speckled light blue-grey
  { name: "Concrete - Light", value: "Concrete - Light", color: "#e2e8f0" },
  { name: "Concrete - Dark", value: "Concrete - Dark", color: "#94a3b8" },
  { name: "White Wood Panelling", value: "White Wood Panelling", color: "#f8fafc" },
  { name: "Oak Wood", value: "Oak Wood", color: "#e3c29b" }
];

const ROOM_WALLS = [
  { name: "Terracotta Fan Tile", value: "Terracotta Fan Tile", color: "#c2410c" },
  { name: "White Plaster", value: "White Plaster", color: "#ffffff" },
  { name: "Exposed Brick", value: "Exposed Brick", color: "#b91c1c" },
  { name: "Concrete Render", value: "Concrete Render", color: "#cbd5e1" }
];

const ROOM_CEILINGS = [
  { name: "Soft White", value: "#ffffff", color: "#ffffff" },
  { name: "Raw Concrete", value: "#cbd5e1", color: "#cbd5e1" },
  { name: "Wood Beams", value: "#ca8a04", color: "#ca8a04" }
];

const ROOM_DOORS = [
  { name: "Soft White", value: "#ffffff", color: "#ffffff" },
  { name: "Natural Oak", value: "#ca8a04", color: "#ca8a04" },
  { name: "Matte Black", value: "#1e293b", color: "#1e293b" }
];

const ROOM_WINDOWS = [
  { name: "Soft White", value: "#ffffff", color: "#ffffff" },
  { name: "Matte Black", value: "#1e293b", color: "#1e293b" },
  { name: "Anodized Silver", value: "#cbd5e1", color: "#cbd5e1" }
];

function getRoomFlooringColor(room: Room): string {
  const flooring = room.finishes?.flooring;
  if (flooring) {
    const matched = ROOM_FLOORINGS.find((f) => f.value === flooring);
    return matched ? matched.color : flooring;
  }
  if (room.style) {
    const matchedStyle = ROOM_STYLES.find((s) => s.value === room.style);
    if (matchedStyle) return matchedStyle.color;
  }
  return "white";
}

// ══════════════════════════════════════════════════════════════════════════
export const FloorPlanEditor: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Chat state ──────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào! Tôi sẽ giúp bạn tạo bản vẽ mặt bằng với AI.\n\nHãy bắt đầu — **Công trình của bạn có bao nhiêu tầng?**",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Gather state ────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<GatherStep>("floors");
  const [completedSteps, setCompletedSteps] = useState<Set<GatherStep>>(new Set());
  const [gatherInfo, setGatherInfo] = useState<GatherInfo>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [isEditingName, setIsEditingName] = useState(false);

  // ── Canvas & floor plan state ───────────────────────────────────────────
  const [floorPlan, setFloorPlan] = useState<FloorPlanData | null>(null);
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [floorPlans, setFloorPlans] = useState<FloorPlanData[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageRef = useRef<any>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [selectedFurnitureRoomId, setSelectedFurnitureRoomId] = useState<string | null>(null);
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  const [renderResult, setRenderResult] = useState<string | null>(null);
  const [isRendering3D, setIsRendering3D] = useState(false);
  const [showShapeModal, setShowShapeModal] = useState(false);
  const [showRoomsModal, setShowRoomsModal] = useState(false);
  const [autoRenderPending, setAutoRenderPending] = useState(false);
  const [wallThickness, setWallThickness] = useState<number>(100); // 100mm (4 inches)
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState<"flooring" | "walls" | "ceiling" | "doors" | "windows" | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [showFinishPopup, setShowFinishPopup] = useState(false);
  const [finishTab, setFinishTab] = useState<"material" | "colour">("material");
  const [searchMaterial, setSearchMaterial] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeFinishTarget, setActiveFinishTarget] = useState<{
    type: "style" | "flooring" | "walls" | "ceiling" | "doors" | "windows";
    roomId: string;
  } | null>(null);
  const [finishes, setFinishes] = useState<Record<string, { type: "material" | "color"; value: string; name: string }>>({
    flooring: { type: "material", value: "natural_oak", name: "Natural Oak" },
    walls: { type: "color", value: "#ffffff", name: "Trắng" },
    ceiling: { type: "color", value: "#ffffff", name: "Trắng" },
    doors: { type: "material", value: "natural_oak", name: "Natural Oak" },
    windows: { type: "color", value: "#1c1c1e", name: "Đen" },
  });

  // ── Visualize / Camera states ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"layout" | "visualize">("layout");
  const [selectedCameraRoomId, setSelectedCameraRoomId] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Record<string, {
    x: number;
    y: number;
    rotation: number;
    fov: number;
    aspectRatio: string;
    prompt: string;
  }>>({});
  const [sidebarTab, setSidebarTab] = useState<"scene" | "renders">("scene");
  const [isGeneratingPromptIdea, setIsGeneratingPromptIdea] = useState(false);
  const capture3DRef = useRef<(() => string) | null>(null);

  // ── Undo/Redo history ────────────────────────────────────────────────────
  const [historyStack, setHistoryStack] = useState<FloorPlanData[]>([]);
  const [redoStack, setRedoStack] = useState<FloorPlanData[]>([]);
  const [showDimensions, setShowDimensions] = useState(true);

  const getSelectedFurniture = () => {
    if (!selectedFurnitureId || !floorPlan) return null;
    for (const room of floorPlan.rooms) {
      const found = (room.furniture || []).find((f) => f.id === selectedFurnitureId);
      if (found) return { furniture: found, room };
    }
    return null;
  };
  const selectedFurnitureData = getSelectedFurniture();

  const filteredMaterials = ALL_MATERIALS.filter((mat) => {
    const matchesCategory = selectedCategory === "all" || mat.category === selectedCategory;
    const matchesSearch = mat.name.toLowerCase().includes(searchMaterial.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Initialize cameras for rooms ─────────────────────────────────────────
  useEffect(() => {
    if (floorPlan) {
      const updatedCameras = { ...cameras };
      let changed = false;
      floorPlan.rooms.forEach((room) => {
        if (!updatedCameras[room.id]) {
          updatedCameras[room.id] = {
            x: room.x + room.w / 2,
            y: room.y + room.h / 2,
            rotation: 90,
            fov: 85,
            aspectRatio: "Landscape (4:3)",
            prompt: "",
          };
          changed = true;
        }
      });
      if (changed) {
        setCameras(updatedCameras);
      }
    }
  }, [floorPlan]);

  // ── Auto-scroll chat ────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Auto-save floorPlans to localStorage ────────────────────────────────
  useEffect(() => {
    if (floorPlans.length > 0) {
      try {
        localStorage.setItem("igen_floorplans", JSON.stringify(floorPlans));
        localStorage.setItem("igen_projectname", projectName);
      } catch (_e) { /* ignore quota errors */ }
    }
  }, [floorPlans, projectName]);

  // ── Undo/Redo keyboard shortcut ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!floorPlan) return;
      const isUndo = (e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey;
      const isRedo = (e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey));
      if (isUndo) {
        e.preventDefault();
        setHistoryStack(prev => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          setRedoStack(r => [...r, floorPlan!]);
          const next = prev.slice(0, -1);
          setFloorPlan(last);
          const newPlans = [...floorPlans];
          newPlans[activeFloorIndex] = last;
          setFloorPlans(newPlans);
          toast.info("Đã hoàn tác");
          return next;
        });
      } else if (isRedo) {
        e.preventDefault();
        setRedoStack(prev => {
          if (prev.length === 0) return prev;
          const next = prev[prev.length - 1];
          setHistoryStack(h => [...h, floorPlan!]);
          const remaining = prev.slice(0, -1);
          setFloorPlan(next);
          const newPlans = [...floorPlans];
          newPlans[activeFloorIndex] = next;
          setFloorPlans(newPlans);
          toast.info("Đã làm lại");
          return remaining;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [floorPlan, floorPlans, activeFloorIndex]);

  // ── Push to undo history helper ──────────────────────────────────────────
  const pushHistory = useCallback((plan: FloorPlanData) => {
    setHistoryStack(prev => {
      const next = [...prev, plan];
      return next.length > 40 ? next.slice(next.length - 40) : next;
    });
    setRedoStack([]);
  }, []);

  // ── Export floor plan canvas as PNG ─────────────────────────────────────
  const handleExportPNG = useCallback(() => {
    if (!stageRef.current) return;
    try {
      const dataURL = stageRef.current.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
      const link = document.createElement("a");
      link.download = `${projectName.replace(/\s+/g, "_")}_floorplan.png`;
      link.href = dataURL;
      link.click();
      toast.success("Đã xuất bản vẽ thành công!");
    } catch (_e) {
      toast.error("Không thể xuất bản vẽ.");
    }
  }, [projectName]);

  // ── Add message helper ──────────────────────────────────────────────────
  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role, content, timestamp: new Date() },
      ]);
    },
    []
  );

  // ── Gemini 2.5 Flash Conversational Handler ────────────────────────
  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isGenerating || isTyping) return;

    setInputValue("");
    addMessage("user", text);
    setIsTyping(true);

    try {
      const ai = await getAIClient("gemini-2.5-flash");

      // Build conversation history for Gemini
      const conversationHistory = messages
        .filter((m) => m.content !== "__SHAPE_PICKER__")
        .map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content.replace(/__SHAPE_PICKER__/g, "[Người dùng đã chọn hình dạng mặt bằng]") }],
        }));

      // Current gathered info for context
      const gatheredContext = Object.entries(gatherInfo)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");

      const systemInstruction = `Bạn là iGen - trợ lý AI chuyên thiết kế bản vẽ mặt bằng kiến trúc. Nhiệm vụ của bạn là thu thập thông tin để tạo bản vẽ mặt bằng và phối cảnh 3D.

Quy tắc bắt buộc:
1. CHỈ thảo luẫn về thiết kế mặt bằng, kiến trúc, phòng ốc. Nếu người dùng hỏi chủ đề khác, hãy lịch sự từ chối và quay lại chủ đề mặt bằng.
2. Trích xuất thông tin từ ngôn ngữ tự nhiên.
3. Nếu câu trả lời không rõ, hỏi lại để làm rõ.
4. Quy trình thu thập: Số tầng -> Kích thước đất -> Hình dạng mặt bằng -> Số lượng phòng.
5. Khi đã có đủ thông tin Số tầng, Kích thước đất, Hình dạng, và Số phòng, bạn BẮT BUỘC phải hỏi người dùng câu sau: "Tôi đã có đủ thông tin cấu trúc mặt bằng. Bạn có muốn tiến hành dựng phối cảnh 3D luôn không? Nếu bạn đồng ý (hoặc không còn yêu cầu bổ sung nào), tôi sẽ tự động sinh phối cảnh."
6. Nếu người dùng đồng ý, trả lời "Không", "Dựng luôn", "Sinh phối cảnh", "Không cần yêu cầu gì thêm", hãy đặt readyToGenerate = true. Nếu họ cung cấp thêm yêu cầu bổ sung (extras), hãy cập nhật extras và sau đó đặt readyToGenerate = true.

Quy tắc quan trọng về kích thước:
- Nếu người dùng cung cấp kích thước dạng "AxB" hoặc "ngang A dài B" → landWidth=A, landLength=B.
- Nếu người dùng cung cấp diện tích dạng "Xm²" mà không có chiều rộng/dài → Hỏi lại: "Cụ thể ngang bao nhiêu, dài bao nhiêu mét?"
- TUYỆT ĐỐI phải trích xuất hoặc tính cả landWidth và landLength (số thực, đơn vị mét).

Thông tin cần thu thập:
- Số tầng (floors): số nguyên dương
- Kích thước đất: landWidth (mét) và landLength (mét) - BẮT BUỘC phải có cả 2
- Số phòng và loại phòng (rooms)
- Yêu cầu bổ sung (extras)
- Hình dạng mặt bằng (shape): phải yêu cầu người dùng chọn qua modal bằng cách đặt needsShapePicker = true trong JSON.

Thông tin đã thu thập được: ${gatheredContext || "chưa có"}

Trả về JSON thuần túý, TUYỆT ĐỐI KHÔNG thêm text ngoài:
{
  "reply": "tin nhắn trả lời bằng tiếng Việt, ngắn gọn, thân thiện",
  "extracted": {
    "floors": null,
    "area": null,
    "landWidth": null,
    "landLength": null,
    "shape": null,
    "rooms": null,
    "extras": null
  },
  "completedSteps": [],
  "needsShapePicker": false,
  "readyToGenerate": false
}`;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: [
          ...conversationHistory,
          { role: "user", parts: [{ text }] },
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      });

      const rawText =
        (typeof response.text === "function" ? response.text() : response.text) || "{}";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = safeJsonParse(rawText) as Record<string, any> | null;

      if (!parsed) {
        addMessage("assistant", "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại!");
        return;
      }

      const replyText: string = parsed.reply || "";
      const extracted = parsed.extracted || {};
      const newCompletedSteps: GatherStep[] = parsed.completedSteps || [];
      const needsShapePicker: boolean = parsed.needsShapePicker || replyText.includes("__SHAPE_PICKER__");
      const readyToGenerate: boolean = parsed.readyToGenerate || false;

      // Merge extracted info
      const newInfo: GatherInfo = { ...gatherInfo };
      if (extracted.floors != null) newInfo.floors = parseInt(extracted.floors) || 1;
      if (extracted.area != null) newInfo.area = String(extracted.area);
      if (extracted.landWidth != null) newInfo.landWidth = parseFloat(extracted.landWidth) || 5;
      if (extracted.landLength != null) newInfo.landLength = parseFloat(extracted.landLength) || 15;
      if (extracted.shape != null) newInfo.shape = String(extracted.shape);
      if (extracted.rooms != null) newInfo.rooms = String(extracted.rooms);
      if (extracted.extras != null) newInfo.extras = String(extracted.extras);

      // Fallback: nếu chỉ có area (m²) mà không có landWidth/landLength → dụng tỷ lệ mặc định
      if (!newInfo.landWidth && !newInfo.landLength && newInfo.area) {
        const areaMatch = newInfo.area.match(/(\d+(?:\.\d+)?)/);
        if (areaMatch) {
          const sqm = parseFloat(areaMatch[1]);
          // Tiếp nhận diện tích: tỷ lệ 1:2 (ngang:dài)
          newInfo.landWidth = Math.round(Math.sqrt(sqm / 2) * 10) / 10;
          newInfo.landLength = Math.round((sqm / newInfo.landWidth) * 10) / 10;
        }
      }

      setGatherInfo(newInfo);

      // Update checklist steps
      if (newCompletedSteps.length > 0) {
        setCompletedSteps((prev) => {
          const next = new Set(prev);
          newCompletedSteps.forEach((s) => next.add(s));
          return next;
        });
      }

      // Auto-complete checklist based on extracted data
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        if (newInfo.floors) next.add("floors");
        if (newInfo.area || (newInfo.landWidth && newInfo.landLength)) next.add("area");
        if (newInfo.shape) next.add("shape");
        if (newInfo.rooms) next.add("rooms");
        if (newInfo.extras) next.add("extras");
        return next;
      });

      if (needsShapePicker) {
        // Show shape picker bubble
        addMessage("assistant", "__SHAPE_PICKER__");
        setCurrentStep("shape");
      } else if (readyToGenerate) {
        // Show final message then generate
        const cleanReply = replyText.replace("__SHAPE_PICKER__", "").trim();
        if (cleanReply) addMessage("assistant", cleanReply);
        setCurrentStep("done");
        setAutoRenderPending(true);
        await generateFloorPlan(newInfo);
      } else {
        const cleanReply = replyText.replace("__SHAPE_PICKER__", "").trim();
        addMessage("assistant", cleanReply || "Hãy cho tôi biết thêm nhé!");
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error("Chat AI error:", e);
      addMessage("assistant", "Xin lỗi, có lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setIsTyping(false);
    }
  };

  // ── Shape selected from modal ───────────────────────────────────────────
  const handleShapeSelected = async (shapeName: string, width?: number, length?: number) => {
    setShowShapeModal(false);

    const w = width ?? gatherInfo.landWidth ?? 5;
    const l = length ?? gatherInfo.landLength ?? 15;

    addMessage("user", `Hình dạng mặt bằng: ${shapeName} (${w}m × ${l}m)`);

    setCompletedSteps((prev) => new Set([...prev, "shape" as GatherStep, "area" as GatherStep]));
    const newInfo: GatherInfo = {
      ...gatherInfo,
      shape: shapeName,
      landWidth: w,
      landLength: l,
      area: `${w}x${l}m`,
    };
    setGatherInfo(newInfo);
    setCurrentStep("rooms");

    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsTyping(false);
    addMessage(
      "assistant",
      `Tuyệt vời! Đã chọn hình dạng **${shapeName}** (${w}m × ${l}m). 🏗️\n\nTiếp theo, hãy lựa chọn các phòng mong muốn cho ngôi nhà của bạn:`
    );
    addMessage("assistant", "__ROOM_PICKER__");
  };

  // ── Rooms selected from modal ───────────────────────────────────────────
  const handleRoomsSelected = async (
    roomsString: string,
    roomSelection: Record<number, { name: string; count: number }[]>
  ) => {
    setShowRoomsModal(false);

    addMessage("user", `Phòng mong muốn:\n${roomsString}`);

    setCompletedSteps((prev) => new Set([...prev, "rooms" as GatherStep]));
    const newInfo: GatherInfo = {
      ...gatherInfo,
      rooms: roomsString,
      roomSelection,
    };
    setGatherInfo(newInfo);
    setCurrentStep("extras");

    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsTyping(false);
    addMessage(
      "assistant",
      "Đã ghi nhận danh sách phòng của bạn! 🚪✨\n\nCuối cùng, bạn có yêu cầu bổ sung nào khác không? (Ví dụ: phong cách Hiện đại, Tối giản, nhiều ánh sáng tự nhiên...)"
    );
  };

  // ── AI Floor Plan Generation ────────────────────────────────────────────
  const generateFloorPlan = async (info: GatherInfo) => {
    const hasCredits = await checkUserCredits();
    if (!hasCredits) return;

    setIsGenerating(true);

    const totalFloors = info.floors || 1;
    const landW = info.landWidth || 5;
    const landL = info.landLength || 15;
    const shape = info.shape || "hình chữ nhật";
    const rooms = info.rooms || "2 phòng ngủ, 1 WC, phòng khách, bếp";
    const extras = info.extras || "phong cách hiện đại";

    const generatedPlans: FloorPlanData[] = [];

    try {
      for (let floor = 0; floor < totalFloors; floor++) {
        const floorLabel = floor === 0 ? "Tầng Trệt" : `Tầng ${floor}`;
        const promptModel = "gemini-2.5-flash";
        const ai = await getAIClient(promptModel);

        const aiPrompt = `Bạn là Kiến trúc sư trưởng chuyên thiết kế nhà ở Việt Nam.
Nhiệm vụ: Tạo phương án phân chia mặt bằng cho ${floorLabel} của một công trình.

Thông tin đầu vào:
- Kích thước lô đất: ${landW}m x ${landL}m
- Hình dạng: ${shape}
- Yêu cầu phòng: ${rooms}
- Phong cách / yêu cầu bổ sung: ${extras}
- Tổng số tầng: ${totalFloors} tầng

Quy tắc thiết kế bắt buộc (TUÂN THỦ TUYỆT ĐỐI):
1. CHỈ tạo đúng các phòng đã được yêu cầu cụ thể: "${rooms}". TUYỆT ĐỐI KHÔNG thêm phòng phụ ngoài yêu cầu và KHÔNG được tự ý bớt phòng.
2. Các phòng bắt buộc phải được thiết kế LIỀN MẠCH, TIẾP GIÁP TRỰC TIẾP và KHÍT NHAU (phòng này phải chia sẻ chung cạnh tường với các phòng lân cận). TUYỆT ĐỐI KHÔNG thiết kế các phòng tách rời, rời rạc hoặc đứng độc lập rời xa nhau.
3. Tất cả tọa độ x, y, w, h tính bằng mét (số thực).
4. x ∈ [0, ${landW}], y ∈ [0, ${landL}]. Phòng KHÔNG được vượt ra ngoài ranh giới đất. Các phòng không được đè chồng lên nhau (overlap).
5. Để lại hành lang/lối đi hợp lý kết nối các phòng (ít nhất 1-1.2m), đảm bảo giao thông liền mạch trong khối nhà thống nhất.
6. Chọn màu HEX nhạt và đẹp cho mỗi phòng.

Trả về JSON thuần túy (KHÔNG có markdown, KHÔNG có giải thích):
{
  "rooms": [
    { "name": "Tên phòng", "x": 0.0, "y": 0.0, "w": 4.0, "h": 5.0, "color": "#e0f2fe" }
  ],
  "architectNotes": "Giải thích bố trí..."
}`;

        const response = await generateContentWithRetry(ai, {
          model: promptModel,
          contents: [{ role: "user", parts: [{ text: aiPrompt }] }],
          config: { responseMimeType: "application/json" },
        });

        const textResult =
          (typeof response.text === "function"
            ? response.text()
            : response.text) || "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = safeJsonParse(textResult) as Record<string, any> | null;

        if (parsed && Array.isArray(parsed.rooms)) {
          const validatedRooms: Room[] = parsed.rooms.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (r: any, idx: number) => {
              const rw = Math.max(1, Math.min(landW, parseFloat(r.w) || 2));
              const rh = Math.max(1, Math.min(landL, parseFloat(r.h) || 2));
              const roomObj = {
                id: `room_${floor}_${idx}_${Date.now()}`,
                name: r.name || "Phòng",
                x: Math.max(0, Math.min(landW - 1, parseFloat(r.x) || 0)),
                y: Math.max(0, Math.min(landL - 1, parseFloat(r.y) || 0)),
                w: rw,
                h: rh,
                color: r.color || getRoomColor(r.name || ""),
              };
              return {
                ...roomObj,
                furniture: getDefaultFurnitureForRoom(roomObj),
              };
            }
          );
          const openings: Opening[] = validatedRooms.slice(1).map((room, i) => ({
            id: `open_${floor}_${i}`,
            type: "door",
            x: room.x + Math.min(room.w / 2, 0.5),
            y: room.y,
            w: 0.9,
            rotation: 0,
          }));
          generatedPlans.push({
            rooms: validatedRooms,
            openings,
            architectNotes: parsed.architectNotes || "",
          });
        } else {
          throw new Error("AI không trả về đúng định dạng phòng.");
        }
      }

      setFloorPlans(generatedPlans);
      setFloorPlan(generatedPlans[0]);
      setActiveFloorIndex(0);

      // Auto-fit zoom
      if (generatedPlans[0].rooms.length > 0) {
        const fitZoom = Math.min(
          (stageSize.w - 120) / (landW * METER_TO_PX),
          (stageSize.h - 120) / (landL * METER_TO_PX)
        );
        setZoom(Math.max(0.4, Math.min(2, fitZoom)));
        setPan({ x: 60, y: 60 });
      }

      addMessage(
        "assistant",
        `✅ **Mặt bằng đã được tạo!** Tôi đã phân chia ${generatedPlans[0].rooms.length} không gian cho công trình của bạn.\n\n${generatedPlans[0].architectNotes || ""}\n\nBạn có thể zoom, chọn phòng để xem chi tiết, hoặc nhấn **Render 3D** để tạo phối cảnh thực tế.`
      );

      toast.success("Đã tạo mặt bằng thành công!");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error("FloorPlan AI error:", e);
      addMessage(
        "assistant",
        "❌ Có lỗi khi tạo mặt bằng. Vui lòng thử lại hoặc kiểm tra API Key."
      );
      toast.error(e.message || "Lỗi kết nối AI.");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Regenerate ──────────────────────────────────────────────────────────
  const handleRegenerate = async () => {
    if (!gatherInfo || Object.keys(gatherInfo).length === 0) return;
    addMessage("assistant", "♻️ Đang tạo lại phương án mặt bằng...");
    await generateFloorPlan(gatherInfo);
  };

  // ── Canvas zoom / pan ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.12;
    const stage = e.target.getStage();
    const old = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const to = { x: (pointer.x - stage.x()) / old, y: (pointer.y - stage.y()) / old };
    const newScale = Math.max(0.3, Math.min(4, e.evt.deltaY < 0 ? old * scaleBy : old / scaleBy));
    setZoom(newScale);
    setPan({ x: pointer.x - to.x * newScale, y: pointer.y - to.y * newScale });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStageMouseDown = (e: any) => {
    if (e.target === e.target.getStage()) {
      setIsPanning(true);
      const p = e.target.getStage().getPointerPosition();
      panStart.current = { x: p.x - pan.x, y: p.y - pan.y };
      setSelectedRoomId(null);
      setSelectedFurnitureId(null);
      setSelectedFurnitureRoomId(null);
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStageMouseMove = (e: any) => {
    if (!isPanning) return;
    const p = e.target.getStage().getPointerPosition();
    setPan({ x: p.x - panStart.current.x, y: p.y - panStart.current.y });
  };
  const handleStageMouseUp = () => setIsPanning(false);

  // ── Render 3D ──────────────────────────────────────────────────────────
  const handleRender3D = useCallback(async () => {
    if (!floorPlan || floorPlan.rooms.length === 0) {
      toast.error("Vui lòng tạo mặt bằng trước!");
      return;
    }
    const hasCredits = await checkUserCredits();
    if (!hasCredits) return;

    const roomIdForPrompt = selectedRoomId;
    setIsRendering3D(true);
    setSidebarTab("renders");
    setRenderResult(null);
    addMessage("assistant", "🎨 Đang render phối cảnh 3D siêu thực từ mặt bằng...");

    try {
      let base64Image = "";
      if (activeTab === "visualize" && capture3DRef.current) {
        base64Image = capture3DRef.current();
      } else if (stageRef.current) {
        setSelectedRoomId(null);
        await new Promise((r) => setTimeout(r, 100));
        base64Image = stageRef.current.toDataURL({ pixelRatio: 2 });
      }
      if (!base64Image) throw new Error("Không thể chụp canvas.");

      // Upload to Cloudinary
      let _imageUrl = base64Image;
      if (user) {
        try {
          const res = await apiClient.post<ApiResponse<{ url: string }>>(
            "/api/v1/media/upload",
            { file: base64Image, folder: "floorplans" }
          );
          _imageUrl = res.data.url;
        } catch {
          // fallback base64
        }
      }

      const selectedModel = "gemini-3.1-flash-image-preview";
      const ai = await getAIClient(selectedModel);
      const roomsDesc = floorPlan.rooms.map((r) => `${r.name} (${(r.w * r.h).toFixed(1)}m²)`).join(", ");
      const roomForRender = roomIdForPrompt
        ? floorPlan.rooms.find((r) => r.id === roomIdForPrompt)?.name || "Phòng khách"
        : "Phòng khách";

      const currentRoom = roomIdForPrompt
        ? floorPlan.rooms.find((r) => r.id === roomIdForPrompt)
        : floorPlan.rooms[0];

      let customRoomPrompt = "";
      if (currentRoom) {
        const styleText = currentRoom.style ? `Design Style: ${currentRoom.style}` : "";
        const flooringText = currentRoom.finishes?.flooring ? `Flooring: ${currentRoom.finishes.flooring}` : "";
        const wallsText = currentRoom.finishes?.walls ? `Walls: ${currentRoom.finishes.walls}` : "";
        const ceilingText = currentRoom.finishes?.ceiling ? `Ceiling: ${currentRoom.finishes.ceiling}` : "";
        const doorsText = currentRoom.finishes?.doors ? `Doors: ${currentRoom.finishes.doors}` : "";
        const windowsText = currentRoom.finishes?.windows ? `Windows: ${currentRoom.finishes.windows}` : "";
        
        const roomFinishes = [styleText, flooringText, wallsText, ceilingText, doorsText, windowsText].filter(Boolean);
        if (roomFinishes.length > 0) {
          customRoomPrompt = `\nRoom Finishes & Styling configuration:\n${roomFinishes.map(f => `- ${f}`).join("\n")}`;
        }
      }

      let cameraPrompt = "";
      if (activeTab === "visualize" && selectedCameraRoomId && cameras[selectedCameraRoomId]) {
        const cam = cameras[selectedCameraRoomId];
        let enhancedPrompt = cam.prompt || "";
        if (enhancedPrompt.trim()) {
          try {
            const promptAi = await getAIClient("gemini-2.5-flash");
            const optRes = await generateContentWithRetry(promptAi, {
              model: "gemini-2.5-flash",
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `You are a professional architectural renderer prompt engineer. Translate the following user prompt to English and optimize it with rendering details (realistic textures, specific lighting like golden hour or soft interior light). Output ONLY the final optimized English rendering prompt.
User prompt: "${enhancedPrompt}"`
                    }
                  ]
                }
              ]
            });
            const textOut = optRes.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (textOut.trim()) {
              enhancedPrompt = textOut.trim();
            }
          } catch (e) {
            console.error("Error optimizing prompt with gemini-2.5-flash:", e);
          }
        }
        cameraPrompt = `\nCamera Perspective Configuration:\n- Shot position: Standing at the center of the room looking out\n- Field of View (lens angle): ${cam.fov} degrees\n- Aspect Ratio: ${cam.aspectRatio}\n${
          enhancedPrompt ? `- Aesthetic custom style prompt instructions: ${enhancedPrompt}\n` : ""
        }`;
      }

      let customFurniturePrompt = "";
      if (currentRoom && currentRoom.furniture && currentRoom.furniture.length > 0) {
        const styledItems = currentRoom.furniture
          .filter((f) => f.style || f.material || f.color)
          .map((f) => {
            const typeName = FURNITURE_METADATA[f.type]?.name || f.type;
            const styleDesc = f.style ? `style ${f.style}` : "";
            
            let matDesc = "";
            if (f.color) {
              const matchedColor = ALL_COLOURS.find((c) => c.value === f.color);
              matDesc = matchedColor ? `color ${matchedColor.name}` : `color ${f.color}`;
            } else if (f.material) {
              const matchedMat = ALL_MATERIALS.find((m) => m.value === f.material);
              matDesc = matchedMat ? `material ${matchedMat.name}` : `material ${f.material}`;
            }

            return `- ${typeName}: ${[styleDesc, matDesc].filter(Boolean).join(", ")}`;
          });
        if (styledItems.length > 0) {
          customFurniturePrompt = `\nCustom furniture styling to use in this room:\n${styledItems.join("\n")}`;
        }
      }

      const renderPrompt = `You are a professional 3D architectural visualizer.
Convert this 2D floor plan into a hyper-realistic 3D interior perspective render for the [${roomForRender}].
The property includes: ${roomsDesc}.
Style: ${gatherInfo.extras || "Modern Vietnamese contemporary"}.
Requirements:
- Natural light flooding in, warm shadows, 8K photorealistic quality.
- Elegant modern furniture, natural materials (wood, marble, fabric).
- Magazine-quality composition (ArchDaily style).
- NO floor plan lines, NO dimension text, pure 3D photorealistic render only.${cameraPrompt}${customRoomPrompt}${customFurniturePrompt}`;

      const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, "");
      const response = await generateContentWithRetry(ai, {
        model: selectedModel,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: cleanBase64, mimeType: "image/png" } },
              { text: renderPrompt },
            ],
          },
        ],
        config: { imageConfig: { aspectRatio: "4:3", imageSize: "1K" } },
      });

      let generatedUrl: string | null = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          generatedUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!generatedUrl) throw new Error("AI không trả về ảnh render.");

      // Upload result
      let finalUrl = generatedUrl;
      if (user) {
        try {
          const res = await apiClient.post<ApiResponse<{ url: string }>>(
            "/api/v1/media/upload",
            { file: generatedUrl, folder: "renders" }
          );
          finalUrl = res.data.url;
        } catch {
          // fallback
        }
      }

      setRenderResult(finalUrl);
      addMessage("assistant", "✅ Phối cảnh 3D đã hoàn thành! Bạn có thể tải về bên dưới.");
      toast.success("Render 3D hoàn tất!");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error("Render 3D error:", e);
      addMessage("assistant", "❌ Lỗi render 3D. Vui lòng thử lại.");
      toast.error(e.message || "Lỗi render.");
    } finally {
      setIsRendering3D(false);
    }
  }, [floorPlan, selectedRoomId, gatherInfo, user, addMessage]);

  // ── Auto-initialize furniture for existing floor plans ───────────────────
  useEffect(() => {
    if (floorPlans.length > 0) {
      let modified = false;
      const nextPlans = floorPlans.map(plan => {
        const nextRooms = plan.rooms.map(room => {
          if (!room.furniture) {
            modified = true;
            return {
              ...room,
              furniture: getDefaultFurnitureForRoom(room)
            };
          }
          return room;
        });
        if (modified) {
          return { ...plan, rooms: nextRooms };
        }
        return plan;
      });
      if (modified) {
        setFloorPlans(nextPlans);
        if (floorPlan) {
          setFloorPlan(nextPlans[activeFloorIndex]);
        }
      }
    }
  }, [floorPlans, floorPlan]);

  // ── Get default furniture positions for room (in meters) ─────────────────
  function getDefaultFurnitureForRoom(room: { name: string; w: number; h: number }): FurnitureItem[] {
    const items: FurnitureItem[] = [];
    const lowerName = room.name.toLowerCase();
    const rw = room.w;
    const rh = room.h;

    if (lowerName.includes("khách") || lowerName.includes("living")) {
      const sofaW = Math.min(rw * 0.7, 130 / METER_TO_PX);
      const sofaH = Math.min(rh * 0.32, 48 / METER_TO_PX);
      const tvW = Math.min(rw * 0.55, 100 / METER_TO_PX);
      items.push({
        id: `living_tv_${Date.now()}_0`,
        type: "living_tv",
        x: rw / 2,
        y: 14 / METER_TO_PX,
        w: tvW,
        h: 10 / METER_TO_PX
      });
      items.push({
        id: `living_sofa_${Date.now()}_1`,
        type: "living_sofa",
        x: rw / 2,
        y: rh * 0.72,
        w: sofaW,
        h: sofaH
      });
      if (rw * METER_TO_PX > 150) {
        items.push({
          id: `living_chair_${Date.now()}_2`,
          type: "living_chair",
          x: rw * 0.88,
          y: rh * 0.65,
          w: 32 / METER_TO_PX,
          h: 32 / METER_TO_PX
        });
      }
    } else if (lowerName.includes("ngủ") || lowerName.includes("bed")) {
      const bedW = Math.min(rw * 0.55, 90 / METER_TO_PX);
      const bedH = Math.min(rh * 0.65, 100 / METER_TO_PX);
      const wardrobeW = Math.min(rw * 0.85, 120 / METER_TO_PX);
      items.push({
        id: `bed_wardrobe_${Date.now()}_0`,
        type: "bed_wardrobe",
        x: rw / 2,
        y: 10 / METER_TO_PX,
        w: wardrobeW,
        h: 16 / METER_TO_PX
      });
      items.push({
        id: `bed_nightstand_l_${Date.now()}_1`,
        type: "bed_nightstand",
        x: rw / 2 - bedW / 2 - 22 / METER_TO_PX + 9 / METER_TO_PX,
        y: rh / 2 - bedH / 2 + 9 / METER_TO_PX,
        w: 18 / METER_TO_PX,
        h: 18 / METER_TO_PX
      });
      items.push({
        id: `bed_nightstand_r_${Date.now()}_2`,
        type: "bed_nightstand",
        x: rw / 2 + bedW / 2 + 4 / METER_TO_PX + 9 / METER_TO_PX,
        y: rh / 2 - bedH / 2 + 9 / METER_TO_PX,
        w: 18 / METER_TO_PX,
        h: 18 / METER_TO_PX
      });
      items.push({
        id: `bed_bed_${Date.now()}_3`,
        type: "bed_bed",
        x: rw / 2,
        y: rh * 0.55,
        w: bedW,
        h: bedH
      });
    } else if (lowerName.includes("bếp") || lowerName.includes("kitchen")) {
      const counterDepth = 14 / METER_TO_PX;
      const counterLenH = Math.min(rw - 20 / METER_TO_PX, 100 / METER_TO_PX);
      const counterLenV = Math.min(rh * 0.5, 60 / METER_TO_PX);
      items.push({
        id: `kitchen_counter_${Date.now()}_0`,
        type: "kitchen_counter",
        x: 8 / METER_TO_PX,
        y: 8 / METER_TO_PX,
        w: counterLenH,
        h: counterLenV
      });
      items.push({
        id: `kitchen_cooktop_${Date.now()}_1`,
        type: "kitchen_cooktop",
        x: counterLenH * 0.4,
        y: 8 / METER_TO_PX + counterDepth / 2,
        w: 32 / METER_TO_PX,
        h: 10 / METER_TO_PX
      });
      items.push({
        id: `kitchen_sink_${Date.now()}_2`,
        type: "kitchen_sink",
        x: counterLenH * 0.72,
        y: 8 / METER_TO_PX + counterDepth / 2,
        w: 18 / METER_TO_PX,
        h: 10 / METER_TO_PX
      });
      items.push({
        id: `kitchen_fridge_${Date.now()}_3`,
        type: "kitchen_fridge",
        x: 8 / METER_TO_PX + counterDepth / 2,
        y: counterLenV + 20 / METER_TO_PX,
        w: 18 / METER_TO_PX,
        h: 32 / METER_TO_PX
      });
      if (rw > 100 / METER_TO_PX && rh > 100 / METER_TO_PX) {
        const tW = Math.min(rw * 0.4, 70 / METER_TO_PX);
        const tH = Math.min(rh * 0.3, 45 / METER_TO_PX);
        items.push({
          id: `kitchen_table_${Date.now()}_4`,
          type: "dining_table",
          x: rw * 0.65,
          y: rh * 0.55,
          w: tW,
          h: tH
        });
      }
    } else if (lowerName.includes("ăn") || lowerName.includes("dining")) {
      const tW = Math.min(rw * 0.55, 90 / METER_TO_PX);
      const tH = Math.min(rh * 0.4, 55 / METER_TO_PX);
      items.push({
        id: `dining_table_${Date.now()}_0`,
        type: "dining_table",
        x: rw / 2,
        y: rh / 2,
        w: tW,
        h: tH
      });
    } else if (lowerName.includes("tắm") || lowerName.includes("wc") || lowerName.includes("toilet") || lowerName.includes("vệ sinh")) {
      const hasSpace = rw * METER_TO_PX > 70 && rh * METER_TO_PX > 70;
      items.push({
        id: `wc_toilet_${Date.now()}_0`,
        type: "wc_toilet",
        x: 16 / METER_TO_PX,
        y: rh * 0.65,
        w: 18 / METER_TO_PX,
        h: 20 / METER_TO_PX
      });
      items.push({
        id: `wc_lavabo_${Date.now()}_1`,
        type: "wc_lavabo",
        x: 16 / METER_TO_PX,
        y: rh * 0.25,
        w: 24 / METER_TO_PX,
        h: 16 / METER_TO_PX
      });
      items.push({
        id: `wc_mirror_${Date.now()}_2`,
        type: "wc_mirror",
        x: 4 / METER_TO_PX + 12 / METER_TO_PX,
        y: rh * 0.25 - 22 / METER_TO_PX + 7 / METER_TO_PX,
        w: 24 / METER_TO_PX,
        h: 14 / METER_TO_PX
      });
      if (hasSpace) {
        const btW = Math.min(rw * 0.28, 30 / METER_TO_PX);
        const btH = Math.min(rh * 0.28, 40 / METER_TO_PX);
        items.push({
          id: `wc_bathtub_${Date.now()}_3`,
          type: "wc_bathtub",
          x: rw * 0.62,
          y: rh * 0.35,
          w: btW,
          h: btH
        });
      }
    } else if (lowerName.includes("gara") || lowerName.includes("garage") || lowerName.includes("xe")) {
      const carW = Math.min(rw * 0.5, 70 / METER_TO_PX);
      const carH = Math.min(rh * 0.8, 120 / METER_TO_PX);
      items.push({
        id: `garage_car_${Date.now()}_0`,
        type: "garage_car",
        x: rw / 2,
        y: rh / 2,
        w: carW,
        h: carH
      });
    } else if (lowerName.includes("làm việc") || lowerName.includes("office") || lowerName.includes("study")) {
      const deskW = Math.min(rw * 0.65, 100 / METER_TO_PX);
      const deskH = Math.min(rh * 0.3, 40 / METER_TO_PX);
      items.push({
        id: `office_desk_${Date.now()}_0`,
        type: "office_desk",
        x: rw / 2,
        y: rh * 0.45,
        w: deskW,
        h: deskH
      });
    }
    return items;
  }

  // ── Draw furniture graphics ──────────────────────────────────────────────
  function drawFurnitureGraphics(item: FurnitureItem, scale: number) {
    const iw = item.w * scale;
    const ih = item.h * scale;
    const fillColor = getFurnitureColor(item);

    switch (item.type) {
      case "living_tv":
        return (
          <>
            {/* Console Table */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={2} />
            {/* TV Screen */}
            <Rect x={-iw * 0.85 / 2} y={-2} width={iw * 0.85} height={4} fill="#1e293b" stroke="#1e293b" strokeWidth={1} cornerRadius={1} />
          </>
        );
      case "living_sofa":
        return (
          <>
            {/* Main Sofa Body */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={6} />
            {/* Cushions and details */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={9} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Rect x={-iw / 2} y={-ih / 2} width={9} height={ih} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Rect x={iw / 2 - 9} y={-ih / 2} width={9} height={ih} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Line points={[-iw / 2 + 9, ih / 2 - 12, iw / 2 - 9, ih / 2 - 12]} stroke="#1e293b" strokeWidth={0.8} />
            <Line points={[-iw / 6, -ih / 2 + 9, -iw / 6, ih / 2]} stroke="#1e293b" strokeWidth={0.8} />
            <Line points={[iw / 6, -ih / 2 + 9, iw / 6, ih / 2]} stroke="#1e293b" strokeWidth={0.8} />
            {/* Coffee Table */}
            <Rect x={-iw * 0.45 / 2} y={-ih * 1.65} width={iw * 0.45} height={ih * 0.72} fill={fillColor} stroke="#1e293b" strokeWidth={1.2} cornerRadius={3} />
            <Rect x={-iw * 0.35 / 2} y={-ih * 1.55} width={iw * 0.35} height={ih * 0.52} fill="white" stroke="#1e293b" strokeWidth={0.8} cornerRadius={2} />
          </>
        );
      case "living_chair":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.2} cornerRadius={4} />
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={7} fill="white" stroke="#1e293b" strokeWidth={0.8} cornerRadius={2} />
            <Rect x={-iw / 2} y={-ih / 2} width={7} height={ih} fill="white" stroke="#1e293b" strokeWidth={0.8} cornerRadius={2} />
          </>
        );
      case "bed_wardrobe":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={2} />
            <Line points={[-iw / 6, -ih / 2 + 1, -iw / 6, ih / 2 - 1]} stroke="#1e293b" strokeWidth={0.8} />
            <Line points={[iw / 6, -ih / 2 + 1, iw / 6, ih / 2 - 1]} stroke="#1e293b" strokeWidth={0.8} />
            <Circle x={-iw / 4} y={0} radius={1.5} fill="white" stroke="#1e293b" strokeWidth={1} />
            <Circle x={iw / 12} y={0} radius={1.5} fill="white" stroke="#1e293b" strokeWidth={1} />
            <Circle x={iw * 5 / 12} y={0} radius={1.5} fill="white" stroke="#1e293b" strokeWidth={1} />
          </>
        );
      case "bed_nightstand":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.2} cornerRadius={2} />
            <Rect x={-iw / 2 + 3} y={-ih / 2 + 5} width={iw - 6} height={4} fill="white" stroke="#1e293b" strokeWidth={0.8} cornerRadius={1} />
          </>
        );
      case "bed_bed":
        if (item.style === "tatami") {
          return (
            <>
              {/* Outer Tatami Platform Base */}
              <Rect x={-iw / 2 - 6} y={-ih / 2 - 2} width={iw + 12} height={ih + 8} fill="#f5ebe0" stroke="#a16207" strokeWidth={1} cornerRadius={1} />
              <Line points={[-iw / 2 - 6, ih / 2 - 10, iw / 2 + 6, ih / 2 - 10]} stroke="#a16207" strokeWidth={0.8} />
              
              {/* Inner Bed Frame */}
              <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={2} />
              {/* Headboard */}
              <Rect x={-iw / 2} y={-ih / 2} width={iw} height={7} fill="white" stroke="#1e293b" strokeWidth={1} />
              {/* Pillows */}
              <Rect x={-iw * 0.44} y={-ih * 0.38} width={iw * 0.36} height={ih * 0.15} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
              <Rect x={iw * 0.08} y={-ih * 0.38} width={iw * 0.36} height={ih * 0.15} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
              {/* Blanket */}
              <Rect x={-iw / 2 + 2} y={ih * 0.06} width={iw - 4} height={ih * 0.42} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={1} />
            </>
          );
        }
        return (
          <>
            {/* Bed Frame */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={4} />
            {/* Headboard */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={7} fill="white" stroke="#1e293b" strokeWidth={1} />
            {/* Pillows */}
            <Rect x={-iw * 0.44} y={-ih * 0.38} width={iw * 0.36} height={ih * 0.15} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={4} />
            <Rect x={iw * 0.08} y={-ih * 0.38} width={iw * 0.36} height={ih * 0.15} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={4} />
            {/* Blanket */}
            <Line points={[-iw / 2 + 4, -ih * 0.18, iw / 2 - 4, -ih * 0.18]} stroke="#1e293b" strokeWidth={0.8} />
            <Rect x={-iw / 2 + 2} y={ih * 0.06} width={iw - 4} height={ih * 0.42} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Line points={[-iw / 2 + 2, ih * 0.06, iw / 2 - 2, ih * 0.06]} stroke="#1e293b" strokeWidth={1.5} />
          </>
        );
      case "kitchen_counter":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={14} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} />
            <Rect x={-iw / 2} y={-ih / 2} width={14} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} />
          </>
        );
      case "kitchen_cooktop":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={0.8} cornerRadius={1} />
            <Circle x={-9} y={-1} radius={3.5} fill="white" stroke="#1e293b" strokeWidth={1} />
            <Circle x={-9} y={-1} radius={1.5} fill="#1e293b" />
            <Circle x={1} y={-1} radius={3.5} fill="white" stroke="#1e293b" strokeWidth={1} />
            <Circle x={1} y={-1} radius={1.5} fill="#1e293b" />
            <Circle x={-9} y={6} radius={3.5} fill="white" stroke="#1e293b" strokeWidth={1} />
            <Circle x={-9} y={6} radius={1.5} fill="#1e293b" />
            <Circle x={1} y={6} radius={3.5} fill="white" stroke="#1e293b" strokeWidth={1} />
            <Circle x={1} y={6} radius={1.5} fill="#1e293b" />
          </>
        );
      case "kitchen_sink":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Rect x={-iw / 2 + 2} y={-ih / 2 + 1} width={iw - 4} height={ih - 2} fill="white" stroke="#1e293b" strokeWidth={0.8} cornerRadius={1} />
            <Circle x={0} y={0} radius={2} fill="#1e293b" />
            <Line points={[0, -4, 0, -8, 5, -8]} stroke="#1e293b" strokeWidth={1.5} />
          </>
        );
      case "kitchen_fridge":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={3} />
            <Line points={[-iw / 2, 0, iw / 2, 0]} stroke="#1e293b" strokeWidth={0.8} />
            <Line points={[iw / 2 - 3, -ih / 3, iw / 2 - 3, -ih / 10]} stroke="#1e293b" strokeWidth={1.5} />
            <Line points={[iw / 2 - 3, ih / 6, iw / 2 - 3, ih * 0.4]} stroke="#1e293b" strokeWidth={1.5} />
          </>
        );
      case "dining_table":
        if (item.style === "round") {
          const rRadius = Math.min(iw, ih) * 0.35;
          return (
            <>
              {/* Round Table */}
              <Circle x={0} y={0} radius={rRadius} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} />
              
              {/* Chairs around it */}
              <Circle x={0} y={-rRadius - 7} radius={6} fill="white" stroke="#1e293b" strokeWidth={1} />
              <Circle x={0} y={rRadius + 7} radius={6} fill="white" stroke="#1e293b" strokeWidth={1} />
              <Circle x={-rRadius - 7} y={0} radius={6} fill="white" stroke="#1e293b" strokeWidth={1} />
              <Circle x={rRadius + 7} y={0} radius={6} fill="white" stroke="#1e293b" strokeWidth={1} />
              
              {/* 45 degree chairs */}
              <Circle x={-rRadius * 0.707 - 5} y={-rRadius * 0.707 - 5} radius={6} fill="white" stroke="#1e293b" strokeWidth={1} />
              <Circle x={rRadius * 0.707 + 5} y={-rRadius * 0.707 - 5} radius={6} fill="white" stroke="#1e293b" strokeWidth={1} />
              <Circle x={-rRadius * 0.707 - 5} y={rRadius * 0.707 + 5} radius={6} fill="white" stroke="#1e293b" strokeWidth={1} />
              <Circle x={rRadius * 0.707 + 5} y={rRadius * 0.707 + 5} radius={6} fill="white" stroke="#1e293b" strokeWidth={1} />
            </>
          );
        }
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={4} />
            <Rect x={-iw * 0.3} y={-ih / 2 - 9} width={13} height={7} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Rect x={iw * 0.1} y={-ih / 2 - 9} width={13} height={7} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Rect x={-iw * 0.3} y={ih / 2 + 2} width={13} height={7} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Rect x={iw * 0.1} y={ih / 2 + 2} width={13} height={7} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Rect x={-iw / 2 - 9} y={-ih * 0.2} width={7} height={13} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Rect x={iw / 2 + 2} y={-ih * 0.2} width={7} height={13} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
          </>
        );
      case "wc_toilet":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={9} fill="white" stroke="#1e293b" strokeWidth={1.5} cornerRadius={2} />
            <Rect x={-iw * 0.8 / 2} y={-ih / 2 + 9} width={iw * 0.8} height={ih - 9} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={8} />
            <Rect x={-iw * 0.55 / 2} y={-ih / 2 + 11} width={iw * 0.55} height={ih - 13} fill="white" stroke="#1e293b" strokeWidth={0.8} cornerRadius={6} />
          </>
        );
      case "wc_lavabo":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={3} />
            <Rect x={-iw * 0.75 / 2} y={-ih * 0.75 / 2} width={iw * 0.75} height={ih * 0.75} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={5} />
            <Rect x={-iw * 0.58 / 2} y={-ih * 0.56 / 2} width={iw * 0.58} height={ih * 0.56} fill="white" stroke="#1e293b" strokeWidth={0.8} cornerRadius={4} />
            <Circle x={0} y={0} radius={2} fill="#1e293b" />
            <Circle x={0} y={-ih * 0.38} radius={2} fill="white" stroke="#1e293b" strokeWidth={0.8} />
            <Line points={[0, -ih * 0.25, 0, -ih * 0.06]} stroke="#1e293b" strokeWidth={1} />
          </>
        );
      case "wc_mirror":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Rect x={-iw / 2 + 2} y={-ih / 2 + 2} width={iw - 4} height={ih - 4} fill="white" stroke="#1e293b" strokeWidth={0.5} cornerRadius={1} />
          </>
        );
      case "wc_bathtub":
        if (item.style === "jacuzzi") {
          return (
            <>
              {/* Square Jacuzzi */}
              <Rect x={-iw} y={-ih} width={iw * 2} height={ih * 2} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={4} />
              <Rect x={-iw + 4} y={-ih + 4} width={(iw - 4) * 2} height={(ih - 4) * 2} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={3} />
              <Circle x={0} y={0} radius={Math.min(iw, ih) * 0.75} fill="white" stroke="#1e293b" strokeWidth={0.8} />
              <Circle x={0} y={0} radius={3} fill="#1e293b" />
              <Circle x={-iw + 10} y={0} radius={1.5} fill="#1e293b" />
              <Circle x={iw - 10} y={0} radius={1.5} fill="#1e293b" />
              <Circle x={0} y={-ih + 10} radius={1.5} fill="#1e293b" />
              <Circle x={0} y={ih - 10} radius={1.5} fill="#1e293b" />
            </>
          );
        }
        return (
          <>
            <Rect x={-iw} y={-ih} width={iw * 2} height={ih * 2} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={10} />
            <Rect x={-iw + 3} y={-ih + 3} width={(iw - 3) * 2} height={(ih - 3) * 2} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={8} />
            <Circle x={iw - 8} y={ih - 8} radius={2.5} fill="#1e293b" />
            <Circle x={-iw + 8} y={-ih + 8} radius={2.5} fill="white" stroke="#1e293b" strokeWidth={0.8} />
          </>
        );
      case "garage_car":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={10} />
            <Line points={[-iw / 2 + 6, -ih * 0.35, iw / 2 - 6, -ih * 0.35]} stroke="#1e293b" strokeWidth={1} />
            <Rect x={-iw * 0.75 / 2} y={-ih * 0.22} width={iw * 0.75} height={ih * 0.15} fill="#bae6fd" stroke="#1e293b" strokeWidth={1.2} cornerRadius={3} />
            <Rect x={-iw * 0.7 / 2} y={-ih * 0.05} width={iw * 0.7} height={ih * 0.3} fill="#bae6fd" stroke="#1e293b" strokeWidth={1} cornerRadius={4} />
            <Rect x={-iw * 0.75 / 2} y={ih * 0.28} width={iw * 0.75} height={ih * 0.1} fill="#bae6fd" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Rect x={-iw / 2 + 4} y={-ih / 2 + 1} width={8} height={4} fill="white" stroke="#1e293b" strokeWidth={0.5} cornerRadius={1} />
            <Rect x={iw / 2 - 12} y={-ih / 2 + 1} width={8} height={4} fill="white" stroke="#1e293b" strokeWidth={0.5} cornerRadius={1} />
            <Rect x={-iw / 2 + 4} y={ih / 2 - 5} width={8} height={4} fill="white" stroke="#1e293b" strokeWidth={0.5} cornerRadius={1} />
            <Rect x={iw / 2 - 12} y={ih / 2 - 5} width={8} height={4} fill="white" stroke="#1e293b" strokeWidth={0.5} cornerRadius={1} />
            <Rect x={-iw / 2 - 3} y={-ih * 0.25} width={3} height={10} fill="white" stroke="#1e293b" strokeWidth={0.5} cornerRadius={1} />
            <Rect x={iw / 2} y={-ih * 0.25} width={3} height={10} fill="white" stroke="#1e293b" strokeWidth={0.5} cornerRadius={1} />
          </>
        );
      case "office_desk":
        return (
          <>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#1e293b" strokeWidth={1.5} cornerRadius={3} />
            <Rect x={-iw * 0.25} y={-ih / 2 - 14} width={iw * 0.5} height={11} fill="white" stroke="#1e293b" strokeWidth={1} cornerRadius={2} />
            <Rect x={-3} y={-ih / 2 - 3} width={6} height={4} fill="#1e293b" />
            <Rect x={-iw * 0.2} y={-ih / 2 + 6} width={iw * 0.4} height={6} fill="white" stroke="#1e293b" strokeWidth={0.8} cornerRadius={1} />
            <Group x={0} y={ih / 2 + 18}>
              <Circle x={0} y={0} radius={16} fill="white" stroke="#1e293b" strokeWidth={1.2} />
              <Circle x={0} y={0} radius={4} fill="white" stroke="#1e293b" strokeWidth={0.8} />
              <Rect x={-20} y={-5} width={4} height={10} fill="white" stroke="#1e293b" strokeWidth={0.5} cornerRadius={1} />
              <Rect x={16} y={-5} width={4} height={10} fill="white" stroke="#1e293b" strokeWidth={0.5} cornerRadius={1} />
            </Group>
          </>
        );
      default:
        return null;
    }
  }

  // ── Keyboard send ───────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render Furniture Vector for Room ───────────────────────────────────
  const renderFurnitureForRoom = (room: Room, scale: number) => {
    const rx = pan.x + room.x * scale;
    const ry = pan.y + room.y * scale;
    const rw = room.w * scale;
    const rh = room.h * scale;

    const lowerName = room.name.toLowerCase();

    // Living Room / Phòng khách
    if (lowerName.includes("khách") || lowerName.includes("living")) {
      const sofaW = Math.min(rw * 0.7, 120);
      const sofaH = Math.min(rh * 0.35, 40);
      return (
        <Group x={rx + rw / 2} y={ry + rh * 0.75}>
          {/* Main Sofa */}
          <Rect
            x={-sofaW / 2}
            y={-sofaH / 2}
            width={sofaW}
            height={sofaH}
            fill="#1c1c1e"
            stroke="#545456"
            strokeWidth={1}
            cornerRadius={4}
          />
          {/* Sofa Backrest */}
          <Rect
            x={-sofaW / 2}
            y={-sofaH / 2}
            width={sofaW}
            height={8}
            fill="#2c2c2e"
            stroke="#545456"
            strokeWidth={1}
            cornerRadius={2}
          />
          {/* Coffee Table */}
          <Rect
            x={-sofaW * 0.4 / 2}
            y={-sofaH * 1.5}
            width={sofaW * 0.4}
            height={sofaH * 0.6}
            fill="#2c2c2e"
            stroke="#545456"
            strokeWidth={1}
            cornerRadius={2}
          />
        </Group>
      );
    }

    // Bedroom / Phòng ngủ
    if (lowerName.includes("ngủ") || lowerName.includes("bed")) {
      const bedW = Math.min(rw * 0.6, 90);
      const bedH = Math.min(rh * 0.7, 100);
      return (
        <Group x={rx + rw / 2} y={ry + rh / 2}>
          {/* Bed frame */}
          <Rect
            x={-bedW / 2}
            y={-bedH / 2}
            width={bedW}
            height={bedH}
            fill="#1c1c1e"
            stroke="#545456"
            strokeWidth={1}
            cornerRadius={3}
          />
          {/* Pillows */}
          <Rect
            x={-bedW * 0.45}
            y={-bedH * 0.4}
            width={bedW * 0.35}
            height={bedH * 0.18}
            fill="#2c2c2e"
            stroke="#545456"
            strokeWidth={1}
            cornerRadius={2}
          />
          <Rect
            x={bedW * 0.1}
            y={-bedH * 0.4}
            width={bedW * 0.35}
            height={bedH * 0.18}
            fill="#2c2c2e"
            stroke="#545456"
            strokeWidth={1}
            cornerRadius={2}
          />
          {/* Blanket */}
          <Line
            points={[-bedW / 2, bedH * 0.1, bedW / 2, bedH * 0.1]}
            stroke="#545456"
            strokeWidth={1}
          />
        </Group>
      );
    }

    // Kitchen / Bếp
    if (lowerName.includes("bếp") || lowerName.includes("ăn") || lowerName.includes("kitchen") || lowerName.includes("dining")) {
      return (
        <Group x={rx + 15} y={ry + 15}>
          <Line
            points={[0, 0, 0, Math.min(rh - 30, 120), Math.min(rw - 30, 120), Math.min(rh - 30, 120)]}
            stroke="#4c4c4e"
            strokeWidth={12}
            strokeLinecap="square"
          />
          <Line
            points={[0, 0, 0, Math.min(rh - 30, 120), Math.min(rw - 30, 120), Math.min(rh - 30, 120)]}
            stroke="#1c1c1e"
            strokeWidth={10}
            strokeLinecap="square"
          />
        </Group>
      );
    }

    // Bathroom / Toilet / WC
    if (lowerName.includes("tắm") || lowerName.includes("wc") || lowerName.includes("toilet") || lowerName.includes("vệ sinh")) {
      const bathW = Math.min(rw * 0.4, 40);
      const bathH = Math.min(rh * 0.6, 60);
      return (
        <Group x={rx + rw * 0.25} y={ry + rh * 0.3}>
          <Rect
            x={-bathW / 2}
            y={-bathH / 2}
            width={bathW}
            height={bathH}
            fill="#1c1c1e"
            stroke="#545456"
            strokeWidth={1}
            cornerRadius={6}
          />
          <Rect
            x={-bathW * 0.8 / 2}
            y={-bathH * 0.86 / 2}
            width={bathW * 0.8}
            height={bathH * 0.86}
            fill="#111112"
            stroke="#545456"
            strokeWidth={1}
            cornerRadius={5}
          />
        </Group>
      );
    }

    // Garage / Gara
    if (lowerName.includes("gara") || lowerName.includes("garage") || lowerName.includes("xe")) {
      const carW = Math.min(rw * 0.5, 70);
      const carH = Math.min(rh * 0.8, 120);
      return (
        <Group x={rx + rw / 2} y={ry + rh / 2}>
          <Rect
            x={-carW / 2}
            y={-carH / 2}
            width={carW}
            height={carH}
            fill="#1c1c1e"
            stroke="#545456"
            strokeWidth={1}
            cornerRadius={8}
          />
          <Rect
            x={-carW * 0.8 / 2}
            y={-carH * 0.15}
            width={carW * 0.8}
            height={carH * 0.15}
            fill="#2c2c2e"
            stroke="#545456"
            strokeWidth={1}
            cornerRadius={2}
          />
          <Rect x={-carW / 2 - 3} y={-carH * 0.2} width={3} height={8} fill="#545456" />
          <Rect x={carW / 2} y={-carH * 0.2} width={3} height={8} fill="#545456" />
        </Group>
      );
    }

    return null;
  };

  // ── Rotate Furniture Item ──────────────────────────────────────────────
  const rotateFurnitureItem = (roomId: string, itemId: string) => {
    if (floorPlan) {
      const updatedRooms = floorPlan.rooms.map((r) => {
        if (r.id === roomId) {
          const updatedFurniture = (r.furniture || []).map((f) => {
            if (f.id === itemId) {
              const currentRotation = f.rotation || 0;
              const nextRotation = (currentRotation + 90) % 360;
              return { ...f, rotation: nextRotation };
            }
            return f;
          });
          return { ...r, furniture: updatedFurniture };
        }
        return r;
      });
      const updatedPlan = { ...floorPlan, rooms: updatedRooms };
      setFloorPlan(updatedPlan);
      const nextPlans = [...floorPlans];
      nextPlans[activeFloorIndex] = updatedPlan;
      setFloorPlans(nextPlans);
      toast.success("Đã xoay đồ vật 90°");
    }
  };

  // ── Update Room Size and Position ──────────────────────────────────────
  const updateRoomSizeAndPosition = (
    roomId: string,
    newX: number,
    newY: number,
    newW: number,
    newH: number
  ) => {
    if (floorPlan) {
      pushHistory(floorPlan);
      const updatedRooms = floorPlan.rooms.map((r) => {
        if (r.id === roomId) {
          return { ...r, x: newX, y: newY, w: newW, h: newH };
        }
        return r;
      });
      const updatedPlan = { ...floorPlan, rooms: updatedRooms };
      setFloorPlan(updatedPlan);
      const nextPlans = [...floorPlans];
      nextPlans[activeFloorIndex] = updatedPlan;
      setFloorPlans(nextPlans);
    }
  };

  // ── Update Furniture Property ──────────────────────────────────────────
  const updateFurnitureProperty = (
    roomId: string,
    furnitureId: string,
    updates: Partial<FurnitureItem>
  ) => {
    if (floorPlan) {
      pushHistory(floorPlan);
      const updatedRooms = floorPlan.rooms.map((r) => {
        if (r.id === roomId) {
          const updatedFurniture = (r.furniture || []).map((f) => {
            if (f.id === furnitureId) {
              return { ...f, ...updates };
            }
            return f;
          });
          return { ...r, furniture: updatedFurniture };
        }
        return r;
      });
      const updatedPlan = { ...floorPlan, rooms: updatedRooms };
      setFloorPlan(updatedPlan);
      const nextPlans = [...floorPlans];
      nextPlans[activeFloorIndex] = updatedPlan;
      setFloorPlans(nextPlans);
    }
  };

  // ── Update Room Finish ──────────────────────────────────────────────────
  const updateRoomFinish = (
    roomId: string,
    targetType: "style" | "flooring" | "walls" | "ceiling" | "doors" | "windows",
    value: string,
    isColor = false
  ) => {
    if (floorPlan) {
      pushHistory(floorPlan);
      const updatedRooms = floorPlan.rooms.map((r) => {
        if (r.id === roomId) {
          if (targetType === "style") {
            return { ...r, style: value };
          } else {
            const currentFinishes = r.finishes || {};
            return {
              ...r,
              finishes: {
                ...currentFinishes,
                [targetType]: value
              }
            };
          }
        }
        return r;
      });
      const updatedPlan = { ...floorPlan, rooms: updatedRooms };
      setFloorPlan(updatedPlan);
      const nextPlans = [...floorPlans];
      nextPlans[activeFloorIndex] = updatedPlan;
      setFloorPlans(nextPlans);
    }
  };

  // ── Furnish selected room with default furniture ─────────────────────────
  const furnishSelectedRoom = (room: Room) => {
    if (!floorPlan) return;

    // Default furniture sets per room type
    const presets: Record<string, { type: string; relX: number; relY: number; w: number; h: number }[]> = {
      "Phòng khách": [
        { type: "living_sofa",  relX: 0.05, relY: 0.55, w: Math.min(room.w * 0.55, 2.4), h: 0.9 },
        { type: "living_tv",    relX: 0.10, relY: 0.08, w: Math.min(room.w * 0.50, 2.0), h: 0.4 },
      ],
      "Phòng ngủ": [
        { type: "bed_bed",       relX: 0.10, relY: 0.08, w: Math.min(room.w * 0.60, 1.8), h: 2.0 },
        { type: "bed_wardrobe",  relX: 0.70, relY: 0.08, w: Math.min(room.w * 0.28, 1.2), h: Math.min(room.h * 0.60, 2.0) },
      ],
      "Phòng ngủ Master": [
        { type: "bed_bed",       relX: 0.08, relY: 0.08, w: Math.min(room.w * 0.65, 2.0), h: 2.2 },
        { type: "bed_wardrobe",  relX: 0.72, relY: 0.08, w: Math.min(room.w * 0.26, 1.5), h: Math.min(room.h * 0.55, 2.2) },
      ],
      "Phòng bếp": [
        { type: "kitchen_counter", relX: 0.05, relY: 0.05, w: Math.min(room.w * 0.85, 3.0), h: 0.65 },
      ],
      "Phòng ăn": [
        { type: "dining_table", relX: 0.10, relY: 0.15, w: Math.min(room.w * 0.80, 1.8), h: Math.min(room.h * 0.55, 1.0) },
      ],
      "Phòng Tắm / WC": [
        { type: "wc_bathtub", relX: 0.05, relY: 0.10, w: Math.min(room.w * 0.80, 1.5), h: Math.min(room.h * 0.55, 0.7) },
      ],
      "Garage": [
        { type: "garage_car", relX: 0.08, relY: 0.15, w: Math.min(room.w * 0.80, 4.5), h: Math.min(room.h * 0.65, 2.0) },
      ],
    };

    // Find matching preset (check if room name includes any key)
    let items = presets[room.name];
    if (!items) {
      for (const [key, val] of Object.entries(presets)) {
        if (room.name.includes(key)) { items = val; break; }
      }
    }
    if (!items || items.length === 0) {
      toast.info(`Chưa có mẫu đồ nội thất cho phòng "${room.name}"`);
      return;
    }

    const newFurniture: FurnitureItem[] = items.map((item) => ({
      id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: item.type,
      x: room.x + item.relX * room.w,
      y: room.y + item.relY * room.h,
      w: item.w,
      h: item.h,
      rotation: 0,
    }));

    pushHistory(floorPlan);
    const updatedRooms = floorPlan.rooms.map((r) => {
      if (r.id === room.id) {
        return { ...r, furniture: [...(r.furniture || []), ...newFurniture] };
      }
      return r;
    });
    const updatedPlan = { ...floorPlan, rooms: updatedRooms };
    setFloorPlan(updatedPlan);
    const nextPlans = [...floorPlans];
    nextPlans[activeFloorIndex] = updatedPlan;
    setFloorPlans(nextPlans);
    toast.success(`Đã thêm nội thất cho ${room.name}!`);
  };

  // ── Render Openings ────────────────────────────────────────────────────
  const renderOpenings = (plan: FloorPlanData) => {
    if (!plan.openings) return null;
    const scale = METER_TO_PX * zoom;
    const thickness = (wallThickness / 1000) * scale;

    return plan.openings.map((open) => {
      const ox = pan.x + open.x * scale;
      const oy = pan.y + open.y * scale;
      const ow = open.w * scale;

      if (open.type === "door") {
        const arcPoints = [];
        const segments = 12;
        for (let i = 0; i <= segments; i++) {
          const angle = (i * Math.PI) / (segments * 2);
          arcPoints.push(Math.cos(angle) * ow, -Math.sin(angle) * ow);
        }

        return (
          <Group key={open.id} x={ox} y={oy} rotation={open.rotation}>
            <Line
              points={arcPoints}
              stroke="#1e293b"
              strokeWidth={1}
              dash={[3, 3]}
            />
            <Line
              points={[0, 0, 0, -ow]}
              stroke="#1e293b"
              strokeWidth={2}
            />
          </Group>
        );
      } else {
        return (
          <Group key={open.id} x={ox} y={oy} rotation={open.rotation}>
            <Rect
              x={-ow / 2}
              y={-thickness / 2}
              width={ow}
              height={thickness}
              fill="white"
              stroke="#1e293b"
              strokeWidth={1.5}
              cornerRadius={1}
            />
            <Line
              points={[-ow / 2, 0, ow / 2, 0]}
              stroke="#94a3b8"
              strokeWidth={1}
            />
          </Group>
        );
      }
    });
  };

  // ── Render floor plan on Konva ──────────────────────────────────────────
  const renderKonvaFloorPlan = (plan: FloorPlanData) => {
    const scale = METER_TO_PX * zoom;
    const thickness = (wallThickness / 1000) * scale;

    return plan.rooms.map((room) => {
      const isSelected = selectedRoomId === room.id;
      const isDragged = draggedRoomId === room.id;

      const rx = isDragged ? dragOffset.x * scale : 0;
      const ry = isDragged ? dragOffset.y * scale : 0;
      const rw = isDragged ? (room.w + dragOffset.w) * scale : room.w * scale;
      const rh = isDragged ? (room.h + dragOffset.h) * scale : room.h * scale;

      return (
        <Group
          key={room.id}
          x={pan.x + room.x * scale}
          y={pan.y + room.y * scale}
          draggable={false}
          onClick={() => {
            setSelectedRoomId(isSelected ? null : room.id);
            setSelectedFurnitureId(null);
            setSelectedFurnitureRoomId(null);
          }}
          onTap={() => {
            setSelectedRoomId(isSelected ? null : room.id);
            setSelectedFurnitureId(null);
            setSelectedFurnitureRoomId(null);
          }}
        >
          {/* Room Base area fill */}
          <Rect
            x={rx}
            y={ry}
            width={rw}
            height={rh}
            fill={getRoomFlooringColor(room)}
            stroke="#1e293b"
            strokeWidth={thickness}
            cornerRadius={2}
          />
          
          {/* Terrazzo dots pattern */}
          {room.finishes?.flooring === "Terrazzo" && (() => {
            const dots = [];
            const stepX = 24;
            const stepY = 24;
            let seed = room.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
            
            const pseudoRandom = () => {
              const x = Math.sin(seed++) * 10000;
              return x - Math.floor(x);
            };

            for (let x = rx + 8; x < rx + rw - 8; x += stepX) {
              for (let y = ry + 8; y < ry + rh - 8; y += stepY) {
                const jX = (pseudoRandom() - 0.5) * 12;
                const jY = (pseudoRandom() - 0.5) * 12;
                const rSize = 1 + pseudoRandom() * 1.5;
                const rColors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#64748b", "#ffffff", "#475569"];
                const color = rColors[Math.floor(pseudoRandom() * rColors.length)];
                
                dots.push(
                  <Circle
                    key={`dot_${x}_${y}`}
                    x={x + jX}
                    y={y + jY}
                    radius={rSize}
                    fill={color}
                    opacity={0.65}
                  />
                );
              }
            }
            return dots;
          })()}

          {/* White Wood Panelling vertical lines */}
          {room.finishes?.flooring === "White Wood Panelling" && (() => {
            const lines = [];
            const stepX = 20;
            for (let x = rx + stepX; x < rx + rw; x += stepX) {
              lines.push(
                <Line
                  key={`panel_${x}`}
                  points={[x, ry, x, ry + rh]}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
              );
            }
            return lines;
          })()}

          {/* Oak Wood vertical lines */}
          {room.finishes?.flooring === "Oak Wood" && (() => {
            const lines = [];
            const stepX = 20;
            for (let x = rx + stepX; x < rx + rw; x += stepX) {
              lines.push(
                <Line
                  key={`oak_panel_${x}`}
                  points={[x, ry, x, ry + rh]}
                  stroke="#c5a880"
                  strokeWidth={0.8}
                />
              );
            }
            return lines;
          })()}
          
          {/* Room Selection Highlight */}
          {isSelected && (
            <Rect
              x={rx - 2}
              y={ry - 2}
              width={rw + 4}
              height={rh + 4}
              fill="transparent"
              stroke="#00b5cd"
              strokeWidth={1.5}
              dash={[4, 2]}
            />
          )}

          {/* Render Furniture */}
          {(room.furniture || []).map((item) => {
            const iw = item.w * scale;
            const ih = item.h * scale;
            return (
              <Group
                key={item.id}
                x={(rx / scale + item.x) * scale}
                y={(ry / scale + item.y) * scale}
                rotation={item.rotation || 0}
                draggable={true}
                onClick={(e) => {
                  e.cancelBubble = true;
                  setSelectedRoomId(room.id);
                  setSelectedFurnitureId(item.id);
                  setSelectedFurnitureRoomId(room.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  setSelectedRoomId(room.id);
                  setSelectedFurnitureId(item.id);
                  setSelectedFurnitureRoomId(room.id);
                }}
                onDblClick={(e) => {
                  e.cancelBubble = true;
                  rotateFurnitureItem(room.id, item.id);
                }}
                onDblTap={(e) => {
                  e.cancelBubble = true;
                  rotateFurnitureItem(room.id, item.id);
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  const currentW = isDragged ? room.w + dragOffset.w : room.w;
                  const currentH = isDragged ? room.h + dragOffset.h : room.h;
                  const currentRx = isDragged ? dragOffset.x : 0;
                  const currentRy = isDragged ? dragOffset.y : 0;
                  const localX = e.target.x() - currentRx * scale;
                  const localY = e.target.y() - currentRy * scale;
                  const clampedLocalX = Math.max(0, Math.min(currentW * scale, localX));
                  const clampedLocalY = Math.max(0, Math.min(currentH * scale, localY));
                  e.target.x(clampedLocalX + currentRx * scale);
                  e.target.y(clampedLocalY + currentRy * scale);
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  const currentRx = isDragged ? dragOffset.x : 0;
                  const currentRy = isDragged ? dragOffset.y : 0;
                  const localX = (e.target.x() - currentRx * scale) / scale;
                  const localY = (e.target.y() - currentRy * scale) / scale;
                  const roundedX = Math.round(localX * 20) / 20; // snap to 0.05m
                  const roundedY = Math.round(localY * 20) / 20;

                  const currentW = isDragged ? room.w + dragOffset.w : room.w;
                  const currentH = isDragged ? room.h + dragOffset.h : room.h;
                  const clampedX = Math.max(0, Math.min(currentW, roundedX));
                  const clampedY = Math.max(0, Math.min(currentH, roundedY));

                  if (floorPlan) {
                    const updatedRooms = floorPlan.rooms.map((r) => {
                      if (r.id === room.id) {
                        const updatedFurniture = (r.furniture || []).map((f) => {
                          if (f.id === item.id) {
                            return { ...f, x: clampedX, y: clampedY };
                          }
                          return f;
                        });
                        return { ...r, furniture: updatedFurniture };
                      }
                      return r;
                    });
                    const updatedPlan = { ...floorPlan, rooms: updatedRooms };
                    setFloorPlan(updatedPlan);
                    const nextPlans = [...floorPlans];
                    nextPlans[activeFloorIndex] = updatedPlan;
                    setFloorPlans(nextPlans);
                    toast.success(`Đã di chuyển đồ vật đến (${clampedX}m, ${clampedY}m)`);
                  }
                }}
              >
                {drawFurnitureGraphics(item, scale)}
                {selectedFurnitureId === item.id && (
                  <>
                    <Rect
                      x={-iw / 2 - 2}
                      y={-ih / 2 - 2}
                      width={iw + 4}
                      height={ih + 4}
                      fill="transparent"
                      stroke="#00b5cd"
                      strokeWidth={1.5}
                      dash={[4, 2]}
                    />
                    {/* Rotation Handle: top right of selection box */}
                    <Group
                      x={iw / 2 + 12}
                      y={-ih / 2 - 12}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        rotateFurnitureItem(room.id, item.id);
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                        rotateFurnitureItem(room.id, item.id);
                      }}
                    >
                      <Circle
                        radius={9}
                        fill="white"
                        stroke="#00b5cd"
                        strokeWidth={1.2}
                        shadowColor="black"
                        shadowBlur={2}
                        shadowOpacity={0.15}
                        shadowOffset={{ x: 0, y: 1 }}
                      />
                      <Text
                        text="🔄"
                        fontSize={10}
                        x={-5}
                        y={-5.5}
                      />
                    </Group>
                  </>
                )}
              </Group>
            );
          })}

          {/* Wall Resize Draggable Handles */}
          {isSelected && (
            <>
              {/* Left Wall Edge */}
              <Line
                points={[rx, ry, rx, ry + rh]}
                stroke="transparent"
                strokeWidth={8}
                hitStrokeWidth={16}
                draggable={true}
                onMouseEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "ew-resize";
                  (e.target as any).stroke("#00b5cd");
                  e.target.getLayer()?.batchDraw();
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "default";
                  (e.target as any).stroke("transparent");
                  e.target.getLayer()?.batchDraw();
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  e.target.y(0); // keep y locked
                  const deltaX = e.target.x() / scale;
                  let proposedW = room.w - deltaX;
                  let finalDeltaX = deltaX;
                  if (proposedW < 1.0) {
                    proposedW = 1.0;
                    finalDeltaX = room.w - 1.0;
                    e.target.x(finalDeltaX * scale);
                  }
                  setDraggedRoomId(room.id);
                  setDragOffset({ x: finalDeltaX, y: 0, w: -finalDeltaX, h: 0 });
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  e.target.x(0);
                  const newX = Math.round((room.x + dragOffset.x) * 10) / 10;
                  const newW = Math.round((room.w + dragOffset.w) * 10) / 10;
                  updateRoomSizeAndPosition(room.id, newX, room.y, newW, room.h);
                  setDraggedRoomId(null);
                  setDragOffset({ x: 0, y: 0, w: 0, h: 0 });
                  toast.success(`Đã cập nhật tường trái phòng ${room.name}`);
                }}
              />

              {/* Right Wall Edge */}
              <Line
                points={[rx + rw, ry, rx + rw, ry + rh]}
                stroke="transparent"
                strokeWidth={8}
                hitStrokeWidth={16}
                draggable={true}
                onMouseEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "ew-resize";
                  (e.target as any).stroke("#00b5cd");
                  e.target.getLayer()?.batchDraw();
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "default";
                  (e.target as any).stroke("transparent");
                  e.target.getLayer()?.batchDraw();
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  e.target.y(0); // keep y locked
                  const dragX = e.target.x();
                  const deltaW = (dragX - room.w * scale) / scale;
                  let proposedW = room.w + deltaW;
                  let finalDeltaW = deltaW;
                  if (proposedW < 1.0) {
                    proposedW = 1.0;
                    finalDeltaW = 1.0 - room.w;
                    e.target.x((room.w + finalDeltaW) * scale);
                  }
                  setDraggedRoomId(room.id);
                  setDragOffset({ x: 0, y: 0, w: finalDeltaW, h: 0 });
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  e.target.x(room.w * scale);
                  const newW = Math.round((room.w + dragOffset.w) * 10) / 10;
                  updateRoomSizeAndPosition(room.id, room.x, room.y, newW, room.h);
                  setDraggedRoomId(null);
                  setDragOffset({ x: 0, y: 0, w: 0, h: 0 });
                  toast.success(`Đã cập nhật tường phải phòng ${room.name}`);
                }}
              />

              {/* Top Wall Edge */}
              <Line
                points={[rx, ry, rx + rw, ry]}
                stroke="transparent"
                strokeWidth={8}
                hitStrokeWidth={16}
                draggable={true}
                onMouseEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "ns-resize";
                  (e.target as any).stroke("#00b5cd");
                  e.target.getLayer()?.batchDraw();
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "default";
                  (e.target as any).stroke("transparent");
                  e.target.getLayer()?.batchDraw();
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  e.target.x(0); // keep x locked
                  const deltaY = e.target.y() / scale;
                  let proposedH = room.h - deltaY;
                  let finalDeltaY = deltaY;
                  if (proposedH < 1.0) {
                    proposedH = 1.0;
                    finalDeltaY = room.h - 1.0;
                    e.target.y(finalDeltaY * scale);
                  }
                  setDraggedRoomId(room.id);
                  setDragOffset({ x: 0, y: finalDeltaY, w: 0, h: -finalDeltaY });
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  e.target.y(0);
                  const newY = Math.round((room.y + dragOffset.y) * 10) / 10;
                  const newH = Math.round((room.h + dragOffset.h) * 10) / 10;
                  updateRoomSizeAndPosition(room.id, room.x, newY, room.w, newH);
                  setDraggedRoomId(null);
                  setDragOffset({ x: 0, y: 0, w: 0, h: 0 });
                  toast.success(`Đã cập nhật tường trên phòng ${room.name}`);
                }}
              />

              {/* Bottom Wall Edge */}
              <Line
                points={[rx, ry + rh, rx + rw, ry + rh]}
                stroke="transparent"
                strokeWidth={8}
                hitStrokeWidth={16}
                draggable={true}
                onMouseEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "ns-resize";
                  (e.target as any).stroke("#00b5cd");
                  e.target.getLayer()?.batchDraw();
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "default";
                  (e.target as any).stroke("transparent");
                  e.target.getLayer()?.batchDraw();
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  e.target.x(0); // keep x locked
                  const dragY = e.target.y();
                  const deltaH = (dragY - room.h * scale) / scale;
                  let proposedH = room.h + deltaH;
                  let finalDeltaH = deltaH;
                  if (proposedH < 1.0) {
                    proposedH = 1.0;
                    finalDeltaH = 1.0 - room.h;
                    e.target.y((room.h + finalDeltaH) * scale);
                  }
                  setDraggedRoomId(room.id);
                  setDragOffset({ x: 0, y: 0, w: 0, h: finalDeltaH });
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  e.target.y(room.h * scale);
                  const newH = Math.round((room.h + dragOffset.h) * 10) / 10;
                  updateRoomSizeAndPosition(room.id, room.x, room.y, room.w, newH);
                  setDraggedRoomId(null);
                  setDragOffset({ x: 0, y: 0, w: 0, h: 0 });
                  toast.success(`Đã cập nhật tường dưới phòng ${room.name}`);
                }}
              />
            </>
          )}

          <Text
            x={rx + 6}
            y={ry + rh / 2 - 14}
            width={rw - 12}
            text={room.name}
            fontSize={Math.max(9, Math.min(13, rw / 7))}
            fill="#1e293b"
            fontStyle="bold"
            align="center"
            wrap="word"
          />
          <Text
            x={rx + 6}
            y={ry + rh / 2 + 4}
            width={rw - 12}
            text={`${((rw / scale) * (rh / scale)).toFixed(1)}m²`}
            fontSize={Math.max(8, Math.min(11, rw / 9))}
            fill="#64748b"
            align="center"
          />
          {showDimensions && rw > 60 && rh > 40 && (
            <Text
              x={rx + 6}
              y={ry + rh / 2 + 18}
              width={rw - 12}
              text={`${(rw / scale).toFixed(1)}m × ${(rh / scale).toFixed(1)}m`}
              fontSize={Math.max(7, Math.min(9, rw / 11))}
              fill="#94a3b8"
              align="center"
            />
          )}
        </Group>

      );
    });
  };

  // ── Render Cameras (Visualize Mode) ─────────────────────────────────────
  const renderCameras = () => {
    if (!floorPlan) return null;
    const scale = METER_TO_PX * zoom;

    return floorPlan.rooms.map((room) => {
      const cam = cameras[room.id];
      if (!cam) return null;

      const isSelected = selectedCameraRoomId === room.id;

      return (
        <Group
          key={`camera_group_${room.id}`}
          x={pan.x + cam.x * scale}
          y={pan.y + cam.y * scale}
          draggable={true}
          onClick={(e) => {
            e.cancelBubble = true;
            setSelectedCameraRoomId(room.id);
            setSelectedRoomId(room.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            setSelectedCameraRoomId(room.id);
            setSelectedRoomId(room.id);
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const newX = (e.target.x() - pan.x) / scale;
            const newY = (e.target.y() - pan.y) / scale;
            
            // Limit within room boundaries
            const clampedX = Math.max(room.x, Math.min(room.x + room.w, newX));
            const clampedY = Math.max(room.y, Math.min(room.y + room.h, newY));

            e.target.x(pan.x + clampedX * scale);
            e.target.y(pan.y + clampedY * scale);

            setCameras((prev) => ({
              ...prev,
              [room.id]: {
                ...prev[room.id],
                x: clampedX,
                y: clampedY,
              },
            }));
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const newX = (e.target.x() - pan.x) / scale;
            const newY = (e.target.y() - pan.y) / scale;
            const clampedX = Math.max(room.x, Math.min(room.x + room.w, newX));
            const clampedY = Math.max(room.y, Math.min(room.y + room.h, newY));
            
            setCameras((prev) => ({
              ...prev,
              [room.id]: {
                ...prev[room.id],
                x: clampedX,
                y: clampedY,
              },
            }));
            toast.success(`Đã định vị camera tại (${clampedX.toFixed(2)}m, ${clampedY.toFixed(2)}m)`);
          }}
        >
          {/* FOV cone wedge (underneath camera) */}
          <Wedge
            x={0}
            y={0}
            radius={85}
            angle={cam.fov}
            rotation={cam.rotation - cam.fov / 2 - 90}
            fill="rgba(0, 181, 205, 0.15)"
            stroke="rgba(0, 181, 205, 0.35)"
            strokeWidth={1}
            listening={false}
          />

          {/* Camera main icon silhouette */}
          <Group rotation={cam.rotation}>
            {/* Base Circle border wrapper */}
            <Circle radius={15} fill={isSelected ? "rgba(0, 181, 205, 0.1)" : "rgba(30, 41, 59, 0.05)"} stroke={isSelected ? "#00b5cd" : "#475569"} strokeWidth={1.2} />
            {/* Camera body rectangle */}
            <Rect x={-8} y={-4} width={16} height={10} fill={isSelected ? "#00b5cd" : "#1e293b"} stroke="white" strokeWidth={0.8} cornerRadius={2} />
            {/* Trapezoid lens pointing forward (upward relative to local 0 rotation) */}
            <Line points={[-4, -4, -7, -9, 7, -9, 4, -4]} closed fill={isSelected ? "#00b5cd" : "#1e293b"} stroke="white" strokeWidth={0.8} />
          </Group>

          {/* 🔄 Click-to-rotate handle button */}
          {isSelected && (
            <Group
              x={18}
              y={-18}
              onClick={(e) => {
                e.cancelBubble = true;
                setCameras((prev) => ({
                  ...prev,
                  [room.id]: {
                    ...prev[room.id],
                    rotation: (prev[room.id].rotation + 30) % 360,
                  },
                }));
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                setCameras((prev) => ({
                  ...prev,
                  [room.id]: {
                    ...prev[room.id],
                    rotation: (prev[room.id].rotation + 30) % 360,
                  },
                }));
              }}
            >
              <Circle
                radius={8}
                fill="white"
                stroke="#00b5cd"
                strokeWidth={1}
                shadowColor="black"
                shadowBlur={2}
                shadowOpacity={0.15}
                shadowOffset={{ x: 0, y: 1 }}
              />
              <Text text="🔄" fontSize={9} x={-5} y={-5} />
            </Group>
          )}
        </Group>
      );
    });
  };

  // ── Dot grid background ────────────────────────────────────────────────
  const renderDotGrid = () => {
    const dots = [];
    const spacing = 28;
    const cols = Math.ceil(stageSize.w / spacing) + 1;
    const rows = Math.ceil(stageSize.h / spacing) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push(
          <Rect
            key={`dot_${r}_${c}`}
            x={c * spacing}
            y={r * spacing}
            width={2}
            height={2}
            fill="#e2e8f0"
            cornerRadius={1}
          />
        );
      }
    }
    return dots;
  };

  // ── Land boundary ──────────────────────────────────────────────────────
  const renderLandBoundary = () => {
    if (!floorPlan || floorPlan.rooms.length === 0) return null;
    const landW = gatherInfo.landWidth || 5;
    const landL = gatherInfo.landLength || 15;
    const scale = METER_TO_PX * zoom;
    return (
      <Rect
        x={pan.x}
        y={pan.y}
        width={landW * scale}
        height={landL * scale}
        fill="transparent"
        stroke="#94a3b8"
        strokeWidth={1.5}
        dash={[6, 4]}
      />
    );
  };

  // ── Floor tabs ─────────────────────────────────────────────────────────
  const floorLabels =
    gatherInfo.floors && gatherInfo.floors > 0
      ? Array.from({ length: gatherInfo.floors }, (_, i) =>
          i === 0 ? "Tầng Trệt" : `Tầng ${i}`
        )
      : ["Tầng Trệt"];

  // ── Status label ───────────────────────────────────────────────────────
  const _canvasStatusLabel = isGenerating
    ? "Đang tạo mặt bằng..."
    : floorPlan
    ? null
    : "Gathering your input";

  // ── Selected room info ─────────────────────────────────────────────────
  const selectedRoom = selectedRoomId
    ? floorPlan?.rooms.find((r) => r.id === selectedRoomId)
    : null;

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans overflow-hidden">
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/home")}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>

          {isEditingName ? (
            <input
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
              className="bg-slate-100 border border-slate-300 rounded-md px-2 py-0.5 text-sm font-semibold text-slate-900 focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              {projectName}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          {floorPlan && (
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => {
                  if (historyStack.length === 0) return;
                  const last = historyStack[historyStack.length - 1];
                  setRedoStack(r => [...r, floorPlan!]);
                  setHistoryStack(h => h.slice(0, -1));
                  setFloorPlan(last);
                  const newPlans = [...floorPlans];
                  newPlans[activeFloorIndex] = last;
                  setFloorPlans(newPlans);
                  toast.info("Đã hoàn tác");
                }}
                disabled={historyStack.length === 0}
                title="Hoàn tác (Ctrl+Z)"
                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
              </button>
              <div className="w-px h-4 bg-slate-200" />
              <button
                onClick={() => {
                  if (redoStack.length === 0) return;
                  const next = redoStack[redoStack.length - 1];
                  setHistoryStack(h => [...h, floorPlan!]);
                  setRedoStack(r => r.slice(0, -1));
                  setFloorPlan(next);
                  const newPlans = [...floorPlans];
                  newPlans[activeFloorIndex] = next;
                  setFloorPlans(newPlans);
                  toast.info("Đã làm lại");
                }}
                disabled={redoStack.length === 0}
                title="Làm lại (Ctrl+Y)"
                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
              </button>
            </div>
          )}

          {/* Dimensions toggle */}
          {floorPlan && (
            <button
              onClick={() => setShowDimensions(d => !d)}
              title={showDimensions ? "Ẩn kích thước" : "Hiện kích thước"}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                showDimensions ? "bg-[#00b5cd]/10 text-[#00b5cd] border border-[#00b5cd]/30" : "bg-slate-100 text-slate-400 hover:text-slate-700"
              }`}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M21 6H3"/><path d="M21 18H3"/><path d="M3 6v12"/><path d="M21 6v12"/></svg>
            </button>
          )}

          {/* Export PNG */}
          {floorPlan && (
            <button
              onClick={handleExportPNG}
              title="Xuất bản vẽ PNG"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất PNG
            </button>
          )}

          {floorPlan && (
            <button
              onClick={handleRender3D}
              disabled={isRendering3D}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#d4a853] hover:bg-[#c49843] disabled:opacity-50 text-[#1a1612] text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isRendering3D ? "Đang render..." : "Render 3D"}
            </button>
          )}
          {floorPlan && (
            <button
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-500 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Tạo lại
            </button>
          )}
        </div>
      </div>

      {/* ── CHAT SIDEBAR ─────────────────────────────────────────────────── */}
      <div className="w-[380px] flex-shrink-0 flex flex-col bg-slate-50 border-r border-slate-200 pt-12 z-20">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              // Special shape-picker bubble
              if (msg.role === "assistant" && msg.content === "__SHAPE_PICKER__") {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex justify-start"
                  >
                    <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white text-slate-700 shadow-sm border border-slate-100 overflow-hidden">
                      <div className="px-3.5 py-2.5 text-xs leading-relaxed">
                        Rõ rồi! Giờ hãy chọn <strong>hình dạng mặt bằng</strong> phù hợp với lô đất của bạn:
                      </div>
                      <div className="px-3 pb-3">
                        <button
                          onClick={() => setShowShapeModal(true)}
                          className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" rx="1"/>
                            <path d="M14 3h7v4h-4v3h-3V3z"/>
                            <rect x="3" y="14" width="7" height="7" rx="1"/>
                            <rect x="14" y="14" width="7" height="7" rx="1"/>
                          </svg>
                          Chọn hình dạng mặt bằng
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              // Special room-picker bubble
              if (msg.role === "assistant" && msg.content === "__ROOM_PICKER__") {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex justify-start"
                  >
                    <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white text-slate-700 shadow-sm border border-slate-100 overflow-hidden">
                      <div className="px-3.5 py-2.5 text-xs leading-relaxed">
                        Bạn có thể chọn số lượng và loại phòng mong muốn bằng công cụ chọn phòng:
                      </div>
                      <div className="px-3 pb-3">
                        <button
                          onClick={() => setShowRoomsModal(true)}
                          className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          Chọn phòng mong muốn
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#d4a853] text-white font-semibold rounded-br-md"
                        : "bg-white text-slate-700 rounded-bl-md shadow-sm border border-slate-100"
                    }`}
                    style={{ whiteSpace: "pre-wrap" }}
                    dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5 items-center shadow-sm border border-slate-100">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-[#d4a853] rounded-full"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                  />
                ))}
              </div>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#d4a853]/40 focus-within:border-[#d4a853]/50 transition-all shadow-sm">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating || isTyping}
              placeholder={
                currentStep === "done" || isGenerating
                  ? "Đang xử lý..."
                  : "Trả lời iGen..."
              }
              className="flex-1 bg-transparent text-slate-700 text-xs placeholder-slate-400 outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isGenerating || isTyping}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#d4a853] hover:bg-[#c49843] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[#1a1612]"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── CANVAS AREA ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col pt-12 relative overflow-hidden">
        {/* Layout / Visualize switcher toggle */}
        {floorPlan && (
          <div className="absolute top-16 left-4 z-10 flex bg-slate-100 border border-slate-200 rounded-xl p-1 shadow-sm font-sans animate-in fade-in slide-in-from-top-3 duration-200">
            <button
              onClick={() => {
                setActiveTab("layout");
                setSelectedCameraRoomId(null);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "layout"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Layout
            </button>
            <button
              onClick={() => {
                setActiveTab("visualize");
                if (floorPlan && floorPlan.rooms.length > 0) {
                  setSelectedCameraRoomId(floorPlan.rooms[0].id);
                  setSelectedRoomId(floorPlan.rooms[0].id);
                }
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "visualize"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Visualize
            </button>
          </div>
        )}

        {/* Floor tabs */}
        {floorPlans.length > 1 && (
          <div className="absolute top-16 right-4 flex items-center gap-1 z-10 bg-slate-100/80 backdrop-blur border border-slate-200 rounded-xl p-1 shadow-sm">
            {floorLabels.map((label, i) => (
              <button
                key={i}
                onClick={() => {
                  setActiveFloorIndex(i);
                  setFloorPlan(floorPlans[i]);
                  setSelectedRoomId(null);
                  setSelectedCameraRoomId(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFloorIndex === i
                    ? "bg-[#d4a853] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Canvas */}
        <div
          ref={stageContainerRef}
          className="flex-1 relative"
          style={{ cursor: isPanning ? "grabbing" : "default", background: "white" }}
        >
          <Stage
            ref={stageRef}
            width={stageSize.w}
            height={stageSize.h}
            onWheel={handleWheel}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
          >
            {/* Dot grid background layer */}
            <Layer>{renderDotGrid()}</Layer>

            {/* Floor plan layer */}
            <Layer>
              {floorPlan && (
                <>
                  {renderLandBoundary()}
                  {renderKonvaFloorPlan(floorPlan)}
                  {renderOpenings(floorPlan)}
                </>
              )}
            </Layer>

            {/* Camera visualization layer */}
            {floorPlan && activeTab === "visualize" && (
              <Layer>
                {renderCameras()}
              </Layer>
            )}
          </Stage>

          {/* Overlay: Gathering checklist (shown before plan is ready) */}
          {!floorPlan && !isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-slate-400 text-sm font-semibold mb-6 tracking-wide">
                  Gathering your input
                </p>
                <div className="space-y-3">
                  {CHECKLIST_STEPS.map((step) => {
                    const isDone = completedSteps.has(step.key);
                    return (
                      <motion.div
                        key={step.key}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-[#22c55e] flex-shrink-0" />
                        ) : (
                          <LucideCircle className="w-5 h-5 text-slate-300 flex-shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            isDone ? "text-slate-700" : "text-slate-300"
                          }`}
                        >
                          {step.label}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Overlay: Generating spinner */}
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-[#d4a853] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[#d4a853] font-semibold text-sm">Đang tạo mặt bằng với AI...</p>
                <p className="text-slate-400 text-xs mt-1">Vui lòng chờ trong giây lát</p>
              </div>
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-1.5">
            <button
              onClick={() => setZoom((z) => Math.min(4, z * 1.2))}
              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors shadow-sm"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))}
              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors shadow-sm"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setZoom(1); setPan({ x: 60, y: 60 }); }}
              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors shadow-sm"
              title="Fit to screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom label */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-slate-400 text-xs font-mono">
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* ── Auto-initialize furniture for existing floor plans ─────────────────── */}
        <AnimatePresence>
          {(selectedRoom || renderResult) && (
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              className="flex-shrink-0 bg-slate-50 border-t border-slate-200 p-4 flex gap-4 items-start max-h-[220px] overflow-auto"
            >
              {selectedRoom && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: selectedRoom.color }}
                    />
                    <span className="font-bold text-slate-800 text-sm">{selectedRoom.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                    <div>
                      <div className="text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Chiều rộng</div>
                      <div className="text-slate-700 font-semibold">{selectedRoom.w.toFixed(1)} m</div>
                    </div>
                    <div>
                      <div className="text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Chiều dài</div>
                      <div className="text-slate-700 font-semibold">{selectedRoom.h.toFixed(1)} m</div>
                    </div>
                    <div>
                      <div className="text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Diện tích</div>
                      <div className="text-slate-700 font-semibold">{(selectedRoom.w * selectedRoom.h).toFixed(1)} m²</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const room = selectedRoom;
                      addMessage("assistant", `Đang render phối cảnh cho **${room.name}**...`);
                      handleRender3D();
                    }}
                    disabled={isRendering3D}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 text-xs font-semibold rounded-lg transition-all disabled:opacity-40"
                  >
                    <Sparkles className="w-3 h-3" />
                    Render phối cảnh phòng này
                  </button>
                </div>
              )}

              {renderResult && (
                <div className="flex-shrink-0 w-[240px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">Phối cảnh 3D</span>
                    <a
                      href={renderResult}
                      download="igen_render_3d.jpg"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-amber-500 hover:text-amber-600 text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                  </div>
                  <img
                    src={renderResult}
                    alt="3D Render"
                    className="w-full rounded-lg border border-slate-200 object-cover"
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── RIGHT SIDEBAR (LAYOUT / VISUALIZE CONFIG) ──────────────────── */}
      {floorPlan && (
        <div className="w-[320px] flex-shrink-0 flex flex-col bg-slate-50 border-l border-slate-200 pt-12 z-20 text-slate-800 font-sans overflow-y-auto">
          {activeTab === "visualize" ? (() => {
            const selectedCam = selectedCameraRoomId ? cameras[selectedCameraRoomId] : null;
            const targetRoomName = selectedCameraRoomId && floorPlan
              ? floorPlan.rooms.find(r => r.id === selectedCameraRoomId)?.name || "Kitchen"
              : "Room Camera";

            return (
              <div className="p-6 space-y-6">
                {/* 3D Camera Preview Box */}
                <div className="relative w-full aspect-video rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex flex-col items-center justify-center text-slate-400 group shadow-inner">
                  {sidebarTab === "scene" ? (
                    selectedCameraRoomId ? (
                      <FloorPlan3DViewer
                        floorPlan={floorPlan}
                        wallThickness={wallThickness}
                        finishes={finishes}
                        activeCamera={
                          selectedCam && selectedCameraRoomId ? {
                            id: selectedCameraRoomId,
                            roomId: selectedCameraRoomId,
                            x: selectedCam.x,
                            y: selectedCam.y,
                            rotation: selectedCam.rotation,
                            fov: selectedCam.fov
                          } : null
                        }
                        onCaptureRef={capture3DRef}
                        onChangeCamera={(cam) => {
                          setCameras((prev) => ({
                            ...prev,
                            [selectedCameraRoomId!]: {
                              ...prev[selectedCameraRoomId!],
                              rotation: cam.rotation,
                            },
                          }));
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center text-center p-4">
                        <Sparkles className="w-8 h-8 text-slate-300 mb-2 animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No active camera</span>
                        <span className="text-[9px] text-slate-400 mt-1 max-w-[180px]">Select a room camera to view the 3D scene</span>
                      </div>
                    )
                  ) : (
                    isRendering3D ? (
                      <div className="flex flex-col items-center text-center p-4">
                        <div className="w-8 h-8 border-2 border-[#00b5cd] border-t-transparent rounded-full animate-spin mb-2" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Rendering...</span>
                      </div>
                    ) : renderResult ? (
                      <img src={renderResult} alt="Render Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-center p-4">
                        <Sparkles className="w-8 h-8 text-slate-300 mb-2 animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No active render</span>
                        <span className="text-[9px] text-slate-400 mt-1 max-w-[180px]">Go to Scene tab and click Render scene</span>
                      </div>
                    )
                  )}
                </div>

                {/* Camera Title details */}
                <div className="border-b border-slate-200 pb-3.5 text-center">
                  <h3 className="text-sm font-bold text-slate-800">{targetRoomName} Camera</h3>
                  <span className="text-[10px] text-slate-400 font-medium">Floor 1 / {targetRoomName}</span>
                </div>

                {/* Sub-tabs: Scene & Renders */}
                <div className="flex border-b border-slate-200 text-xs font-bold mb-4">
                  <button
                    onClick={() => setSidebarTab("scene")}
                    className={`flex-1 py-2 text-center border-b-2 transition-all cursor-pointer ${
                      sidebarTab === "scene"
                        ? "border-[#00b5cd] text-[#00b5cd]"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Scene
                  </button>
                  <button
                    onClick={() => setSidebarTab("renders")}
                    className={`flex-1 py-2 text-center border-b-2 transition-all cursor-pointer ${
                      sidebarTab === "renders"
                        ? "border-[#00b5cd] text-[#00b5cd]"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Renders
                  </button>
                </div>

                {selectedCam ? (
                  <div className="space-y-5">
                    {/* CONFIGURATION Header */}
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">CONFIGURATION</span>

                    {/* Field of View */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-700 block">Field of view</span>
                      <div className="flex items-center justify-between border border-slate-200 bg-white rounded-xl p-1 shadow-sm">
                        <button
                          onClick={() => {
                            setCameras(prev => ({
                              ...prev,
                              [selectedCameraRoomId!]: {
                                ...prev[selectedCameraRoomId!],
                                fov: Math.max(30, (prev[selectedCameraRoomId!]?.fov || 85) - 5)
                              }
                            }));
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer transition-all"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-slate-800">{selectedCam.fov || 85}°</span>
                        <button
                          onClick={() => {
                            setCameras(prev => ({
                              ...prev,
                              [selectedCameraRoomId!]: {
                                ...prev[selectedCameraRoomId!],
                                fov: Math.min(120, (prev[selectedCameraRoomId!]?.fov || 85) + 5)
                              }
                            }));
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer transition-all"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-700 block">Aspect ratio</span>
                      <div className="relative">
                        <select
                          value={selectedCam.aspectRatio}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCameras(prev => ({
                              ...prev,
                              [selectedCameraRoomId!]: {
                                ...prev[selectedCameraRoomId!],
                                aspectRatio: val
                              }
                            }));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#00b5cd]/50 cursor-pointer appearance-none pr-8"
                        >
                          <option value="Landscape (4:3)">Landscape (4:3)</option>
                          <option value="Widescreen (16:9)">Widescreen (16:9)</option>
                          <option value="Square (1:1)">Square (1:1)</option>
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown className="w-4 h-4" />
                        </span>
                      </div>
                    </div>

                    {/* Custom Prompt */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-700 block">Prompt</span>
                      <textarea
                        value={selectedCam.prompt}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCameras(prev => ({
                            ...prev,
                            [selectedCameraRoomId!]: {
                              ...prev[selectedCameraRoomId!],
                              prompt: val
                            }
                          }));
                        }}
                        placeholder="E.g. add a cat, golden hour, sunbeams, realistic texture..."
                        className="w-full min-h-[80px] bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-[#00b5cd]/50 resize-none transition-all"
                      />
                      <button
                        onClick={async () => {
                          if (!selectedCameraRoomId) return;
                          setIsGeneratingPromptIdea(true);
                          try {
                            const ai = await getAIClient("gemini-2.5-flash");
                            const res = await generateContentWithRetry(ai, {
                              model: "gemini-2.5-flash",
                              contents: [
                                {
                                  role: "user",
                                  parts: [
                                    {
                                      text: `Generate a single short, creative, professional English rendering prompt idea for a [${targetRoomName}] interior. Focus on lighting, architectural materials, and style. Output ONLY the prompt string (max 12 words), no conversational text or quotes.`
                                    }
                                  ]
                                }
                              ]
                            });
                            const idea = res.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/["']/g, "") || "";
                            if (idea.trim()) {
                              setCameras(prev => ({
                                ...prev,
                                [selectedCameraRoomId!]: {
                                  ...prev[selectedCameraRoomId!],
                                  prompt: idea.trim()
                                }
                              }));
                              toast.success("Đã tạo ý tưởng prompt từ AI!");
                            }
                          } catch (e) {
                            console.error(e);
                            toast.error("Không thể kết nối AI.");
                          } finally {
                            setIsGeneratingPromptIdea(false);
                          }
                        }}
                        disabled={isGeneratingPromptIdea}
                        className="text-[10px] text-slate-500 hover:text-slate-800 font-bold border border-slate-200 bg-white rounded-lg px-2.5 py-1 flex items-center gap-1.5 transition-colors cursor-pointer w-fit disabled:opacity-50"
                      >
                        {isGeneratingPromptIdea ? (
                          <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-[#00b5cd]" />
                        )}
                        Auto prompt ideas
                      </button>
                    </div>

                    {/* Render Scene Button */}
                    <button
                      onClick={async () => {
                        setSelectedRoomId(selectedCameraRoomId);
                        setTimeout(() => {
                          handleRender3D();
                        }, 100);
                      }}
                      disabled={isRendering3D}
                      className="w-full py-3 bg-[#00b5cd] hover:bg-[#00a3b8] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isRendering3D ? "Rendering..." : "Render scene"}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-slate-400 font-medium">
                    Hãy nhấp chọn một camera trên bản vẽ để bắt đầu thiết kế góc nhìn.
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="p-6 space-y-6">
              {selectedFurnitureId && selectedFurnitureData ? (() => {
                const { furniture, room } = selectedFurnitureData;
                const meta = FURNITURE_METADATA[furniture.type] || {
                  name: `Đồ vật (${furniture.type})`,
                  materials: [],
                  styles: []
                };

                return (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedFurnitureId(null);
                              setSelectedFurnitureRoomId(null);
                            }}
                            className="text-slate-500 hover:text-slate-800 cursor-pointer mr-1 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          {meta.name}
                        </h3>
                        <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                          Phòng: {room.name}
                        </span>
                      </div>
                    </div>

                    {/* Dimensions */}
                    <div className="space-y-4">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Kích thước (Mét)</span>
                      
                      {/* Width Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600 font-medium">Chiều rộng (ngang)</span>
                          <span className="font-semibold text-slate-800">{furniture.w.toFixed(2)} m</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="4.0"
                          step="0.05"
                          value={furniture.w}
                          onChange={(e) => {
                            const w = parseFloat(e.target.value);
                            updateFurnitureProperty(room.id, furniture.id, { w });
                          }}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#00b5cd]"
                        />
                      </div>

                      {/* Height Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600 font-medium">Chiều sâu (dọc)</span>
                          <span className="font-semibold text-slate-800">{furniture.h.toFixed(2)} m</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="4.0"
                          step="0.05"
                          value={furniture.h}
                          onChange={(e) => {
                            const h = parseFloat(e.target.value);
                            updateFurnitureProperty(room.id, furniture.id, { h });
                          }}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#00b5cd]"
                        />
                      </div>

                      {/* Rotation Input */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600 font-medium">Góc xoay</span>
                          <span className="font-semibold text-slate-800">{(furniture.rotation || 0)}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="315"
                          step="45"
                          value={furniture.rotation || 0}
                          onChange={(e) => {
                            const rotation = parseInt(e.target.value);
                            updateFurnitureProperty(room.id, furniture.id, { rotation });
                          }}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#00b5cd]"
                        />
                      </div>
                    </div>

                    {/* Styles Selection */}
                    {meta.styles.length > 0 && (
                      <div className="space-y-3">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Kiểu dáng thiết kế</span>
                        <div className="grid grid-cols-2 gap-2">
                          {meta.styles.map((st, idx) => {
                            const isSelectedStyle = furniture.style === st.value || (!furniture.style && idx === 0);
                            return (
                              <button
                                key={st.value}
                                onClick={() => updateFurnitureProperty(room.id, furniture.id, { style: st.value })}
                                className={`px-3 py-2 text-left rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                                  isSelectedStyle
                                    ? "border-[#00b5cd] bg-[#00b5cd]/5 text-[#00b5cd]"
                                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                {st.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Finish Selection (triggers popover) */}
                    <div className="space-y-3">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Design References</span>
                      <button
                        onClick={() => {
                          setShowFinishPopup(true);
                        }}
                        className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                            <Settings2 className="w-3.5 h-3.5" />
                          </div>
                          <span>Finish</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const isColor = !!furniture.color;
                            const val = furniture.color || furniture.material || "";
                            if (!val) return <span className="text-slate-400 font-medium">Default</span>;

                            if (isColor) {
                              const matchedCol = ALL_COLOURS.find((c) => c.value === val);
                              return (
                                <>
                                  <div className="w-3.5 h-3.5 rounded-full border border-slate-200" style={{ backgroundColor: val }} />
                                  <span className="text-slate-500 font-medium">{matchedCol?.name || val}</span>
                                </>
                              );
                            } else {
                              const matchedMat = ALL_MATERIALS.find((m) => m.value === val);
                              return (
                                <>
                                  <div className="w-3.5 h-3.5 rounded-full border border-slate-200" style={{ backgroundColor: matchedMat?.color || "#e2e8f0" }} />
                                  <span className="text-slate-500 font-medium">{matchedMat?.name || val}</span>
                                </>
                              );
                            }
                          })()}
                        </div>
                      </button>
                    </div>

                    {/* Remove furniture button */}
                    <div className="pt-4 border-t border-slate-200">
                      <button
                        onClick={() => {
                          if (floorPlan) {
                            const updatedRooms = floorPlan.rooms.map((r) => {
                              if (r.id === room.id) {
                                const updatedFurniture = (r.furniture || []).filter((f) => f.id !== furniture.id);
                                return { ...r, furniture: updatedFurniture };
                              }
                              return r;
                            });
                            const updatedPlan = { ...floorPlan, rooms: updatedRooms };
                            setFloorPlan(updatedPlan);
                            const nextPlans = [...floorPlans];
                            nextPlans[activeFloorIndex] = updatedPlan;
                            setFloorPlans(nextPlans);
                            setSelectedFurnitureId(null);
                            setSelectedFurnitureRoomId(null);
                            toast.success("Đã xóa đồ vật");
                          }
                        }}
                        className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-2xl transition-all cursor-pointer text-xs text-center flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4 text-slate-400" />
                        Remove furniture
                      </button>
                    </div>
                  </div>
                );
              })() : selectedRoom ? (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        {selectedRoom.name}
                      </h3>
                      <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">ROOM INSPECTOR</span>
                    </div>
                  </div>

                  {/* Room Type */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 block">ROOM TYPE</span>
                    <div className="relative">
                      <select
                        value={selectedRoom.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (floorPlan) {
                            const updatedRooms = floorPlan.rooms.map((r) => {
                              if (r.id === selectedRoom.id) {
                                return { ...r, name: val };
                              }
                              return r;
                            });
                            const updatedPlan = { ...floorPlan, rooms: updatedRooms };
                            setFloorPlan(updatedPlan);
                            const nextPlans = [...floorPlans];
                            nextPlans[activeFloorIndex] = updatedPlan;
                            setFloorPlans(nextPlans);
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#00b5cd]/50 cursor-pointer appearance-none pr-8"
                      >
                        <option value="Phòng khách">Phòng khách</option>
                        <option value="Phòng ngủ">Phòng ngủ</option>
                        <option value="Phòng ngủ Master">Phòng ngủ Master</option>
                        <option value="Phòng bếp">Phòng bếp</option>
                        <option value="Phòng ăn">Phòng ăn</option>
                        <option value="Phòng làm việc">Phòng làm việc</option>
                        <option value="Phòng Tắm / WC">Phòng Tắm / WC</option>
                        <option value="Garage">Garage</option>
                        <option value="Hành lang">Hành lang</option>
                        <option value="Sân trước">Sân trước</option>
                        <option value="Sân sau">Sân sau</option>
                        <option value="Ban công">Ban công</option>
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown className="w-4 h-4" />
                      </span>
                    </div>
                  </div>

                  {/* Furnish room button */}
                  <button
                    onClick={() => furnishSelectedRoom(selectedRoom)}
                    className="w-full py-3 bg-[#00b5cd] hover:bg-[#00a3b8] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Furnish room
                  </button>

                  {/* Design References */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Design References</span>
                      <button
                        onClick={() => {
                          if (floorPlan) {
                            const updatedRooms = floorPlan.rooms.map((r) => {
                              if (r.id === selectedRoom.id) {
                                return { ...r, style: undefined, finishes: undefined };
                              }
                              return r;
                            });
                            const updatedPlan = { ...floorPlan, rooms: updatedRooms };
                            setFloorPlan(updatedPlan);
                            const nextPlans = [...floorPlans];
                            nextPlans[activeFloorIndex] = updatedPlan;
                            setFloorPlans(nextPlans);
                            toast.success("Đã reset thiết kế phòng");
                          }
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-600 font-bold transition-colors cursor-pointer"
                      >
                        Reset all
                      </button>
                    </div>

                    {/* Style selector */}
                    <button
                      onClick={() => {
                        setActiveFinishTarget({ type: "style", roomId: selectedRoom.id });
                      }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: ROOM_STYLES.find(s => s.value === (selectedRoom.style || "Traditional"))?.color || "#e2e8f0" }} />
                        <span>Style</span>
                      </div>
                      <span className="text-slate-500 font-medium">
                        {selectedRoom.style || "Traditional"}
                      </span>
                    </button>

                    {/* Flooring */}
                    <button
                      onClick={() => {
                        setActiveFinishTarget({ type: "flooring", roomId: selectedRoom.id });
                      }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: ROOM_FLOORINGS.find(f => f.value === selectedRoom.finishes?.flooring)?.color || "#e2e8f0" }} />
                        <span>Flooring</span>
                      </div>
                      <span className="text-slate-500 font-medium">
                        {selectedRoom.finishes?.flooring || "Terrazzo"}
                      </span>
                    </button>

                    {/* Walls */}
                    <button
                      onClick={() => {
                        setActiveFinishTarget({ type: "walls", roomId: selectedRoom.id });
                      }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: ROOM_WALLS.find(w => w.value === selectedRoom.finishes?.walls)?.color || "#ffffff" }} />
                        <span>Walls</span>
                      </div>
                      <span className="text-slate-500 font-medium">
                        {selectedRoom.finishes?.walls || "White Plaster"}
                      </span>
                    </button>

                    {/* Ceiling */}
                    <button
                      onClick={() => {
                        setActiveFinishTarget({ type: "ceiling", roomId: selectedRoom.id });
                      }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: ROOM_CEILINGS.find(c => c.value === selectedRoom.finishes?.ceiling)?.color || "#ffffff" }} />
                        <span>Ceiling</span>
                      </div>
                      <span className="text-slate-500 font-medium">
                        {selectedRoom.finishes?.ceiling ? ROOM_CEILINGS.find(c => c.value === selectedRoom.finishes?.ceiling)?.name : "Soft White"}
                      </span>
                    </button>

                    {/* Doors */}
                    <button
                      onClick={() => {
                        setActiveFinishTarget({ type: "doors", roomId: selectedRoom.id });
                      }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: ROOM_DOORS.find(d => d.value === selectedRoom.finishes?.doors)?.color || "#ffffff" }} />
                        <span>Doors</span>
                      </div>
                      <span className="text-slate-500 font-medium">
                        {selectedRoom.finishes?.doors ? ROOM_DOORS.find(d => d.value === selectedRoom.finishes?.doors)?.name : "Soft White"}
                      </span>
                    </button>

                    {/* Windows */}
                    <button
                      onClick={() => {
                        setActiveFinishTarget({ type: "windows", roomId: selectedRoom.id });
                      }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: ROOM_WINDOWS.find(w => w.value === selectedRoom.finishes?.windows)?.color || "#ffffff" }} />
                        <span>Windows</span>
                      </div>
                      <span className="text-slate-500 font-medium">
                        {selectedRoom.finishes?.windows ? ROOM_WINDOWS.find(w => w.value === selectedRoom.finishes?.windows)?.name : "Soft White"}
                      </span>
                    </button>
                  </div>

                  {/* Remove room button */}
                  <div className="pt-4 border-t border-slate-200">
                    <button
                      onClick={() => {
                        if (floorPlan) {
                          const updatedRooms = floorPlan.rooms.filter((r) => r.id !== selectedRoom.id);
                          const updatedPlan = { ...floorPlan, rooms: updatedRooms };
                          setFloorPlan(updatedPlan);
                          const nextPlans = [...floorPlans];
                          nextPlans[activeFloorIndex] = updatedPlan;
                          setFloorPlans(nextPlans);
                          setSelectedRoomId(null);
                          setSelectedFurnitureId(null);
                          setSelectedFurnitureRoomId(null);
                          setActiveFinishTarget(null);
                          toast.success("Đã xóa phòng");
                        }
                      }}
                      className="w-full py-3 bg-white hover:bg-red-50 border border-slate-200 text-slate-700 hover:text-red-600 font-bold rounded-2xl transition-all cursor-pointer text-xs text-center"
                    >
                      Remove room
                    </button>
                  </div>
                </div>
              ) : (
                  <>
                    {/* Title and size */}
                    <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-800">
                            {activeFloorIndex === 0 ? "Tầng Trệt" : `Tầng ${activeFloorIndex}`}
                          </h3>
                        </div>
                        <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Tên tầng</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-700">
                          {gatherInfo.landWidth || 5}m × {gatherInfo.landLength || 15}m
                        </span>
                        <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Kích thước ngoại thất</div>
                      </div>
                    </div>

                    {/* CONFIGURATION */}
                    <div className="space-y-3">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Cấu hình</span>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600 font-medium">Độ dày tường</span>
                        <div className="flex items-center gap-2 border border-slate-200 bg-white rounded-full px-2.5 py-1">
                          <button
                            onClick={() => setWallThickness(t => Math.max(50, t - 50))}
                            className="text-slate-500 hover:text-slate-800 cursor-pointer select-none transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-slate-800 text-xs font-semibold w-12 text-center select-none">
                            {wallThickness}mm
                          </span>
                          <button
                            onClick={() => setWallThickness(t => Math.min(300, t + 50))}
                            className="text-slate-500 hover:text-slate-800 cursor-pointer select-none transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* DESIGN REFERENCES */}
                    <div className="space-y-3">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Tham chiếu thiết kế</span>
                      <button
                        onClick={() => setShowStyleModal(true)}
                        className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                          </div>
                          <span>Phong cách (Style)</span>
                        </div>
                        <span className="text-slate-500 font-medium">
                          {selectedStyle ? selectedStyle : <Plus className="w-4 h-4 text-[#00b5cd]" />}
                        </span>
                      </button>
                    </div>

                    {/* Finishes */}
                    <div className="space-y-3">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Vật liệu hoàn thiện</span>
                    
                    {/* Flooring */}
                    <button
                      onClick={() => setShowFinishModal("flooring")}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M4 19h16v2H4v-2zm0-4h16v2H4v-2zm0-4h16v2H4v-2zm0-4h16v2H4V7zm0-4h16v2H4V3z"/></svg>
                        </div>
                        <span>Lát sàn (Flooring)</span>
                      </div>
                      <span className="text-[#00b5cd] font-medium">{finishes.flooring.name}</span>
                    </button>

                  {/* Walls */}
                  <button
                    onClick={() => setShowFinishModal("walls")}
                    className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M12 2a10 10 0 0 0-10 10c0 5.52 4.48 10 10 10s10-4.48 10-10a10 10 0 0 0-10-10zm1 14.5h-2v-2h2v2zm0-4h-2v-6h2v6z"/></svg>
                      </div>
                      <span>Sơn tường (Walls)</span>
                    </div>
                    {finishes.walls.type === "color" ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded border border-slate-200" style={{ backgroundColor: finishes.walls.value }} />
                        <span className="text-slate-500 text-[11px] font-mono">{finishes.walls.value}</span>
                      </div>
                    ) : (
                      <span className="text-[#00b5cd] font-medium">{finishes.walls.name}</span>
                    )}
                  </button>

                  {/* Ceiling */}
                  <button
                    onClick={() => setShowFinishModal("ceiling")}
                    className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M12 2L2 22h20L12 2zm0 4l7.5 13h-15L12 6z"/></svg>
                      </div>
                      <span>Trần nhà (Ceiling)</span>
                    </div>
                    {finishes.ceiling.type === "color" ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded border border-slate-200" style={{ backgroundColor: finishes.ceiling.value }} />
                        <span className="text-slate-500 text-[11px] font-mono">{finishes.ceiling.value}</span>
                      </div>
                    ) : (
                      <span className="text-[#00b5cd] font-medium">{finishes.ceiling.name}</span>
                    )}
                  </button>

                  {/* Doors */}
                  <button
                    onClick={() => setShowFinishModal("doors")}
                    className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.5 12H3"/></svg>
                      </div>
                      <span>Cửa đi (Doors)</span>
                    </div>
                    <span className="text-[#00b5cd] font-medium">{finishes.doors.name}</span>
                  </button>

                  {/* Windows */}
                  <button
                    onClick={() => setShowFinishModal("windows")}
                    className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-9 14H4v-5h7v5zm0-7H4V6h7v5zm9 7h-7v-5h7v5zm0-7h-7V6h7v5z"/></svg>
                      </div>
                      <span>Cửa sổ (Windows)</span>
                    </div>
                    {finishes.windows.type === "color" ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded border border-slate-200" style={{ backgroundColor: finishes.windows.value }} />
                        <span className="text-slate-500 text-[11px] font-mono">{finishes.windows.value}</span>
                      </div>
                    ) : (
                      <span className="text-[#00b5cd] font-medium">{finishes.windows.name}</span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )
      }
    </div>
  )}

      {/* ── ADD FINISH POPOVER (MAKET.AI STYLE) ────────────────────────── */}
      {((showFinishPopup && selectedFurnitureId && selectedFurnitureData) || activeFinishTarget) && (() => {
        const isRoomMode = !!activeFinishTarget;
        let title = "Add finish";
        let hasTabs = false;
        let showCategorySelect = false;
        let showSearch = false;
        
        let itemsList: { name: string; value: string; color: string; image?: string }[] = [];
        let currentValue = "";

        if (isRoomMode && activeFinishTarget && floorPlan) {
          const room = floorPlan.rooms.find(r => r.id === activeFinishTarget.roomId);
          if (room) {
            const type = activeFinishTarget.type;
            if (type === "style") {
              title = "Add style";
              showSearch = true;
              itemsList = ROOM_STYLES.filter((s) =>
                s.name.toLowerCase().includes(searchMaterial.toLowerCase())
              );
              currentValue = room.style || "";
            } else {
              title = `Select ${type.charAt(0).toUpperCase() + type.slice(1)}`;
              currentValue = room.finishes?.[type] || "";
              
              if (type === "flooring") {
                hasTabs = true;
                showCategorySelect = finishTab === "material";
                showSearch = finishTab === "material";
                itemsList = ROOM_FLOORINGS;
              } else if (type === "walls") {
                itemsList = ROOM_WALLS;
              } else if (type === "ceiling") {
                itemsList = ROOM_CEILINGS;
              } else if (type === "doors") {
                itemsList = ROOM_DOORS;
              } else if (type === "windows") {
                itemsList = ROOM_WINDOWS;
              }
            }
          }
        } else if (selectedFurnitureId && selectedFurnitureData) {
          title = "Add finish";
          hasTabs = true;
          showCategorySelect = finishTab === "material";
          showSearch = finishTab === "material";
          itemsList = filteredMaterials;
          currentValue = finishTab === "material"
            ? selectedFurnitureData.furniture.material || ""
            : selectedFurnitureData.furniture.color || "";
        }

        const handleSelect = (val: string, isColor = false) => {
          if (isRoomMode && activeFinishTarget) {
            updateRoomFinish(activeFinishTarget.roomId, activeFinishTarget.type, val, isColor);
          } else if (selectedFurnitureId && selectedFurnitureData) {
            updateFurnitureProperty(selectedFurnitureData.room.id, selectedFurnitureData.furniture.id, {
              material: isColor ? undefined : val,
              color: isColor ? val : undefined
            });
          }
        };

        const handleClose = () => {
          setShowFinishPopup(false);
          setActiveFinishTarget(null);
        };

        return (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[350px] bg-[#ffffff] border border-slate-200 rounded-2xl shadow-2xl p-4 font-sans text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-bold text-sm text-slate-800">{title}</span>
              <button
                onClick={handleClose}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Tabs */}
            {hasTabs && (
              <div className="flex border-b border-slate-100 text-xs font-bold mb-3">
                <button
                  onClick={() => setFinishTab("material")}
                  className={`flex-1 py-2 text-center border-b-2 transition-all cursor-pointer ${
                    finishTab === "material"
                      ? "border-[#00b5cd] text-[#00b5cd]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Material
                </button>
                <button
                  onClick={() => setFinishTab("colour")}
                  className={`flex-1 py-2 text-center border-b-2 transition-all cursor-pointer ${
                    finishTab === "colour"
                      ? "border-[#00b5cd] text-[#00b5cd]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Colour
                </button>
              </div>
            )}

            {/* Content Body */}
            {(!hasTabs || finishTab === "material") ? (
              <div className="space-y-3">
                {/* Category Dropdown */}
                {showCategorySelect && (
                  <div className="relative">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-[#00b5cd]/50 cursor-pointer appearance-none pr-8"
                    >
                      <option value="all">All categories</option>
                      <option value="Metal">Metal</option>
                      <option value="Wood">Wood</option>
                      <option value="Fabric">Fabric</option>
                      <option value="Stone">Stone</option>
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </div>
                )}

                {/* Search Bar */}
                {showSearch && (
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search for materials"
                      value={searchMaterial}
                      onChange={(e) => setSearchMaterial(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-[#00b5cd]/50 transition-colors"
                    />
                  </div>
                )}

                {/* Material Grid */}
                <div className="grid grid-cols-2 gap-3.5 max-h-[240px] overflow-y-auto pr-1">
                  {itemsList.map((mat) => {
                    const isSelected = currentValue === mat.value;
                    return (
                      <button
                        key={mat.value}
                        onClick={() => handleSelect(mat.value, false)}
                        className={`group relative text-left rounded-xl border p-1 bg-white cursor-pointer transition-all ${
                          isSelected
                            ? "border-[#00b5cd] ring-2 ring-[#00b5cd]/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* Texture/Image preview */}
                        <div
                          className="w-full h-[80px] rounded-lg mb-1.5 border border-slate-100 flex items-center justify-center relative overflow-hidden bg-slate-50"
                        >
                          {mat.image ? (
                            <img
                              src={mat.image}
                              alt={mat.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                            />
                          ) : (
                            <div className="w-full h-full" style={{ backgroundColor: mat.color }} />
                          )}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#00b5cd] flex items-center justify-center text-white shadow z-10">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 px-1 truncate block">
                          {mat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Colour Grid */}
                <div className="grid grid-cols-4 gap-3.5 max-h-[240px] overflow-y-auto pr-1">
                  {ALL_COLOURS.map((col) => {
                    const isSelected = currentValue === col.value;
                    return (
                      <button
                        key={col.value}
                        onClick={() => handleSelect(col.value, true)}
                        className={`group relative rounded-xl border p-1 bg-white cursor-pointer transition-all flex flex-col items-center ${
                          isSelected
                            ? "border-[#00b5cd] ring-2 ring-[#00b5cd]/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* Color preview */}
                        <div
                          className="w-10 h-10 rounded-full border border-slate-100 relative overflow-hidden flex items-center justify-center"
                          style={{ backgroundColor: col.value }}
                        >
                          {isSelected && (
                            <div className="absolute inset-0 bg-[#00b5cd]/20 flex items-center justify-center text-white">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-500 font-semibold mt-1 text-center truncate w-full">
                          {col.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── CHOOSE SHAPE MODAL ────────────────────────────────────── */}
      <ChooseShapeModal
        isOpen={showShapeModal}
        onClose={() => setShowShapeModal(false)}
        landWidth={gatherInfo.landWidth || 5}
        landLength={gatherInfo.landLength || 15}
        onSelectShape={(shapeName, _pts, _placements, width, length) =>
          handleShapeSelected(shapeName, width, length)
        }
      />
      {/* ── CHOOSE ROOMS MODAL ────────────────────────────────────── */}
      <ChooseRoomsModal
        isOpen={showRoomsModal}
        onClose={() => setShowRoomsModal(false)}
        floorsCount={gatherInfo.floors || 1}
        initialSelection={gatherInfo.roomSelection}
        onConfirm={(roomsString, roomSelection) =>
          handleRoomsSelected(roomsString, roomSelection)
        }
      />

      {/* ── CHOOSE STYLE MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {showStyleModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-[420px] bg-[#141415] border border-[#2d2d30] rounded-2xl overflow-hidden shadow-2xl text-slate-100 font-sans"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#2d2d30] flex items-center justify-between">
                <span className="text-sm font-bold">Add style</span>
                <button
                  onClick={() => setShowStyleModal(false)}
                  className="w-7 h-7 rounded-lg hover:bg-[#252526] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search for styles"
                    className="w-full bg-[#1c1c1e] border border-[#2d2d30] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-[#00b5cd]/50 transition-colors"
                  />
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-3">All styles</span>
                  
                  {/* Style Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        name: "Rustic",
                        desc: "Mộc mạc",
                        img: "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=200&q=80"
                      },
                      {
                        name: "Traditional",
                        desc: "Truyền thống",
                        img: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=200&q=80"
                      },
                      {
                        name: "Mid-century Modern",
                        desc: "Hiện đại giữa thế kỷ",
                        img: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=200&q=80"
                      },
                      {
                        name: "Scandinavian",
                        desc: "Bắc Âu",
                        img: "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=200&q=80"
                      }
                    ].map((style) => (
                      <div
                        key={style.name}
                        onClick={() => {
                          setSelectedStyle(style.name);
                          setShowStyleModal(false);
                          toast.success(`Đã chọn phong cách: ${style.name}`);
                        }}
                        className="group bg-[#18181a] border border-[#2d2d30] rounded-xl overflow-hidden cursor-pointer hover:border-[#00b5cd]/50 transition-colors"
                      >
                        <div className="aspect-[4/3] overflow-hidden bg-[#111112]">
                          <img
                            src={style.img}
                            alt={style.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="p-2.5">
                          <div className="text-xs font-semibold text-slate-200">{style.name}</div>
                          <div className="text-[10px] text-slate-500">{style.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CHOOSE FINISH MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {showFinishModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-[420px] bg-[#141415] border border-[#2d2d30] rounded-2xl overflow-hidden shadow-2xl text-slate-100 font-sans"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#2d2d30] flex items-center justify-between">
                <span className="text-sm font-bold capitalize">Add finish</span>
                <button
                  onClick={() => setShowFinishModal(null)}
                  className="w-7 h-7 rounded-lg hover:bg-[#252526] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Tab Selector */}
              <div className="flex border-b border-[#2d2d30]">
                <button
                  onClick={() => {
                    setFinishes(prev => ({
                      ...prev,
                      [showFinishModal]: { ...prev[showFinishModal], type: "material" }
                    }));
                  }}
                  className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-colors cursor-pointer ${
                    finishes[showFinishModal]?.type === "material"
                      ? "border-[#00b5cd] text-[#00b5cd]"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Material
                </button>
                <button
                  onClick={() => {
                    setFinishes(prev => ({
                      ...prev,
                      [showFinishModal]: { ...prev[showFinishModal], type: "color" }
                    }));
                  }}
                  className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-colors cursor-pointer ${
                    finishes[showFinishModal]?.type === "color"
                      ? "border-[#00b5cd] text-[#00b5cd]"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Colour
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {finishes[showFinishModal]?.type === "material" ? (
                  <div className="space-y-4">
                    {/* Category Dropdown */}
                    <div className="relative">
                      <select className="w-full bg-[#1c1c1e] border border-[#2d2d30] rounded-xl px-4 py-2 text-xs text-slate-200 outline-none appearance-none focus:border-[#00b5cd]/50 cursor-pointer">
                        <option>All categories</option>
                        <option>Wood</option>
                        <option>Stone</option>
                        <option>Tile</option>
                        <option>Concrete</option>
                      </select>
                      <span className="absolute inset-y-0 right-4 flex items-center text-slate-500 pointer-events-none">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="m6 9 6 6 6-6"/></svg>
                      </span>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                      </span>
                      <input
                        type="text"
                        placeholder="Search for materials"
                        className="w-full bg-[#1c1c1e] border border-[#2d2d30] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-[#00b5cd]/50 transition-colors"
                      />
                    </div>

                    {/* Materials Grid */}
                    <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                      {[
                        {
                          id: "terrazzo",
                          name: "Terrazzo",
                          img: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=150&q=80"
                        },
                        {
                          id: "natural_oak",
                          name: "Natural Oak",
                          img: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=150&q=80"
                        },
                        {
                          id: "terracotta_fan",
                          name: "Terracotta Fan Tile",
                          img: "https://images.unsplash.com/photo-1501183007986-d0d080b147f9?auto=format&fit=crop&w=150&q=80"
                        },
                        {
                          id: "concrete_light",
                          name: "Concrete - Light",
                          img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=150&q=80"
                        }
                      ].map((mat) => (
                        <div
                          key={mat.id}
                          onClick={() => {
                            setFinishes(prev => ({
                              ...prev,
                              [showFinishModal]: { type: "material", value: mat.id, name: mat.name }
                            }));
                            setShowFinishModal(null);
                            toast.success(`Đã chọn vật liệu: ${mat.name}`);
                          }}
                          className={`group bg-[#18181a] border rounded-xl overflow-hidden cursor-pointer hover:border-[#00b5cd]/50 transition-colors ${
                            finishes[showFinishModal]?.value === mat.id ? "border-[#00b5cd]" : "border-[#2d2d30]"
                          }`}
                        >
                          <div className="aspect-video overflow-hidden bg-[#111112]">
                            <img
                              src={mat.img}
                              alt={mat.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <div className="p-2 text-center text-[10px] font-semibold text-slate-200 truncate">
                            {mat.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Color picker canvas gradient demo */}
                    <div
                      className="w-full h-32 rounded-xl relative overflow-hidden cursor-crosshair border border-[#2d2d30]"
                      style={{
                        background: "linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, red)"
                      }}
                      onClick={() => {
                        setFinishes(prev => ({
                          ...prev,
                          [showFinishModal]: { type: "color", value: "#ff0000", name: "Đỏ" }
                        }));
                      }}
                    >
                      <div
                        className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md cursor-pointer"
                        style={{ top: "10%", left: "90%" }}
                      />
                    </div>

                    {/* Hue slider bar */}
                    <div
                      className="w-full h-3.5 rounded-full cursor-pointer border border-[#2d2d30]"
                      style={{
                        background: "linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)"
                      }}
                      onClick={() => {
                        setFinishes(prev => ({
                          ...prev,
                          [showFinishModal]: { type: "color", value: "#00b5cd", name: "Xanh Cyan" }
                        }));
                      }}
                    />

                    {/* Hex input & color info */}
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-4 flex items-center text-slate-500 text-xs font-mono">#</span>
                        <input
                          type="text"
                          value={(finishes[showFinishModal]?.value || "").replace("#", "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFinishes(prev => ({
                              ...prev,
                              [showFinishModal]: { type: "color", value: `#${val}`, name: `#${val.toUpperCase()}` }
                            }));
                          }}
                          className="w-full bg-[#1c1c1e] border border-[#2d2d30] rounded-xl pl-8 pr-4 py-2 text-xs font-mono text-slate-200 outline-none focus:border-[#00b5cd]/50"
                        />
                      </div>
                      <div
                        className="w-8 h-8 rounded-xl border border-[#2d2d30]"
                        style={{ backgroundColor: finishes[showFinishModal]?.value || "#ffffff" }}
                      />
                    </div>

                    {/* Recently Used Colors */}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Recently used</span>
                      <div className="flex items-center gap-2">
                        {[
                          { val: "#ff3b30", name: "Đỏ hồng" },
                          { val: "#34c759", name: "Xanh lá" },
                          { val: "#007aff", name: "Xanh dương" },
                          { val: "#ffcc00", name: "Vàng" },
                          { val: "#af52de", name: "Tím" },
                          { val: "#1c1c1e", name: "Đen xám" },
                          { val: "#ffffff", name: "Trắng" }
                        ].map((c) => (
                          <button
                            key={c.val}
                            onClick={() => {
                              setFinishes(prev => ({
                                ...prev,
                                [showFinishModal]: { type: "color", value: c.val, name: c.name }
                              }));
                              setShowFinishModal(null);
                              toast.success(`Đã chọn màu: ${c.name}`);
                            }}
                            className="w-6 h-6 rounded-full border border-[#2d2d30] cursor-pointer hover:scale-105 transition-transform"
                            style={{ backgroundColor: c.val }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
