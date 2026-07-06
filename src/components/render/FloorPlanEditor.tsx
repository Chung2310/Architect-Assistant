import React, { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Rect, Text, Line, Group, Circle, Wedge } from "react-konva";
import {
  Download, Sparkles, ZoomIn, ZoomOut, RotateCw,
  Send, CheckCircle2, Circle as LucideCircle,
  Maximize2, Plus, Minus, ChevronLeft, Trash2,
  X, Search, Check, ChevronDown, ArrowLeft, Settings2, ChevronRight,
  Bath, Bed, WashingMachine, Car, Dumbbell, Utensils, Sofa, Briefcase, Trees, Gamepad
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
const PEN_CURSOR = "crosshair";

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
  style?: string;
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
  shapePoints?: { x: number; y: number }[];
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

const SHAPE_TEMPLATES_FALLBACK = [
  { name: "Rectangle", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] },
  { name: "L-Shape (Top-Right)", points: [{ x: 0, y: 0 }, { x: 65, y: 0 }, { x: 65, y: 35 }, { x: 100, y: 35 }, { x: 100, y: 100 }, { x: 0, y: 100 }] },
  { name: "U-Shape", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 70, y: 100 }, { x: 70, y: 80 }, { x: 30, y: 80 }, { x: 30, y: 100 }, { x: 0, y: 100 }] },
  { name: "T-Shape", points: [{ x: 25, y: 0 }, { x: 75, y: 0 }, { x: 75, y: 35 }, { x: 100, y: 35 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 35 }, { x: 25, y: 35 }] },
  { name: "H-Shape", points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 25 }, { x: 70, y: 25 }, { x: 70, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 70, y: 100 }, { x: 70, y: 75 }, { x: 30, y: 75 }, { x: 30, y: 100 }, { x: 0, y: 100 }] },
  { name: "Cross", points: [{ x: 30, y: 0 }, { x: 70, y: 0 }, { x: 70, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 70 }, { x: 70, y: 70 }, { x: 70, y: 100 }, { x: 30, y: 100 }, { x: 30, y: 70 }, { x: 0, y: 70 }, { x: 0, y: 30 }, { x: 30, y: 30 }] },
  { name: "L-Shape (Bottom-Left)", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 35, y: 100 }, { x: 35, y: 65 }, { x: 0, y: 65 }] },
  { name: "L-Shape (Bottom-Right)", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 65 }, { x: 65, y: 65 }, { x: 65, y: 100 }, { x: 0, y: 100 }] },
];

function getDefaultPointsForShape(shapeName: string, w: number, l: number): { x: number; y: number }[] {
  const normName = shapeName.toLowerCase();
  let template = SHAPE_TEMPLATES_FALLBACK[0]; // Rectangle fallback
  
  if (normName.includes("l-shape") || normName.includes("chữ l") || normName.includes("l shape")) {
    if (normName.includes("bottom-left")) template = SHAPE_TEMPLATES_FALLBACK[6];
    else if (normName.includes("bottom-right")) template = SHAPE_TEMPLATES_FALLBACK[7];
    else template = SHAPE_TEMPLATES_FALLBACK[1]; // default Top-Right
  } else if (normName.includes("u-shape") || normName.includes("chữ u") || normName.includes("u shape")) {
    template = SHAPE_TEMPLATES_FALLBACK[2];
  } else if (normName.includes("t-shape") || normName.includes("chữ t") || normName.includes("t shape")) {
    template = SHAPE_TEMPLATES_FALLBACK[3];
  } else if (normName.includes("h-shape") || normName.includes("chữ h") || normName.includes("h shape")) {
    template = SHAPE_TEMPLATES_FALLBACK[4];
  } else if (normName.includes("cross") || normName.includes("chữ thập")) {
    template = SHAPE_TEMPLATES_FALLBACK[5];
  }

  let xmin = 100, xmax = 0, ymin = 100, ymax = 0;
  template.points.forEach(p => {
    xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x);
    ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y);
  });
  const tw = xmax - xmin;
  const th = ymax - ymin;

  return template.points.map(p => ({
    x: tw > 0 ? ((p.x - xmin) / tw) * w : 0,
    y: th > 0 ? ((p.y - ymin) / th) * l : 0,
  }));
}

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
  bed_dresser: {
    name: "Tủ ngăn kéo",
    materials: [
      { name: "Gỗ Sồi Tự Nhiên", value: "natural_oak", color: "#d6c2a4" },
      { name: "Gỗ Óc Chó", value: "walnut", color: "#5c4033" }
    ],
    styles: [
      { name: "Hiện đại", value: "modern" }
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
  },
  living_chair: {
    name: "Ghế bành",
    materials: [
      { name: "Vải Nỉ Xám", value: "grey_fabric", color: "#94a3b8" },
      { name: "Da Bò Nâu", value: "brown_leather", color: "#854d0e" }
    ],
    styles: [
      { name: "Hiện Đại", value: "modern" }
    ]
  },
  bed_nightstand: {
    name: "Tủ đầu giường",
    materials: [
      { name: "Gỗ Sồi Natural", value: "oak", color: "#eab308" }
    ],
    styles: [
      { name: "Đơn giản", value: "simple" }
    ]
  },
  kitchen_cooktop: {
    name: "Bếp nấu",
    materials: [
      { name: "Kính đen cường lực", value: "black_glass", color: "#1e293b" }
    ],
    styles: [
      { name: "Bếp âm", value: "built_in" }
    ]
  },
  kitchen_sink: {
    name: "Bồn rửa bát",
    materials: [
      { name: "Inox 304", value: "steel", color: "#94a3b8" }
    ],
    styles: [
      { name: "Bồn đôi", value: "double" }
    ]
  },
  kitchen_fridge: {
    name: "Tủ lạnh",
    materials: [
      { name: "Thép không gỉ", value: "steel", color: "#cbd5e1" }
    ],
    styles: [
      { name: "Side by Side", value: "side_by_side" }
    ]
  },
  wc_toilet: {
    name: "Bồn cầu",
    materials: [
      { name: "Sứ trắng", value: "white_ceramic", color: "#ffffff" }
    ],
    styles: [
      { name: "Liền khối", value: "one_piece" }
    ]
  },
  wc_lavabo: {
    name: "Chậu rửa mặt",
    materials: [
      { name: "Sứ trắng", value: "white_ceramic", color: "#ffffff" }
    ],
    styles: [
      { name: "Treo tường", value: "wall_hung" }
    ]
  },
  wc_mirror: {
    name: "Gương phòng tắm",
    materials: [
      { name: "Kính tráng gương", value: "glass", color: "#ffffff" }
    ],
    styles: [
      { name: "Đèn LED", value: "led" }
    ]
  },
  office_desk: {
    name: "Bàn làm việc",
    materials: [
      { name: "Gỗ công nghiệp", value: "mdf", color: "#cbd5e1" }
    ],
    styles: [
      { name: "Văn phòng", value: "office" }
    ]
  },
  stairs: {
    name: "Cầu thang",
    materials: [
      { name: "Gỗ căm xe", value: "wood", color: "#854d0e" },
      { name: "Gỗ sồi trắng", value: "white_oak", color: "#e3c29b" },
      { name: "Đá cẩm thạch", value: "marble", color: "#cbd5e1" }
    ],
    styles: [
      { name: "Thẳng", value: "straight" },
      { name: "L-shaped staircase (landing)", value: "l_shaped_landing" },
      { name: "L-shaped staircase (winder)", value: "l_shaped_winder" },
      { name: "U-shaped staircase", value: "u_shaped" }
    ]
  },
  plant_pots: {
    name: "Chậu cây cảnh",
    materials: [
      { name: "Chậu đất nung", value: "clay", color: "#c2410c" }
    ],
    styles: [
      { name: "Cây phát tài", value: "default" }
    ]
  },
  gym_treadmill: {
    name: "Máy chạy bộ",
    materials: [
      { name: "Thép & Nhựa", value: "metal_plastic", color: "#1e293b" }
    ],
    styles: [
      { name: "Điện tử", value: "electric" }
    ]
  },
  entry_bench: {
    name: "Ghế băng",
    materials: [
      { name: "Gỗ Sồi Tự Nhiên", value: "natural_oak", color: "#d6c2a4" }
    ],
    styles: [
      { name: "Băng ghế đệm nỉ", value: "cushioned" }
    ]
  },
  entry_coat_stand: {
    name: "Móc treo quần áo",
    materials: [
      { name: "Thép sơn đen", value: "black_steel", color: "#1e293b" },
      { name: "Gỗ tự nhiên", value: "natural_wood", color: "#a16207" }
    ],
    styles: [
      { name: "Cây đứng độc lập", value: "freestanding" }
    ]
  },
  entry_console_mirror: {
    name: "Bàn phụ có gương",
    materials: [
      { name: "Gỗ Óc Chó & Kính", value: "walnut_glass", color: "#5c4033" }
    ],
    styles: [
      { name: "Hiện đại tối giản", value: "minimalist" }
    ]
  },
  laundry_machines: {
    name: "Máy giặt sấy",
    materials: [
      { name: "Trắng Sứ", value: "white_porcelain", color: "#ffffff" },
      { name: "Xám Titan", value: "titanium_grey", color: "#475569" }
    ],
    styles: [
      { name: "Song song", value: "side_by_side" },
      { name: "Xếp chồng", value: "stacked" }
    ]
  },
  laundry_sink: {
    name: "Chậu giặt",
    materials: [
      { name: "Sứ Trắng", value: "white_ceramic", color: "#ffffff" },
      { name: "Đá Nhân Tạo", value: "stone", color: "#cbd5e1" }
    ],
    styles: [
      { name: "Bồn rửa có bàn chà", value: "washboard" }
    ]
  },
  recreation_pool_table: {
    name: "Bàn Bi-a",
    materials: [
      { name: "Vải nỉ xanh", value: "felt", color: "#15803d" }
    ],
    styles: [
      { name: "Standard 9ft", value: "standard" }
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
    if (item.material === "titanium_grey") return "#475569";
    if (item.material === "natural_wood") return "#a16207";
    if (item.material === "black_steel") return "#1e293b";
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

const STYLE_PRESETS: Record<string, {
  flooring: string;
  walls: string;
  ceiling: string;
  doors: string;
  windows: string;
}> = {
  Rustic: {
    flooring: "Red Oak",
    walls: "White Plaster",
    ceiling: "#ffffff",
    doors: "natural_oak",
    windows: "#1e293b",
  },
  Traditional: {
    flooring: "natural_oak",
    walls: "White Plaster",
    ceiling: "#ffffff",
    doors: "natural_oak",
    windows: "#ffffff",
  },
  "Mid-century Modern": {
    flooring: "Red Oak",
    walls: "White Plaster",
    ceiling: "#ffffff",
    doors: "natural_oak",
    windows: "#1e293b",
  },
  Scandinavian: {
    flooring: "White Oak",
    walls: "White Plaster",
    ceiling: "#ffffff",
    doors: "#ffffff",
    windows: "#1e293b",
  },
  Modern: {
    flooring: "Concrete - Light",
    walls: "White Plaster",
    ceiling: "#ffffff",
    doors: "#ffffff",
    windows: "#1e293b",
  },
  Farmhouse: {
    flooring: "Birch",
    walls: "White Plaster",
    ceiling: "#ca8a04",
    doors: "natural_oak",
    windows: "#ffffff",
  },
  Coastal: {
    flooring: "White Herringbone",
    walls: "White Plaster",
    ceiling: "#ffffff",
    doors: "#ffffff",
    windows: "#ffffff",
  },
  Industrial: {
    flooring: "Concrete - Dark",
    walls: "Exposed Brick",
    ceiling: "#cbd5e1",
    doors: "#1e293b",
    windows: "#1e293b",
  }
};

const ROOM_FLOORINGS = [
  {
    name: "White Wood Panelling",
    value: "White Wood Panelling",
    color: "#f8fafc",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f8fafc'/><line x1='0' y1='25' x2='100' y2='25' stroke='%23e2e8f0' stroke-width='1'/><line x1='0' y1='50' x2='100' y2='50' stroke='%23e2e8f0' stroke-width='1'/><line x1='0' y1='75' x2='100' y2='75' stroke='%23e2e8f0' stroke-width='1'/></svg>"
  },
  { 
    name: "Terrazzo", 
    value: "Terrazzo", 
    color: "#cbd5e1",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23e2e8f0'/><circle cx='15' cy='20' r='4' fill='%2394a3b8'/><circle cx='45' cy='15' r='3' fill='%23cbd5e1'/><circle cx='75' cy='30' r='5' fill='%2364748b'/><circle cx='30' cy='50' r='4' fill='%23b45309'/><circle cx='60' cy='70' r='5' fill='%23475569'/><circle cx='85' cy='80' r='3' fill='%23d97706'/><circle cx='20' cy='85' r='4' fill='%2364748b'/><circle cx='50' cy='35' r='3' fill='%23475569'/></svg>"
  },
  { 
    name: "Natural Oak", 
    value: "natural_oak", 
    color: "#e3c29b",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23e3c29b'/><line x1='0' y1='25' x2='100' y2='25' stroke='%23b45309' stroke-width='1'/><line x1='0' y1='50' x2='100' y2='50' stroke='%23b45309' stroke-width='1'/><line x1='0' y1='75' x2='100' y2='75' stroke='%23b45309' stroke-width='1'/><path d='M 10 10 Q 50 15 90 10' fill='none' stroke='%23ca8a04' stroke-width='0.5'/><path d='M 20 35 Q 60 40 80 35' fill='none' stroke='%23ca8a04' stroke-width='0.5'/><path d='M 5 60 Q 45 65 95 60' fill='none' stroke='%23ca8a04' stroke-width='0.5'/></svg>"
  },
  { 
    name: "Terracotta Fan Tile", 
    value: "Terracotta Fan Tile", 
    color: "#c2410c",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23c2410c'/><path d='M0,50 C25,50 25,0 50,0 C75,0 75,50 100,50 M0,100 C25,100 25,50 50,50 C75,50 75,100 100,100 M-50,50 C-25,50 -25,0 0,0 M50,100 C75,100 75,50 100,50' fill='none' stroke='%23fca5a5' stroke-width='1.5'/></svg>"
  },
  { 
    name: "Concrete - Light", 
    value: "Concrete - Light", 
    color: "#e2e8f0",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23e2e8f0'/><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' result='noise'/><feColorMatrix type='matrix' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.07 0'/></filter><rect width='100' height='100' filter='url(%23n)'/></svg>"
  },
  {
    name: "Beige Square Tile",
    value: "Beige Square Tile",
    color: "#f5f5dc",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f5f5dc'/><line x1='0' y1='25' x2='100' y2='25' stroke='%23d3d3d3' stroke-width='1'/><line x1='0' y1='50' x2='100' y2='50' stroke='%23d3d3d3' stroke-width='1'/><line x1='0' y1='75' x2='100' y2='75' stroke='%23d3d3d3' stroke-width='1'/><line x1='25' y1='0' x2='25' y2='100' stroke='%23d3d3d3' stroke-width='1'/><line x1='50' y1='0' x2='50' y2='100' stroke='%23d3d3d3' stroke-width='1'/><line x1='75' y1='0' x2='75' y2='100' stroke='%23d3d3d3' stroke-width='1'/></svg>"
  },
  {
    name: "Birch",
    value: "Birch",
    color: "#fef08a",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23fef08a'/><line x1='0' y1='33' x2='100' y2='33' stroke='%23eab308' stroke-width='0.8'/><line x1='0' y1='66' x2='100' y2='66' stroke='%23eab308' stroke-width='0.8'/></svg>"
  },
  {
    name: "Seafoam Square Tile",
    value: "Seafoam Square Tile",
    color: "#a7f3d0",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23a7f3d0'/><line x1='0' y1='25' x2='100' y2='25' stroke='%2334d399' stroke-width='1'/><line x1='0' y1='50' x2='100' y2='50' stroke='%2334d399' stroke-width='1'/><line x1='0' y1='75' x2='100' y2='75' stroke='%2334d399' stroke-width='1'/><line x1='25' y1='0' x2='25' y2='100' stroke='%2334d399' stroke-width='1'/><line x1='50' y1='0' x2='50' y2='100' stroke='%2334d399' stroke-width='1'/><line x1='75' y1='0' x2='75' y2='100' stroke='%2334d399' stroke-width='1'/></svg>"
  },
  {
    name: "Mint Hexagonal Tile",
    value: "Mint Hexagonal Tile",
    color: "#f0fdf4",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='104' viewBox='0 0 60 104'><rect width='60' height='104' fill='%23f0fdf4'/><path d='M30,0 L60,17.3 L60,52 L30,69.3 L0,52 L0,17.3 Z M30,104 L60,86.7 L60,52 L30,69.3 L0,52 L0,86.7 Z' fill='none' stroke='%2386efac' stroke-width='1.5'/></svg>"
  },
  {
    name: "Blue Square Tile",
    value: "Blue Square Tile",
    color: "#bfdbfe",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23bfdbfe'/><line x1='0' y1='25' x2='100' y2='25' stroke='%2360a5fa' stroke-width='1'/><line x1='0' y1='50' x2='100' y2='50' stroke='%2360a5fa' stroke-width='1'/><line x1='0' y1='75' x2='100' y2='75' stroke='%2360a5fa' stroke-width='1'/><line x1='25' y1='0' x2='25' y2='100' stroke='%2360a5fa' stroke-width='1'/><line x1='50' y1='0' x2='50' y2='100' stroke='%2360a5fa' stroke-width='1'/><line x1='75' y1='0' x2='75' y2='100' stroke='%2360a5fa' stroke-width='1'/></svg>"
  },
  {
    name: "White Square Tile",
    value: "White Square Tile",
    color: "#ffffff",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23ffffff'/><line x1='0' y1='25' x2='100' y2='25' stroke='%23e2e8f0' stroke-width='1'/><line x1='0' y1='50' x2='100' y2='50' stroke='%23e2e8f0' stroke-width='1'/><line x1='0' y1='75' x2='100' y2='75' stroke='%23e2e8f0' stroke-width='1'/><line x1='25' y1='0' x2='25' y2='100' stroke='%23e2e8f0' stroke-width='1'/><line x1='50' y1='0' x2='50' y2='100' stroke='%23e2e8f0' stroke-width='1'/><line x1='75' y1='0' x2='75' y2='100' stroke='%23e2e8f0' stroke-width='1'/></svg>"
  },
  {
    name: "Red Oak",
    value: "Red Oak",
    color: "#b45309",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23b45309'/><line x1='0' y1='25' x2='100' y2='25' stroke='%2378350f' stroke-width='1'/><line x1='0' y1='50' x2='100' y2='50' stroke='%2378350f' stroke-width='1'/><line x1='0' y1='75' x2='100' y2='75' stroke='%2378350f' stroke-width='1'/></svg>"
  },
  {
    name: "White Herringbone",
    value: "White Herringbone",
    color: "#fafafa",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23fafafa'/><path d='M0,0 L50,50 L100,0 M0,50 L50,100 L100,50 M50,0 L50,100 M0,25 L25,50 M100,25 L75,50 M0,75 L25,100 M100,75 L75,100' fill='none' stroke='%23e2e8f0' stroke-width='1.5'/></svg>"
  },
  {
    name: "White Oak",
    value: "White Oak",
    color: "#fafaf9",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23fafaf9'/><line x1='0' y1='25' x2='100' y2='25' stroke='%23d6d3d1' stroke-width='1'/><line x1='0' y1='50' x2='100' y2='50' stroke='%23d6d3d1' stroke-width='1'/><line x1='0' y1='75' x2='100' y2='75' stroke='%23d6d3d1' stroke-width='1'/></svg>"
  },
  {
    name: "Ash",
    value: "Ash",
    color: "#f5f5f4",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f5f5f4'/><line x1='0' y1='25' x2='100' y2='25' stroke='%23e7e5e4' stroke-width='1'/><line x1='0' y1='50' x2='100' y2='50' stroke='%23e7e5e4' stroke-width='1'/><line x1='0' y1='75' x2='100' y2='75' stroke='%23e7e5e4' stroke-width='1'/></svg>"
  },
  {
    name: "Concrete - Dark",
    value: "Concrete - Dark",
    color: "#475569",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23475569'/><filter id='n2'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' result='noise'/><feColorMatrix type='matrix' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0'/></filter><rect width='100' height='100' filter='url(%23n2)'/></svg>"
  },
  {
    name: "Beech",
    value: "Beech",
    color: "#fef08a",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23fef08a'/><line x1='0' y1='25' x2='100' y2='25' stroke='%23eab308' stroke-width='1'/><line x1='0' y1='50' x2='100' y2='50' stroke='%23eab308' stroke-width='1'/><line x1='0' y1='75' x2='100' y2='75' stroke='%23eab308' stroke-width='1'/></svg>"
  }
];

const ROOM_WALLS = [
  { 
    name: "White Plaster", 
    value: "White Plaster", 
    color: "#ffffff",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23ffffff'/></svg>"
  },
  { 
    name: "Terracotta Fan Tile", 
    value: "Terracotta Fan Tile", 
    color: "#c2410c",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23c2410c'/><path d='M0,50 C25,50 25,0 50,0 C75,0 75,50 100,50 M0,100 C25,100 25,50 50,50 C75,50 75,100 100,100 M-50,50 C-25,50 -25,0 0,0 M50,100 C75,100 75,50 100,50' fill='none' stroke='%23fca5a5' stroke-width='1.5'/></svg>"
  },
  { 
    name: "Exposed Brick", 
    value: "Exposed Brick", 
    color: "#b91c1c",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='50' viewBox='0 0 80 50'><rect width='80' height='50' fill='%23b91c1c'/><line x1='0' y1='25' x2='80' y2='25' stroke='%23fca5a5' stroke-width='1.5'/><line x1='0' y1='50' x2='80' y2='50' stroke='%23fca5a5' stroke-width='1.5'/><line x1='40' y1='0' x2='40' y2='25' stroke='%23fca5a5' stroke-width='1.5'/><line x1='0' y1='25' x2='0' y2='50' stroke='%23fca5a5' stroke-width='1.5'/><line x1='80' y1='25' x2='80' y2='50' stroke='%23fca5a5' stroke-width='1.5'/></svg>"
  },
  { 
    name: "Concrete Render", 
    value: "Concrete Render", 
    color: "#cbd5e1",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23cbd5e1'/><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' result='noise'/><feColorMatrix type='matrix' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.07 0'/></filter><rect width='100' height='100' filter='url(%23n)'/></svg>"
  }
];

const ROOM_CEILINGS = [
  { 
    name: "Soft White", 
    value: "#ffffff", 
    color: "#ffffff",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23ffffff'/></svg>"
  },
  { 
    name: "Raw Concrete", 
    value: "#cbd5e1", 
    color: "#cbd5e1",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23cbd5e1'/></svg>"
  },
  { 
    name: "Wood Beams", 
    value: "#ca8a04", 
    color: "#ca8a04",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23fef3c7'/><line x1='20' y1='0' x2='20' y2='100' stroke='%23ca8a04' stroke-width='6'/><line x1='50' y1='0' x2='50' y2='100' stroke='%23ca8a04' stroke-width='6'/><line x1='80' y1='0' x2='80' y2='100' stroke='%23ca8a04' stroke-width='6'/></svg>"
  }
];

const ROOM_DOORS = [
  { 
    name: "Natural Oak", 
    value: "natural_oak", 
    color: "#ca8a04",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23e3c29b'/></svg>"
  },
  { 
    name: "Soft White", 
    value: "#ffffff", 
    color: "#ffffff",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23ffffff'/></svg>"
  },
  { 
    name: "Matte Black", 
    value: "#1e293b", 
    color: "#1e293b",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231e293b'/></svg>"
  }
];

const ROOM_WINDOWS = [
  { 
    name: "Soft White", 
    value: "#ffffff", 
    color: "#ffffff",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23ffffff'/></svg>"
  },
  { 
    name: "Matte Black", 
    value: "#1e293b", 
    color: "#1e293b",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231e293b'/></svg>"
  },
  { 
    name: "Anodized Silver", 
    value: "#cbd5e1", 
    color: "#cbd5e1",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23cbd5e1'/></svg>"
  }
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

const FURNITURE_CATEGORIES = [
  {
    name: "Phòng tắm",
    items: [
      {
        type: "wc_bathtub",
        name: "Bồn tắm",
        subItems: [
          { type: "wc_bathtub", name: "Bồn tắm xây", style: "jacuzzi", w: 0.8, h: 1.6 },
          { type: "wc_bathtub", name: "Bồn tắm độc lập", style: "freestanding", w: 0.8, h: 1.6 }
        ]
      },
      {
        type: "wc_shower",
        name: "Vòi hoa sen",
        subItems: [
          { type: "wc_shower", name: "Vòi sen lớn", w: 1.2, h: 1.2 },
          { type: "wc_shower", name: "Vòi sen vừa", w: 0.9, h: 0.9 },
          { type: "wc_shower", name: "Vòi sen nhỏ", w: 0.8, h: 0.8 }
        ]
      },
      { type: "wc_toilet", name: "Bồn cầu", w: 0.42, h: 0.65 },
      {
        type: "wc_lavabo",
        name: "Bàn đá chậu rửa",
        subItems: [
          { type: "wc_lavabo", name: "Chậu đôi", style: "double", w: 1.4, h: 0.6 },
          { type: "wc_lavabo", name: "Chậu đơn", style: "single", w: 0.7, h: 0.6 }
        ]
      }
    ]
  },
  {
    name: "Phòng ngủ",
    items: [
      {
        type: "bed_bed",
        name: "Giường ngủ",
        subItems: [
          { type: "bed_bed", name: "Giường Cal-King", style: "cal_king", w: 2.13, h: 1.83 },
          { type: "bed_bed", name: "Cũi em bé", style: "crib", w: 1.3, h: 0.7 },
          { type: "bed_bed", name: "Giường đôi (Full)", style: "full", w: 1.9, h: 1.37 },
          { type: "bed_bed", name: "Giường King", style: "king", w: 2.03, h: 1.93 },
          { type: "bed_bed", name: "Giường Queen", style: "queen", w: 2.03, h: 1.52 },
          { type: "bed_bed", name: "Giường đơn (Twin)", style: "twin", w: 1.9, h: 0.99 }
        ]
      },
      { type: "bed_dresser", name: "Tủ ngăn kéo", w: 1.2, h: 0.5 },
      { type: "bed_nightstand", name: "Tủ đầu giường", w: 0.5, h: 0.5 },
      { type: "bed_wardrobe", name: "Tủ quần áo", w: 1.5, h: 0.6 }
    ]
  },
  {
    name: "Lối vào & Giặt giũ",
    items: [
      { type: "entry_bench", name: "Ghế băng", w: 1.2, h: 0.45 },
      { type: "entry_coat_stand", name: "Móc treo quần áo", w: 0.45, h: 0.45 },
      { type: "entry_console_mirror", name: "Bàn phụ có gương", w: 1.0, h: 0.4 },
      {
        type: "laundry_machines",
        name: "Máy giặt sấy",
        subItems: [
          { type: "laundry_machines", name: "Đặt song song", style: "side_by_side", w: 1.4, h: 0.7 },
          { type: "laundry_machines", name: "Đặt xếp chồng", style: "stacked", w: 0.7, h: 0.7 }
        ]
      },
      { type: "laundry_sink", name: "Chậu giặt", w: 0.65, h: 0.6 }
    ]
  },
  {
    name: "Nhà xe & Kho",
    items: [
      { type: "entry_coat_stand", name: "Giá treo quần áo", w: 1.2, h: 0.5 },
      { type: "garage_generic_object", name: "Đồ dùng khác", w: 0.8, h: 0.8 },
      { type: "garage_hvac", name: "Cục nóng điều hòa", w: 0.9, h: 0.4 },
      {
        type: "garage_car",
        name: "Xe ô tô",
        subItems: [
          { type: "garage_car", name: "Xe Sedan", style: "sedan", w: 1.8, h: 4.2 },
          { type: "garage_car", name: "Xe SUV", style: "suv", w: 2.0, h: 4.8 }
        ]
      },
      { type: "garage_water_heater", name: "Máy nước nóng", w: 0.5, h: 0.5 }
    ]
  },
  {
    name: "Phòng Gym",
    items: [
      { type: "gym_bike", name: "Xe đạp tập thể dục", w: 1.1, h: 0.6 },
      { type: "gym_bench", name: "Ghế tập gym", w: 1.2, h: 0.5 },
      { type: "gym_treadmill", name: "Máy chạy bộ", w: 1.6, h: 0.8 },
      { type: "gym_weight_rack", name: "Giá để tạ", w: 1.0, h: 0.5 },
      { type: "gym_yoga_mat", name: "Thảm tập Yoga", w: 1.8, h: 0.6 }
    ]
  },
  {
    name: "Bếp & Phòng ăn",
    items: [
      { type: "kitchen_counter", name: "Bàn bếp / Hệ tủ bếp", w: 2.4, h: 0.6 },
      { type: "kitchen_cooktop", name: "Bếp nấu", w: 0.7, h: 0.35 },
      { type: "kitchen_sink", name: "Bồn rửa bát", w: 0.5, h: 0.35 },
      { type: "kitchen_fridge", name: "Tủ lạnh", w: 0.65, h: 0.65 },
      { type: "dining_table", name: "Bàn ăn", w: 1.4, h: 0.9 }
    ]
  },
  {
    name: "Phòng khách",
    items: [
      {
        type: "living_sofa",
        name: "Ghế Sofa",
        subItems: [
          { type: "living_sofa", name: "Sofa góc chữ L", style: "sectional", w: 2.6, h: 1.6 },
          { type: "living_sofa", name: "Sofa 3 chỗ", style: "three_seater", w: 2.1, h: 0.9 },
          { type: "living_sofa", name: "Sofa 2 chỗ", style: "two_seater", w: 1.6, h: 0.9 }
        ]
      },
      { type: "living_tv", name: "Kệ tivi", w: 1.6, h: 0.25 },
      { type: "living_chair", name: "Ghế bành", w: 0.65, h: 0.65 },
      { type: "living_bookshelf", name: "Kệ sách", w: 1.0, h: 0.35 },
      { type: "living_credenza", name: "Tủ kệ trang trí", w: 1.4, h: 0.4 },
      { type: "living_coffee_table", name: "Bàn trà", w: 1.0, h: 0.6 },
      { type: "living_side_table", name: "Bàn bên / Bàn góc", w: 0.5, h: 0.5 }
    ]
  },
  {
    name: "Phòng làm việc",
    items: [
      { type: "office_filing_cabinet", name: "Tủ tài liệu / Tủ hồ sơ", w: 0.6, h: 0.5 },
      { type: "office_chair", name: "Ghế văn phòng", w: 0.6, h: 0.6 },
      {
        type: "office_desk",
        name: "Bàn làm việc",
        subItems: [
          { type: "office_desk", name: "Bàn giám đốc", style: "executive", w: 1.8, h: 0.9 },
          { type: "office_desk", name: "Bàn làm việc đơn", style: "standard", w: 1.4, h: 0.7 },
          { type: "office_desk", name: "Bàn góc chữ L", style: "l_shape", w: 1.6, h: 1.2 }
        ]
      }
    ]
  },
  {
    name: "Ngoài trời",
    items: [
      { type: "outdoor_bbq", name: "Bếp nướng BBQ", w: 1.0, h: 0.6 },
      {
        type: "outdoor_lounge_chair",
        name: "Ghế nằm thư giãn",
        subItems: [
          { type: "outdoor_lounge_chair", name: "Ghế tắm nắng", style: "sun_lounger", w: 0.7, h: 1.8 },
          { type: "outdoor_lounge_chair", name: "Ghế bành mây", style: "wicker", w: 0.8, h: 0.8 }
        ]
      },
      { type: "outdoor_dining_set", name: "Bộ bàn ghế ngoài trời", w: 1.6, h: 1.6 },
      { type: "plant_pots", name: "Cây cảnh ngoài trời", w: 0.5, h: 0.5 }
    ]
  },
  {
    name: "Giải trí",
    items: [
      { type: "recreation_pool_table", name: "Bàn Bi-a", w: 1.6, h: 2.8 }
    ]
  }
];

// ══════════════════════════════════════════════════════════════════════════
export const FloorPlanEditor: React.FC = () => {
  const navigate = useNavigate();
  const { user, socket } = useAuth();

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

  // ── Project History state ──────────────────────────────────────────────────
  const [projects, setProjects] = useState<any[]>(() => {
    try {
      const savedProjectsStr = localStorage.getItem("igen_floorplan_projects") || "[]";
      return JSON.parse(savedProjectsStr);
    } catch (_e) {
      return [];
    }
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"chat" | "history">("chat");

  const handleLoadProject = useCallback((proj: any) => {
    setCurrentProjectId(proj.id);
    setProjectName(proj.name);
    setFloorPlans(proj.floorPlans || []);
    setActiveFloorIndex(proj.activeFloorIndex || 0);
    setGatherInfo(proj.gatherInfo || {});
    setCurrentStep(proj.currentStep || "floors");
    setCompletedSteps(new Set(proj.completedSteps || []));
    setMessages(proj.messages || []);
    
    if (proj.floorPlans && proj.floorPlans.length > 0) {
      setFloorPlan(proj.floorPlans[proj.activeFloorIndex || 0]);
    } else {
      setFloorPlan(null);
    }
    
    setActiveSidebarTab("chat");
    toast.success(`Đã tải dự án: ${proj.name}`);
  }, []);

  const handleNewProject = useCallback(() => {
    const newId = "proj_" + Date.now();
    
    const newProject = {
      id: newId,
      name: "Untitled Project",
      floorPlans: [],
      activeFloorIndex: 0,
      gatherInfo: {},
      currentStep: "floors",
      completedSteps: [],
      messages: [
        {
          id: "msg_" + Date.now(),
          role: "assistant" as const,
          content: "Xin chào! Tôi sẽ giúp bạn tạo bản vẽ mặt bằng với AI.\n\nHãy bắt đầu — **Công trình của bạn có bao nhiêu tầng?**",
          timestamp: new Date(),
        }
      ],
      updatedAt: new Date().toISOString(),
    };
    
    try {
      const savedProjectsStr = localStorage.getItem("igen_floorplan_projects") || "[]";
      const savedProjects = JSON.parse(savedProjectsStr);
      savedProjects.push(newProject);
      localStorage.setItem("igen_floorplan_projects", JSON.stringify(savedProjects));
      setProjects(savedProjects);
    } catch (err) {
      console.error(err);
    }
    
    setCurrentProjectId(newId);
    setProjectName("Untitled Project");
    setFloorPlans([]);
    setActiveFloorIndex(0);
    setGatherInfo({});
    setCurrentStep("floors");
    setCompletedSteps(new Set());
    setMessages(newProject.messages);
    setFloorPlan(null);
    
    setActiveSidebarTab("chat");
    toast.success("Đã tạo dự án mới");
  }, []);

  const handleDeleteProject = useCallback((projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const savedProjectsStr = localStorage.getItem("igen_floorplan_projects") || "[]";
      let savedProjects = JSON.parse(savedProjectsStr);
      savedProjects = savedProjects.filter((p: any) => p.id !== projId);
      localStorage.setItem("igen_floorplan_projects", JSON.stringify(savedProjects));
      setProjects(savedProjects);
      
      if (currentProjectId === projId) {
        if (savedProjects.length > 0) {
          const sorted = [...savedProjects].sort((a: any, b: any) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          handleLoadProject(sorted[0]);
        } else {
          handleNewProject();
        }
      }
      toast.success("Đã xóa dự án");
    } catch (err) {
      console.error("Error deleting project:", err);
    }
  }, [currentProjectId, handleLoadProject, handleNewProject]);

  // ── Project History Pagination & Editing State ─────────────────────────────
  const [historyPage, setHistoryPage] = useState(1);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");

  const handleSaveProjectName = useCallback((projId: string) => {
    if (!editingProjectName.trim()) {
      setEditingProjectId(null);
      return;
    }
    try {
      const savedProjectsStr = localStorage.getItem("igen_floorplan_projects") || "[]";
      const savedProjects = JSON.parse(savedProjectsStr);
      const updated = savedProjects.map((p: any) => 
        p.id === projId ? { ...p, name: editingProjectName.trim(), updatedAt: new Date().toISOString() } : p
      );
      updated.sort((a: any, b: any) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      const capped = updated.slice(0, 20);
      localStorage.setItem("igen_floorplan_projects", JSON.stringify(capped));
      setProjects(capped);
      
      if (currentProjectId === projId) {
        setProjectName(editingProjectName.trim());
      }
      
      setEditingProjectId(null);
      toast.success("Đã đổi tên dự án");
    } catch (err) {
      console.error("Error renaming project:", err);
    }
  }, [editingProjectName, currentProjectId]);

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
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  const [renderResult, setRenderResult] = useState<string | null>(null);
  const [isRendering3D, setIsRendering3D] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderStatusMessage, setRenderStatusMessage] = useState<string>("");
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
  const [renderMode, setRenderMode] = useState<"Floorplan to 3D" | "Floorplan to 3D Floorplan">("Floorplan to 3D");
  const capture3DRef = useRef<(() => string) | null>(null);

  // ── Undo/Redo history ────────────────────────────────────────────────────
  const [historyStack, setHistoryStack] = useState<FloorPlanData[]>([]);
  const [redoStack, setRedoStack] = useState<FloorPlanData[]>([]);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showLabels, setShowLabels] = useState(false);

  // ── Draw-Wall mode state ──────────────────────────────────────────────────
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [drawMousePos, setDrawMousePos] = useState<{ x: number; y: number } | null>(null);
  const [drawWallRoomName, setDrawWallRoomName] = useState<string>("Phòng mới");
  const [showDrawWallNameModal, setShowDrawWallNameModal] = useState(false);
  const [activeTool, setActiveTool] = useState<"select" | "draw_wall">("select");

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

  // ── Sync cameras for rooms ─────────────────────────────────────────
  useEffect(() => {
    if (floorPlan) {
      const updatedCameras = { ...cameras };
      let changed = false;

      // 1. Dọn dẹp camera của phòng đã bị xóa
      const currentRoomIds = new Set(floorPlan.rooms.map(r => r.id));
      Object.keys(updatedCameras).forEach((roomId) => {
        if (!currentRoomIds.has(roomId)) {
          delete updatedCameras[roomId];
          changed = true;
        }
      });

      // 2. Khởi tạo hoặc cập nhật vị trí camera theo tâm phòng mới khi ở tab layout
      floorPlan.rooms.forEach((room) => {
        const centerX = room.x + room.w / 2;
        const centerY = room.y + room.h / 2;
        const cam = updatedCameras[room.id];

        if (!cam) {
          updatedCameras[room.id] = {
            x: centerX,
            y: centerY,
            rotation: 90,
            fov: 85,
            aspectRatio: "Landscape (4:3)",
            prompt: "",
          };
          changed = true;
        } else if (activeTab === "layout") {
          // Khi ở tab layout, camera luôn bám theo tâm phòng
          if (Math.abs(cam.x - centerX) > 0.01 || Math.abs(cam.y - centerY) > 0.01) {
            updatedCameras[room.id] = {
              ...cam,
              x: centerX,
              y: centerY
            };
            changed = true;
          }
        }
      });

      if (changed) {
        setTimeout(() => {
          setCameras(updatedCameras);
        }, 0);
      }
    }
  }, [floorPlan, activeTab]);

  // ── Auto-scroll chat ────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Project History load & auto-save effects ────────────────────────────
  // On mount: Start with a clean slate (reset all)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Start with a new blank slate (not saved to list until edited/interacted with)
        const newId = "proj_" + Date.now();
        setCurrentProjectId(newId);
        setProjectName("Untitled Project");
        setFloorPlans([]);
        setActiveFloorIndex(0);
        setGatherInfo({});
        setCurrentStep("floors");
        setCompletedSteps(new Set());
        setMessages([
          {
            id: "msg_init_" + newId,
            role: "assistant" as const,
            content: "Xin chào! Tôi sẽ giúp bạn tạo bản vẽ mặt bằng với AI.\n\nHãy bắt đầu — **Công trình của bạn có bao nhiêu tầng?**",
            timestamp: new Date(),
          }
        ]);
        setFloorPlan(null);
      } catch (err) {
        console.error("Error loading project history:", err);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Debounced auto-save current project to the list of projects
  useEffect(() => {
    if (!currentProjectId) return;
    
    // Check if the project is completely blank/empty to avoid polluting history on refresh
    const isEmpty = 
      projectName === "Untitled Project" &&
      floorPlans.length === 0 &&
      Object.keys(gatherInfo).length === 0 &&
      messages.length === 1 &&
      messages[0]?.content.includes("Xin chào! Tôi sẽ giúp bạn tạo bản vẽ mặt bằng");
      
    if (isEmpty) return; // Do not auto-save a blank, untouched project
    
    const timer = setTimeout(() => {
      try {
        const savedProjectsStr = localStorage.getItem("igen_floorplan_projects") || "[]";
        const savedProjects = JSON.parse(savedProjectsStr);
        
        const existingIdx = savedProjects.findIndex((p: any) => p.id === currentProjectId);
        const updatedProject = {
          id: currentProjectId,
          name: projectName,
          floorPlans,
          activeFloorIndex,
          gatherInfo,
          currentStep,
          completedSteps: Array.from(completedSteps),
          messages,
          updatedAt: new Date().toISOString(),
        };
        
        if (existingIdx >= 0) {
          savedProjects[existingIdx] = updatedProject;
        } else {
          savedProjects.push(updatedProject);
        }
        
        localStorage.setItem("igen_floorplan_projects", JSON.stringify(savedProjects));
        setProjects(savedProjects);
      } catch (err) {
        console.error("Error auto-saving project:", err);
      }
    }, 800);
    
    return () => clearTimeout(timer);
  }, [currentProjectId, projectName, floorPlans, activeFloorIndex, gatherInfo, currentStep, completedSteps, messages]);

  // ── Undo/Redo keyboard shortcut ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape cancels draw_wall mode
      if (e.key === "Escape") {
        if (activeTool === "draw_wall") {
          setDrawingPoints([]);
          setDrawMousePos(null);
          setActiveTool("select");
        }
        return;
      }
      // Enter / Backspace during draw mode
      if (activeTool === "draw_wall") {
        if (e.key === "Backspace") {
          setDrawingPoints(prev => prev.slice(0, -1));
          return;
        }
        return;
      }
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
  }, [floorPlan, floorPlans, activeFloorIndex, activeTool]);

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

  // Listen to socket updates for the active rendering job
  useEffect(() => {
    if (!socket || !activeJobId) return;

    const handleJobUpdate = (updatedJob: any) => {
      const jobId = updatedJob._id || updatedJob.id;
      if (jobId === activeJobId) {
        setRenderProgress(updatedJob.progress || 0);
        setRenderStatusMessage(updatedJob.statusMessage || "");
        if (updatedJob.status === "completed") {
          const finalUrl = updatedJob.outputImageUrls?.[0];
          if (finalUrl) {
            setRenderResult(finalUrl);
            toast.success("Render 3D hoàn tất!");
            addMessage("assistant", "✅ Phối cảnh 3D đã hoàn thành! Bạn có thể tải về bên dưới.");
          }
          setIsRendering3D(false);
          setActiveJobId(null);
        } else if (updatedJob.status === "failed" || updatedJob.status === "error") {
          toast.error(updatedJob.statusMessage || "Lỗi render.");
          addMessage("assistant", "❌ Lỗi render 3D. Vui lòng thử lại.");
          setIsRendering3D(false);
          setActiveJobId(null);
        }
      }
    };

    socket.on("renderJobUpdated", handleJobUpdate);
    return () => {
      socket.off("renderJobUpdated", handleJobUpdate);
    };
  }, [socket, activeJobId, addMessage]);

  // Polling fallback for render job status
  useEffect(() => {
    if (!activeJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get<ApiResponse<any>>(`/api/v1/render-jobs/${activeJobId}`);
        if (res.success && res.data) {
          const job = res.data;
          setRenderProgress(job.progress || 0);
          setRenderStatusMessage(job.statusMessage || "");
          if (job.status === "completed") {
            const finalUrl = job.outputImageUrls?.[0];
            if (finalUrl) {
              setRenderResult(finalUrl);
              toast.success("Render 3D hoàn tất!");
              addMessage("assistant", "✅ Phối cảnh 3D đã hoàn thành! Bạn có thể tải về bên dưới.");
            }
            setIsRendering3D(false);
            setActiveJobId(null);
          } else if (job.status === "failed" || job.status === "error") {
            toast.error(job.statusMessage || "Lỗi render.");
            addMessage("assistant", "❌ Lỗi render 3D. Vui lòng thử lại.");
            setIsRendering3D(false);
            setActiveJobId(null);
          }
        }
      } catch (e) {
        console.error("Error polling render job:", e);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeJobId, addMessage]);

  // ── Gemini 2.5 Flash Conversational Handler ────────────────────────
  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isGenerating || isTyping) return;

    setInputValue("");
    addMessage("user", text);
    setIsTyping(true);

    // Enforce a minimum 3-second "thinking" delay before showing AI reply
    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 3000));

    try {
      const ai = await getAIClient("gemini-2.5-flash");

      // Build conversation history for Gemini
      const conversationHistory = messages
        .filter((m) => m.content !== "__SHAPE_PICKER__" && m.content !== "__ROOM_PICKER__" && !m.content.startsWith("__2D_PREVIEW__"))
        .map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content.replace(/__SHAPE_PICKER__/g, "[Người dùng đã chọn hình dạng mặt bằng]") }],
        }));

      // Current gathered info for context
      const gatheredContext = Object.entries(gatherInfo)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");

      const systemInstruction = `Bạn là iGen - Trợ lý AI cao cấp chuyên thiết kế bản vẽ mặt bằng và phối cảnh kiến trúc.
Nhiệm vụ của bạn là hỗ trợ người dùng toàn diện trong suốt dự án:
1. Hướng dẫn người dùng các bước thực hiện trên giao diện nếu họ hỏi cách làm (ví dụ: cách gen ảnh 3D, cách tải ảnh phối cảnh, cách vẽ thêm phòng...).
2. Thu thập thông tin ban đầu (Số tầng, Kích thước đất, Hình dạng, Số phòng) để tạo bản vẽ mặt bằng tự động.
3. Thực hiện trực tiếp các hành động thêm đồ nội thất hoặc thêm cửa/cửa sổ lên bản vẽ hoặc render 3D khi người dùng yêu cầu (ví dụ: "Thêm cho tôi một bộ sofa", "Thêm cửa sổ", "Đặt tủ quần áo", "Render 3D phối cảnh phòng này").

Quy tắc bắt buộc:
1. Bạn phải luôn trả lời bằng tiếng Việt ngắn gọn, thân thiện, mang tính kiến trúc chuyên nghiệp.
2. Nếu người dùng muốn thực hiện một hành động (thêm đồ vật, thêm cửa, render 3D, v.v.), bạn hãy đưa hành động tương ứng vào trường "actions" trong JSON phản hồi.

Danh sách các mã loại đồ nội thất (furniture_type) được hỗ trợ:
- Sofa phòng khách: "living_sofa"
- Kệ tivi: "living_tv"
- Giường ngủ: "bed_bed"
- Tủ quần áo: "bed_wardrobe"
- Tủ ngăn kéo: "bed_dresser"
- Bàn ăn: "dining_table"
- Bàn bếp/Hệ tủ bếp: "kitchen_counter"
- Bếp nấu: "kitchen_cooktop"
- Bồn rửa bát: "kitchen_sink"
- Tủ lạnh: "kitchen_fridge"
- Bồn cầu: "bath_toilet"
- Chậu rửa mặt (lavabo): "bath_lavabo"
- Bồn tắm: "bath_bathtub"
- Vòi sen đứng: "wc_shower"
- Bàn làm việc: "office_desk"
- Ghế văn phòng: "office_chair"
- Xe ô tô: "garage_car"
- Cầu thang: "stairs"
- Chậu cây cảnh: "plant_pots"
- Máy chạy bộ: "gym_treadmill"
- Bàn bi-a: "recreation_pool_table"
- Ghế dài decor: "decor_bench"
- Cột treo quần áo: "decor_coat_stand"
- Gương tủ trang trí: "decor_console_mirror"
- Máy giặt sấy: "decor_laundry_machines"
- Bồn giặt: "decor_laundry_sink"

Danh sách các kiểu dáng cửa đi (style của door):
- Cửa đi bản lề: "hinged"
- Cửa lùa: "sliding"
- Cửa cuốn garage: "garage"

Danh sách các kiểu dáng cửa sổ (style của window):
- Cửa sổ bản lề: "hinged"
- Cửa sổ lùa: "sliding"
- Cửa sổ chớp/màn sáo: "blinds"

Các hành động (actions) được hỗ trợ trong JSON:
- Thêm đồ nội thất: { "type": "add_furniture", "furniture_type": "[MÃ_LOẠI_ĐỒ]" }
- Thêm cửa đi: { "type": "add_door", "style": "[KIỂU_DÁNG]" }
- Thêm cửa sổ: { "type": "add_window", "style": "[KIỂU_DÁNG]" }
- Render 3D phối cảnh: { "type": "render_3d" }
- Hiển thị bảng chọn hình dạng đất: { "type": "show_shape_picker" }
- Hiển thị bảng thêm phòng: { "type": "show_room_picker" }

Hãy phân tích kỹ yêu cầu của người dùng để trả về phản hồi JSON theo cấu trúc sau:
{
  "reply": "tin nhắn phản hồi bằng tiếng Việt thân thiện, mô tả những gì bạn vừa làm hoặc hướng dẫn người dùng cách làm.",
  "actions": [
    // Danh sách các hành động cần thực thi (nếu có), có thể rỗng []
  ],
  "extracted": {
    "floors": null, // hoặc số tầng chiết xuất được
    "area": null, // hoặc diện tích chiết xuất được
    "landWidth": null, // hoặc chiều rộng đất
    "landLength": null, // hoặc chiều dài đất
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
        await minDelay;
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

      // Wait for the minimum 3-second thinking delay before showing the reply
      await minDelay;

      if (needsShapePicker) {
        // Show shape picker bubble
        addMessage("assistant", "__SHAPE_PICKER__");
        setCurrentStep("shape");
        setShowShapeModal(true);
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

      // Execute any direct actions requested by the AI
      if (Array.isArray(parsed.actions)) {
        for (const action of parsed.actions) {
          if (action.type === "add_furniture") {
            const fType = action.furniture_type;
            if (fType) {
              handleAddFurniture(fType);
            }
          } else if (action.type === "add_door") {
            handleAddDoor(action.style || "hinged");
          } else if (action.type === "add_window") {
            handleAddWindow(action.style || "hinged");
          } else if (action.type === "render_3d") {
            handleRender3D();
          } else if (action.type === "show_shape_picker") {
            setShowShapeModal(true);
          } else if (action.type === "show_room_picker") {
            setShowRoomsModal(true);
          }
        }
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
  const handleShapeSelected = async (shapeName: string, points?: { x: number; y: number }[], width?: number, length?: number) => {
    setShowShapeModal(false);

    const w = width ?? gatherInfo.landWidth ?? 5;
    const l = length ?? gatherInfo.landLength ?? 15;

    addMessage("user", `Hình dạng mặt bằng: ${shapeName} (${w}m × ${l}m)`);

    setCompletedSteps((prev) => new Set([...prev, "shape" as GatherStep, "area" as GatherStep]));
    const newInfo: GatherInfo = {
      ...gatherInfo,
      shape: shapeName,
      shapePoints: points,
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

    const shapePoints = info.shapePoints || getDefaultPointsForShape(shape, landW, landL);
    let shapeInstruction: string;
    
    // Add custom cutout rule description based on shape name
    let cutoutDescription = "";
    const normName = shape.toLowerCase();
    if (normName.includes("l-shape (top-right)") || normName.includes("l-shape") || normName.includes("chữ l")) {
      if (normName.includes("bottom-left")) {
        cutoutDescription = `Vùng khuyết góc dưới bên trái (x từ 0m đến ${(0.35 * landW).toFixed(2)}m và y từ ${(0.65 * landL).toFixed(2)}m đến ${landL}m) là khoảng trống ngoài ranh giới, TUYỆT ĐỐI KHÔNG được đặt phòng nào ở đây.`;
      } else if (normName.includes("bottom-right")) {
        cutoutDescription = `Vùng khuyết góc dưới bên phải (x từ ${(0.65 * landW).toFixed(2)}m đến ${landW}m và y từ ${(0.65 * landL).toFixed(2)}m đến ${landL}m) là khoảng trống ngoài ranh giới, TUYỆT ĐỐI KHÔNG được đặt phòng nào ở đây.`;
      } else {
        // default Top-Right
        cutoutDescription = `Vùng khuyết góc trên bên phải (x từ ${(0.65 * landW).toFixed(2)}m đến ${landW}m và y từ 0m đến ${(0.35 * landL).toFixed(2)}m) là khoảng trống ngoài ranh giới, TUYỆT ĐỐI KHÔNG được đặt phòng nào ở đây.`;
      }
    } else if (normName.includes("u-shape") || normName.includes("chữ u")) {
      cutoutDescription = `Vùng khuyết ở giữa phía dưới (x từ ${(0.3 * landW).toFixed(2)}m đến ${(0.7 * landW).toFixed(2)}m và y từ ${(0.8 * landL).toFixed(2)}m đến ${landL}m) là khoảng trống ngoài ranh giới, TUYỆT ĐỐI KHÔNG được đặt phòng ở đây.`;
    } else if (normName.includes("t-shape") || normName.includes("chữ t")) {
      cutoutDescription = `Có 2 vùng khuyết ngoài ranh giới: Góc trên bên trái (x từ 0m đến ${(0.25 * landW).toFixed(2)}m và y từ 0m đến ${(0.35 * landL).toFixed(2)}m) và Góc trên bên phải (x từ ${(0.75 * landW).toFixed(2)}m đến ${landW}m và y từ 0m đến ${(0.35 * landL).toFixed(2)}m). TUYỆT ĐỐI KHÔNG đặt phòng nào ở hai góc này.`;
    } else if (normName.includes("h-shape") || normName.includes("chữ h")) {
      cutoutDescription = `Có 2 vùng khuyết ngoài ranh giới: Giữa phía trên (x từ ${(0.3 * landW).toFixed(2)}m đến ${(0.7 * landW).toFixed(2)}m và y từ 0m đến ${(0.25 * landL).toFixed(2)}m) và Giữa phía dưới (x từ ${(0.3 * landW).toFixed(2)}m đến ${(0.7 * landW).toFixed(2)}m và y từ ${(0.75 * landL).toFixed(2)}m đến ${landL}m). TUYỆT ĐỐI KHÔNG đặt phòng nào ở hai khoảng khuyết này.`;
    } else if (normName.includes("cross") || normName.includes("chữ thập")) {
      cutoutDescription = `Bốn góc xung quanh bị khuyết ngoài ranh giới (chỉ được thiết kế các phòng xếp theo dạng chữ thập cộng (+) nằm trong lõi và các nhánh ranh giới). TUYỆT ĐỐI KHÔNG đặt phòng ở các góc ngoài ranh giới này.`;
    }

    if (shapePoints && shapePoints.length > 0) {
      const pointsDesc = shapePoints.map(p => `(${p.x.toFixed(2)}m, ${p.y.toFixed(2)}m)`).join(" -> ");
      shapeInstruction = `
- Đa giác ranh giới của mặt bằng đất (hình dạng ${shape}) có các đỉnh tọa độ theo thứ tự là: ${pointsDesc}.
- ${cutoutDescription}
- Quy tắc bắt buộc: Mọi phòng được sinh ra phải nằm HOÀN TOÀN bên trong ranh giới đa giác này. Không được có bất kỳ phần nào của bất kỳ phòng nào vượt ra ngoài ranh giới đa giác này hoặc nằm trong vùng khuyết. Kích thước ngoài của các phòng ghép lại phải tạo ra đúng hình dạng ${shape} đã chọn.`;
    } else {
      shapeInstruction = `
- Mặt bằng đất là hình chữ nhật kích thước ${landW}m x ${landL}m. Các phòng phải nằm hoàn toàn trong phạm vi x ∈ [0, ${landW}] và y ∈ [0, ${landL}].`;
    }

    const generatedPlans: FloorPlanData[] = [];

    // Build per-floor room strings from roomSelection (structured) when available
    const getRoomsForFloor = (floorIndex: number): string => {
      const floorNum = floorIndex + 1; // roomSelection is 1-indexed
      if (info.roomSelection && info.roomSelection[floorNum] && info.roomSelection[floorNum].length > 0) {
        return info.roomSelection[floorNum]
          .map((r) => `${r.count} ${r.name}`)
          .join(", ");
      }
      // Fallback: if totalFloors = 1 or no per-floor selection, use the full rooms string
      if (totalFloors === 1) return rooms;
      // For multi-floor fallback, try to parse from the combined rooms string by floor label
      const floorLabel = `Tầng ${floorIndex + 1}`;
      const regex = new RegExp(`${floorLabel}:\\s*([^.]+)`, "i");
      const match = rooms.match(regex);
      return match ? match[1].trim() : rooms;
    };

    try {
      for (let floor = 0; floor < totalFloors; floor++) {
        const floorLabel = `Tầng ${floor + 1}`;
        const floorRooms = getRoomsForFloor(floor);
        const promptModel = "gemini-2.5-flash";
        const ai = await getAIClient(promptModel);

        const aiPrompt = `Bạn là Kiến trúc sư AI chuyên thiết kế mặt bằng nhà ở Việt Nam.
Nhiệm vụ: Tạo phương án phân chia mặt bằng tối ưu cho ${floorLabel} của một công trình.

Thông tin đầu vào:
- Kích thước lô đất: ${landW}m x ${landL}m
- Hình dạng mặt bằng: ${shape}
${shapeInstruction}
- Yêu cầu phòng cho ${floorLabel}: ${floorRooms}
- Phong cách / yêu cầu bổ sung: ${extras}
- Tổng số tầng: ${totalFloors} tầng

QUY TẮC THIẾT KẾ BẮT BUỘC (TUÂN THỦ TUYỆT ĐỐI):

1. YÊU CẦU PHÒNG & KHÔNG ĐỂ THỪA ĐẤT:
   - CHỈ tạo đúng các phòng đã được yêu cầu cụ thể cho ${floorLabel}: "${floorRooms}". TUYỆT ĐỐI KHÔNG thêm phòng phụ ngoài yêu cầu và KHÔNG được tự ý bớt phòng. Mảng "rooms" trả về phải gồm chính xác số lượng và loại phòng này, không tự ý thêm phòng thờ, phòng sinh hoạt chung, hành lang (hành lang được thiết kế như khoảng trống giao thông giữa các phòng, không khai báo thành thực thể phòng trong JSON trừ khi được yêu cầu), phòng làm việc, vv nếu không có trong yêu cầu.
   - KHÔNG ĐỂ THỪA ĐẤT: Tổng diện tích các phòng cộng lại và ghép lại phải bao phủ hoàn toàn diện tích cho phép của lô đất (đa giác ranh giới). Không được để trống bất kỳ góc nào hay để chừa đất trống ở các góc biên ranh giới.
   - PHÂN BỔ TỶ LỆ DIỆN TÍCH THÔNG MINH (PHÒNG LỚN/NHỎ HỢP LÝ): Khi chia diện tích, hãy đảm bảo các phòng chính như Phòng khách (Living room), Phòng ngủ Master (Master Bedroom) phải RỘNG RÃI (ví dụ: phòng khách nên rộng nhất, chiếm từ 15m² - 25m²; phòng ngủ master từ 12m² - 18m²). Ngược lại, các phòng phụ như Phòng vệ sinh / Toilet / WC, Phòng giặt (Laundry), Lối đi phải thiết kế nhỏ gọn, HẸP và tiết kiệm diện tích tối đa (ví dụ: WC/Toilet chỉ nên rộng từ 2.2m² - 4m²). Tuyệt đối không để phòng vệ sinh quá rộng tương đương phòng ngủ hay phòng khách, gây lãng phí không gian.
   - KHỚP KHÍT RANH GIỚI: Để lấp đầy diện tích đất mà không thêm phòng phụ, hãy TỰ ĐỘNG TĂNG KÍCH THƯỚC của các phòng được yêu cầu sao cho tổng chiều rộng và chiều dài của các phòng ghép lại vừa khít với ranh giới đất ở mọi hướng (nhưng phải giữ tỷ lệ phòng khách lớn và WC nhỏ).

2. KÍCH THƯỚC TỐI THIỂU BẮT BUỘC CHO TỪNG LOẠI PHÒNG (phải đảm bảo đủ diện tích để bố trí nội thất):
   - Phòng khách (living room): tối thiểu 3.0m x 4.0m (12m²), ưu tiên 4m x 5m trở lên
   - Phòng ngủ đơn / nhỏ (single bedroom): tối thiểu 2.5m x 3.0m (7.5m²)
   - Phòng ngủ đôi / master (double/master bedroom): tối thiểu 3.0m x 3.5m (10.5m²), ưu tiên 3.5m x 4.5m
   - Phòng bếp (kitchen): tối thiểu 2.5m x 3.0m (7.5m²), thường 3m x 4m
   - Phòng ăn (dining room): tối thiểu 2.5m x 3.0m (7.5m²)
   - Phòng vệ sinh / WC nhỏ (half bathroom): tối thiểu 1.2m x 1.8m (2.2m²)
   - Phòng tắm đầy đủ (full bathroom): tối thiểu 1.8m x 2.5m (4.5m²)
   - Phòng làm việc (office/study): tối thiểu 2.5m x 3.0m (7.5m²)
   - Garage / nhà xe: tối thiểu 3.0m x 5.5m (16.5m²)
   - Phòng giặt (laundry): tối thiểu 1.5m x 2.0m (3.0m²)
   - Sảnh / lối vào (entry/foyer): tối thiểu 1.5m x 2.0m (3.0m²)
   - Hành lang / lối đi: rộng tối thiểu 1.0m
   Lưu ý: nếu lô đất nhỏ không đủ để đạt kích thước khuyến nghị, hãy ưu tiên đạt kích thước TỐI THIỂU và phân bổ phần diện tích còn lại cho các phòng chính lớn hơn.

3. QUY TẮC BỐ TRÍ CÁC PHÒNG CHUẨN CÔNG NĂNG:
   - Phòng khách: Đặt gần cửa chính/lối vào, làm trung tâm kết nối các khu vực, thuận tiện tiếp cận các phòng khác.
   - Phòng bếp: Đặt liền kề hoặc gần phòng ăn. Không đặt bếp làm lối đi bắt buộc để vào các phòng khác. Hạn chế đặt sát phòng ngủ nếu còn phương án tốt hơn.
   - Phòng ăn: Liền kề phòng bếp và kết nối thuận tiện với phòng khách.
   - Phòng ngủ: Gần phòng vệ sinh, đảm bảo sự riêng tư, hạn chế mở cửa trực tiếp ra phòng khách nếu có hành lang thay thế, và không làm lối đi sang phòng khác.
   - Phòng vệ sinh (Toilet/WC): Phải đặt rất gần hoặc tiếp giáp phòng ngủ. Không đặt ngay trước cửa chính hoặc ở giữa phòng khách. Có thể dùng chung cho nhiều phòng ngủ nếu hợp lý.
   - Phòng làm việc: Đặt ở khu vực yên tĩnh, tách biệt với phòng khách.
   - Phòng giặt: Gần khu vực sân hoặc ban công nếu có.

4. LUỒNG GIAO THÔNG & ÁNH SÁNG:
   - Có thể đi từ cửa chính đến mọi phòng mà không phải đi xuyên qua phòng ngủ. Hạn chế đi xuyên qua bếp để đến các khu vực khác. Đường di chuyển ngắn, rõ ràng, hợp lý.
   - Ưu tiên các phòng chính (phòng khách, phòng ngủ) tiếp xúc với mặt ngoài công trình để có cửa sổ đón ánh sáng tự nhiên nhiều nhất.

5. HÌNH HỌC & ĐỘ LIỀN MẠCH:
   - Ưu tiên các phòng có hình chữ nhật hoặc hình vuông.
   - Các phòng bắt buộc phải thiết kế LIỀN MẠCH, TIẾP GIÁP TRỰC TIẾP và KHÍT NHAU (chia sẻ cạnh tường chung). KHÔNG chồng lấn (overlap) và không tạo góc chết hoặc không gian khó sử dụng.
   - Tọa độ x, y, w, h tính bằng mét (số thực). Tên phòng (name) ghi rõ bằng tiếng Việt (ví dụ: 'Phòng khách', 'Phòng ngủ 1', 'Phòng ngủ 2', 'Phòng bếp', 'Phòng ăn', 'Toilet 1', 'Toilet 2').

6. THỨ TỰ ƯU TIÊN KHI CÓ XUNG ĐỘT PHƯƠNG ÁN:
   1. Công năng sử dụng.
   2. Luồng giao thông.
   3. Mức độ riêng tư.
   4. Hiệu quả sử dụng diện tích.
   5. Thẩm mỹ và tính cân đối.

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
              const name = (r.name || "Phòng").toLowerCase();
              // Minimum room sizes per room type (to fit furniture)
              let minW = 1.5;
              let minH = 1.5;
              if (name.includes("khách") || name.includes("living") || name.includes("sinh hoạt")) {
                minW = 3.0; minH = 3.5;
              } else if (name.includes("ngủ") || name.includes("bed")) {
                minW = 2.5; minH = 3.0;
              } else if (name.includes("bếp") || name.includes("kitchen")) {
                minW = 2.0; minH = 2.5;
              } else if (name.includes("ăn") || name.includes("dining")) {
                minW = 2.5; minH = 2.5;
              } else if (name.includes("tắm") || name.includes("wc") || name.includes("toilet") || name.includes("vệ sinh")) {
                minW = 1.2; minH = 1.6;
              } else if (name.includes("gara") || name.includes("garage") || name.includes("xe")) {
                minW = 2.8; minH = 5.0;
              } else if (name.includes("giặt") || name.includes("laundry")) {
                minW = 1.5; minH = 1.8;
              } else if (name.includes("làm việc") || name.includes("office")) {
                minW = 2.5; minH = 2.5;
              } else if (name.includes("sảnh") || name.includes("lối vào") || name.includes("entry")) {
                minW = 1.5; minH = 1.8;
              } else if (name.includes("hành lang") || name.includes("lối đi")) {
                minW = 1.0; minH = 2.0;
              }
              const rw = Math.max(minW, Math.min(landW, parseFloat(r.w) || minW));
              const rh = Math.max(minH, Math.min(landL, parseFloat(r.h) || minH));
              const roomObj = {
                id: `room_${floor}_${idx}_${Date.now()}`,
                name: r.name || "Phòng",
                x: Math.max(0, Math.min(landW - rw, parseFloat(r.x) || 0)),
                y: Math.max(0, Math.min(landL - rh, parseFloat(r.y) || 0)),
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
            id: `open_${floor}_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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

      // Auto-generate 2D floor plan preview after 5 seconds and show in chat
      setTimeout(() => {
        try {
          if (stageRef.current) {
            const dataURL = stageRef.current.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
            if (dataURL && dataURL.length > 100) {
              addMessage("assistant", `__2D_PREVIEW__${dataURL}`);
            }
          }
        } catch (_err) {
          // silent – preview is optional
        }
      }, 5000);
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

  // ── Snap-to-grid helper for draw_wall ───────────────────────────────────
  const snapGridSize = 0.5; // snap every 0.5m
  const screenToWorld = (sx: number, sy: number) => {
    const scale = METER_TO_PX * zoom;
    return {
      x: (sx - pan.x) / scale,
      y: (sy - pan.y) / scale,
    };
  };
  const snapToGrid = (wx: number, wy: number) => ({
    x: Math.round(wx / snapGridSize) * snapGridSize,
    y: Math.round(wy / snapGridSize) * snapGridSize,
  });

  // ── Finalise drawn polygon into a new room ───────────────────────────────
  const finaliseDrawWall = (pts: { x: number; y: number }[]) => {
    if (pts.length < 3) {
      toast.error("Vẽ ít nhất 3 điểm để tạo phòng!");
      return;
    }
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const w = parseFloat((maxX - minX).toFixed(2));
    const h = parseFloat((maxY - minY).toFixed(2));
    if (w < 0.5 || h < 0.5) {
      toast.error("Phòng quá nhỏ, vui lòng vẽ lại!");
      return;
    }
    const newRoom: Room = {
      id: `room_drawn_${Date.now()}`,
      name: drawWallRoomName || "Phòng mới",
      x: parseFloat(minX.toFixed(2)),
      y: parseFloat(minY.toFixed(2)),
      w,
      h,
      color: ROOM_COLORS[drawWallRoomName] || ROOM_COLORS["default"],
      furniture: [],
      finishes: {
        flooring: "natural_oak",
        walls: "soft_white",
        ceiling: "paint_white",
        doors: "natural_oak",
        windows: "clear_glass",
      },
    };
    newRoom.furniture = getDefaultFurnitureForRoom(newRoom);

    if (!floorPlan) {
      // No plan yet — create a minimal one
      const plan: FloorPlanData = { rooms: [newRoom], openings: [] };
      setFloorPlan(plan);
      setFloorPlans([plan]);
    } else {
      pushHistory(floorPlan);
      const updatedPlan = { ...floorPlan, rooms: [...floorPlan.rooms, newRoom] };
      setFloorPlan(updatedPlan);
      const nextPlans = [...floorPlans];
      nextPlans[activeFloorIndex] = updatedPlan;
      setFloorPlans(nextPlans);
    }

    setSelectedRoomId(newRoom.id);
    setDrawingPoints([]);
    setDrawMousePos(null);
    setActiveTool("select");
    toast.success(`Đã tạo "${newRoom.name}" (${w.toFixed(1)} × ${h.toFixed(1)} m)`);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStageMouseDown = (e: any) => {
    // ── Draw Wall mode: place a point on click ──────────────────────────────
    if (activeTool === "draw_wall") {
      const p = e.target.getStage().getPointerPosition();
      const world = screenToWorld(p.x, p.y);
      const snapped = snapToGrid(world.x, world.y);

      // Double-click detection: if last point is very close to current → close polygon
      if (drawingPoints.length >= 2) {
        const last = drawingPoints[drawingPoints.length - 1];
        const dist = Math.sqrt((last.x - snapped.x) ** 2 + (last.y - snapped.y) ** 2);
        if (dist < 0.35) {
          // Close polygon and create room
          setShowDrawWallNameModal(true);
          return;
        }
        // Close to first point → also close
        const first = drawingPoints[0];
        const distFirst = Math.sqrt((first.x - snapped.x) ** 2 + (first.y - snapped.y) ** 2);
        if (distFirst < 0.35 && drawingPoints.length >= 3) {
          setShowDrawWallNameModal(true);
          return;
        }
      }
      setDrawingPoints(prev => [...prev, snapped]);
      return;
    }
    // ── Normal mode: pan ────────────────────────────────────────────────────
    if (e.target === e.target.getStage()) {
      setIsPanning(true);
      const p = e.target.getStage().getPointerPosition();
      panStart.current = { x: p.x - pan.x, y: p.y - pan.y };
      setSelectedRoomId(null);
      setSelectedFurnitureId(null);
      setSelectedFurnitureRoomId(null);
      setSelectedOpeningId(null);
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStageMouseMove = (e: any) => {
    const p = e.target.getStage().getPointerPosition();
    if (activeTool === "draw_wall") {
      const world = screenToWorld(p.x, p.y);
      const snapped = snapToGrid(world.x, world.y);
      setDrawMousePos(snapped);
      return;
    }
    if (!isPanning) return;
    setPan({ x: p.x - panStart.current.x, y: p.y - panStart.current.y });
  };
  const handleStageMouseUp = () => setIsPanning(false);

  // ── Render the live draw_wall preview on Konva canvas ───────────────────
  const renderDrawWallPreview = () => {
    if (activeTool !== "draw_wall") return null;
    const scale = METER_TO_PX * zoom;
    const toScreen = (wx: number, wy: number) => ({
      x: pan.x + wx * scale,
      y: pan.y + wy * scale,
    });

    const nodes: React.ReactNode[] = [];

    // Draw completed segments
    for (let i = 0; i < drawingPoints.length; i++) {
      const sp = toScreen(drawingPoints[i].x, drawingPoints[i].y);
      const next = i < drawingPoints.length - 1 ? drawingPoints[i + 1] : null;

      if (next) {
        const ep = toScreen(next.x, next.y);
        nodes.push(
          <Line
            key={`seg_${i}`}
            points={[sp.x, sp.y, ep.x, ep.y]}
            stroke="#1e293b"
            strokeWidth={4}
            lineCap="round"
          />
        );
        // Dimension label for completed segment
        const len = Math.sqrt((next.x - drawingPoints[i].x) ** 2 + (next.y - drawingPoints[i].y) ** 2);
        const mx = (sp.x + ep.x) / 2;
        const my = (sp.y + ep.y) / 2;
        nodes.push(
          <Rect key={`dim_bg_${i}`} x={mx - 22} y={my - 10} width={44} height={18} fill="#1e293b" cornerRadius={4} />,
          <Text
            key={`dim_${i}`}
            x={mx - 22}
            y={my - 9}
            width={44}
            text={`${len.toFixed(1)}m`}
            fontSize={11}
            fontStyle="bold"
            fill="#ffffff"
            align="center"
          />
        );
      }

      // Vertex dot
      const isFirst = i === 0;
      nodes.push(
        <Circle
          key={`dot_${i}`}
          x={sp.x}
          y={sp.y}
          radius={isFirst && drawingPoints.length >= 3 ? 8 : 5}
          fill={isFirst ? "#22c55e" : "#1e293b"}
          stroke="#ffffff"
          strokeWidth={2}
        />
      );
    }

    // Draw live preview segment (from last point to mouse)
    if (drawingPoints.length > 0 && drawMousePos) {
      const lastPt = drawingPoints[drawingPoints.length - 1];
      const sp = toScreen(lastPt.x, lastPt.y);
      const ep = toScreen(drawMousePos.x, drawMousePos.y);
      const len = Math.sqrt((drawMousePos.x - lastPt.x) ** 2 + (drawMousePos.y - lastPt.y) ** 2);
      const mx = (sp.x + ep.x) / 2;
      const my = (sp.y + ep.y) / 2;
      nodes.push(
        <Line
          key="preview_line"
          points={[sp.x, sp.y, ep.x, ep.y]}
          stroke="#00b5cd"
          strokeWidth={2}
          dash={[8, 5]}
          lineCap="round"
        />,
        <Rect key="preview_dim_bg" x={mx - 22} y={my - 10} width={44} height={18} fill="#00b5cd" cornerRadius={4} />,
        <Text
          key="preview_dim"
          x={mx - 22}
          y={my - 9}
          width={44}
          text={`${len.toFixed(1)}m`}
          fontSize={11}
          fontStyle="bold"
          fill="#ffffff"
          align="center"
        />
      );
    }

    // Cursor dot at mouse position
    if (drawMousePos) {
      const cp = toScreen(drawMousePos.x, drawMousePos.y);
      const isNearFirst =
        drawingPoints.length >= 3 &&
        Math.sqrt((drawMousePos.x - drawingPoints[0].x) ** 2 + (drawMousePos.y - drawingPoints[0].y) ** 2) < 0.4;
      nodes.push(
        <Circle
          key="cursor_dot"
          x={cp.x}
          y={cp.y}
          radius={isNearFirst ? 10 : 5}
          fill={isNearFirst ? "#22c55e" : "#00b5cd"}
          stroke="#ffffff"
          strokeWidth={2}
          opacity={0.85}
        />
      );
    }

    return nodes;
  };

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

      const renderJobType = renderMode;
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

      const renderPrompt = renderJobType === "Floorplan to 3D Floorplan"
        ? `You are a professional 3D architectural visualizer.
Your task is to transform the provided floorplan preview into a polished 3D floorplan illustration with a clean axonometric/3D floorplan style.
Style: ${selectedStyle || gatherInfo.extras || "Modern Vietnamese contemporary"}.

Color and Material Guidelines:
- The 3D floorplan model MUST be fully colored and textured.
- Use realistic, vivid colors and materials: wooden or tiled floors with rich warm colors, painted interior walls (such as warm white, beige, or light grey), and colored furniture with distinct textures (wood grain, fabric, leather, metal).
- Absolutely do NOT output a white clay model, raw plaster model, monochrome rendering, or all-white/grey visualization. It must look lively and colorful.

Strict Layout & Furniture Preservation Guidelines:
- The design style (${selectedStyle || "None"}) must only change the aesthetic finishes, colors, and textures of the walls, floors, and furniture. It MUST NOT alter, shift, or replace the architectural structure (walls, doors, windows, staircases) or the spatial layout of the furniture.
- The floorplan consists of these rooms and layout: ${roomsDesc}. Each room must retain its specific function, placement, and interior elements as defined in the preview.
- The input image is a floorplan preview. You MUST strictly preserve the exact room layout, wall positions, doors, windows and furniture arrangement.
- Do NOT add, remove, or rearrange any furniture.
- Keep all architectural proportions correct.
- The result should look like a high-quality 3D floorplan render, with clear floor surfaces, walls, and subtle shadows.
- Focus on the floorplan and spatial organization, not on photographic interior detail.

Requirements:
- Crisp presentation with clean lines, subtle ambient lighting, and clear separation between floors, walls, and furniture.
- Soft shadows that enhance depth without being overly photorealistic.
- Avoid realistic photographic staging, people, or repeated interior decoration details.
- Output should resemble a professional 3D floorplan/axonometric render, not a typical interior photograph. Negative prompt: white clay model, monochrome, grayscale, raw plaster, all-white rendering, untextured model.${cameraPrompt}${customRoomPrompt}${customFurniturePrompt}`
        : `You are a professional 3D architectural visualizer.
Your task is to transform the provided 3D spatial layout preview of the [${roomForRender}] into a hyper-realistic, photorealistic interior render.
Style: ${currentRoom?.style || selectedStyle || gatherInfo.extras || "Modern Vietnamese contemporary"}.

Strict Layout & Furniture Preservation Guidelines:
- The design style (${currentRoom?.style || selectedStyle || "None"}) must only change the aesthetic finishes, colors, and textures of the walls, floors, and furniture. It MUST NOT alter, shift, or replace the architectural structure (walls, doors, windows, staircases) or the spatial layout of the furniture.
- The input image is a 3D layout preview of the room. You MUST strictly preserve the exact layout, structure, and positions of all walls, doors, windows, and furniture items visible.
- Do NOT add, remove, or rearrange any furniture.
- A sofa in the preview must remain a sofa of the exact same size, shape, and orientation.
- A dining table with chairs must remain a dining table with the exact same count and arrangement of chairs (e.g. a 6-seat dining table must render with exactly 6 seats in the same positions).
- Do not substitute furniture for different types (e.g. keep wardrobes as wardrobes, beds as beds).
- Keep the exact proportions and dimensions of all items.

Requirements:
- Natural light flooding in, warm shadows, 8K photorealistic quality, realistic textures (polished wood, fabric, metal, marble).
- Magazine-quality composition (ArchDaily style).
- Pure photorealistic render only, absolutely NO lines, sketch boundaries, dimensions, or UI text from the preview interface.${cameraPrompt}${customRoomPrompt}${customFurniturePrompt}`;

      // Post asynchronous render job to backend queue
      const jobData = {
        userId: user?._id || "",
        type: renderJobType,
        inputImageUrls: [_imageUrl],
        referenceImageUrls: [],
        status: "pending",
        progress: 10,
        statusMessage: "Khởi tạo...",
        createdAt: new Date().toISOString(),
        settings: {
          prompt: renderPrompt,
          numImages: 1,
          aspectRatio: (activeTab === "visualize" && selectedCameraRoomId && cameras[selectedCameraRoomId]?.aspectRatio) || "4:3",
          model: "nano-banana-2",
          resolution: "1K",
        },
      };

      const jobRes = await apiClient.post<ApiResponse<any>>("/api/v1/render-jobs", jobData);
      if (!jobRes.success || !jobRes.data) {
        throw new Error("Không thể khởi tạo render job trên server.");
      }

      const newJob = jobRes.data;
      const jobId = newJob._id || newJob.id;
      if (newJob.status === "completed") {
        const finalUrl = newJob.outputImageUrls?.[0];
        if (finalUrl) {
          setRenderResult(finalUrl);
          toast.success("Render 3D hoàn tất!");
          addMessage("assistant", "✅ Phối cảnh 3D đã hoàn thành! Bạn có thể tải về bên dưới.");
        }
        setIsRendering3D(false);
        setActiveJobId(null);
      } else {
        setActiveJobId(jobId);
        setRenderProgress(newJob.progress || 10);
        setRenderStatusMessage(newJob.statusMessage || "Khởi tạo...");
        
        addMessage("assistant", "🎨 Đang gửi yêu cầu tạo phối cảnh 3D lên hệ thống...");
        toast.info("Đã gửi yêu cầu kết xuất 3D!");
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error("Render 3D error:", e);
      addMessage("assistant", "❌ Lỗi render 3D. Vui lòng thử lại.");
      toast.error(e.message || "Lỗi render.");
      setIsRendering3D(false);
      setActiveJobId(null);
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
        setTimeout(() => {
          setFloorPlans(nextPlans);
          if (floorPlan) {
            setFloorPlan(nextPlans[activeFloorIndex]);
          }
        }, 0);
      }
    }
  }, [floorPlans, floorPlan]);

  // ── Get default furniture positions for room (in meters) ─────────────────
  function getDefaultFurnitureForRoom(room: { name: string; w: number; h: number }): FurnitureItem[] {
    const items: FurnitureItem[] = [];
    const lowerName = room.name.toLowerCase();
    const rw = room.w;
    const rh = room.h;
    const area = rw * rh;

    // Wall margin: furniture edge stays at least M from any wall
    // M is dynamically calculated to be at least 10cm away from the inner face of the wall stroke
    const M = Math.max(0.18, (wallThickness / 1000) / 2 + 0.10);
    // Clamp furniture center so edges = center ± size/2 are within [M, room_dim - M]
    const cx = (center: number, size: number) =>
      Math.max(M + size / 2, Math.min(rw - M - size / 2, center));
    const cy = (center: number, size: number) =>
      Math.max(M + size / 2, Math.min(rh - M - size / 2, center));
    // Unique ID helper
    const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

    // ── Phòng khách / Living Room ──────────────────────────────────────────
    if (lowerName.includes("khách") || lowerName.includes("living") || lowerName.includes("sinh hoạt chung") || lowerName.includes("family")) {
      // Scale sofa to room: small rooms get compact sofa
      const sofaW = area < 12 ? Math.min(rw * 0.7, 1.8) : Math.min(rw * 0.65, 2.6);
      const sofaH = area < 12 ? Math.min(rh * 0.22, 0.75) : Math.min(rh * 0.22, 0.95);
      const tvW   = Math.min(sofaW * 0.85, rw * 0.55);
      const tvH   = 0.18;
      // TV top wall
      items.push({ id: uid("tv"),    type: "living_tv",    x: cx(rw/2, tvW),              y: cy(M+tvH/2, tvH),                  w: tvW,   h: tvH });
      // Sofa bottom wall
      items.push({ id: uid("sofa"),  type: "living_sofa",  x: cx(rw/2, sofaW),            y: cy(rh-M-sofaH/2, sofaH),           w: sofaW, h: sofaH });
      // Armchair right side (only if there's enough width after sofa)
      if (rw > sofaW + 0.8) {
        const chW = Math.min(0.65, rw - sofaW - M * 3);
        items.push({ id: uid("chair"), type: "living_chair", x: cx(rw-M-chW/2, chW),      y: cy(rh - M - sofaH/2, chW),         w: chW,   h: chW });
      }

    // ── Phòng ngủ / Bedroom ────────────────────────────────────────────────
    } else if (lowerName.includes("ngủ") || lowerName.includes("bed")) {
      // Bed size based on room width
      const bedW = rw < 3.0 ? Math.min(rw * 0.7, 1.4)  // single / small double
                 : rw < 4.0 ? Math.min(rw * 0.6, 1.6)  // double
                 : Math.min(rw * 0.55, 1.8);            // queen/king
      const bedH = Math.min(rh * 0.45, 2.1);
      const wardH = 0.55;
      const wardW = Math.min(rw - M * 2, rw * 0.85, 2.4);
      // Wardrobe along top wall
      items.push({ id: uid("ward"), type: "bed_wardrobe",   x: cx(rw/2, wardW),           y: cy(M+wardH/2, wardH),               w: wardW, h: wardH });
      // Bed: placed below wardrobe, roughly in lower half
      const bedY = cy(wardH + M + bedH/2 + (rh - wardH - M*2 - bedH) * 0.4, bedH);
      items.push({ id: uid("bed"),  type: "bed_bed",         x: cx(rw/2, bedW),            y: bedY,                               w: bedW,  h: bedH });
      // Nightstands only if horizontal space allows
      const nsSize = Math.min(0.42, (rw - bedW - M * 4) / 2);
      if (nsSize >= 0.3) {
        const bedCX = cx(rw/2, bedW);
        items.push({ id: uid("nsl"), type: "bed_nightstand", x: cx(bedCX - bedW/2 - nsSize/2 - M, nsSize), y: bedY, w: nsSize, h: nsSize });
        items.push({ id: uid("nsr"), type: "bed_nightstand", x: cx(bedCX + bedW/2 + nsSize/2 + M, nsSize), y: bedY, w: nsSize, h: nsSize });
      }
      // Dresser for larger rooms
      if (area > 14) {
        const drW = Math.min(0.9, rw * 0.25);
        const drH = 0.45;
        items.push({ id: uid("dr"), type: "bed_dresser", x: cx(rw - M - drW/2, drW), y: cy(wardH + M + drH/2, drH), w: drW, h: drH });
      }

    // ── Phòng bếp / Kitchen ────────────────────────────────────────────────
    } else if (lowerName.includes("bếp") || lowerName.includes("kitchen") || lowerName.includes("pantry") || lowerName.includes("kho bếp")) {
      const cD = 0.6; // counter depth
      const cW = Math.min(rw - M * 2, rw * 0.9); // counter width
      const cY = cy(M + cD/2, cD);
      // Full counter top wall
      items.push({ id: uid("cnt"), type: "kitchen_counter", x: cx(rw/2, cW),               y: cY,                                 w: cW,    h: cD });
      // Cooktop on left 1/3 of counter
      const ctpW = Math.min(0.65, cW * 0.35);
      items.push({ id: uid("ctp"), type: "kitchen_cooktop", x: cx(M + cW*0.25, ctpW),      y: cY,                                 w: ctpW,  h: 0.32 });
      // Sink on right 1/3 of counter
      const snkW = Math.min(0.5, cW * 0.28);
      items.push({ id: uid("snk"), type: "kitchen_sink",    x: cx(rw - M - cW*0.2, snkW),  y: cY,                                 w: snkW,  h: 0.32 });
      // Fridge bottom-left (if room tall enough)
      if (rh > 2.5) {
        const frW = 0.65; const frH = 0.68;
        items.push({ id: uid("fr"),  type: "kitchen_fridge",  x: cx(M+frW/2, frW),          y: cy(rh-M-frH/2, frH),               w: frW,   h: frH });
      }

    // ── Phòng ăn / Dining ─────────────────────────────────────────────────
    } else if (lowerName.includes("ăn") || lowerName.includes("dining")) {
      const tW = Math.min(rw * 0.60, 1.8);
      const tH = Math.min(rh * 0.50, 1.1);
      items.push({ id: uid("dt"), type: "dining_table", x: cx(rw/2, tW), y: cy(rh/2, tH), w: tW, h: tH });

    // ── Phòng tắm lớn / Full Bathroom ─────────────────────────────────────
    } else if (lowerName.includes("tắm lớn") || lowerName.includes("full bath")) {
      const lavW = Math.min(0.55, rw * 0.45);
      const lavH = Math.min(0.45, rh * 0.22);
      const toiW = Math.min(0.42, rw * 0.4);
      const toiH = Math.min(0.65, rh * 0.32);
      const mirW = lavW; const mirH = 0.15;

      const lavX = cx(M + lavW/2, lavW);
      const lavY = cy(M + mirH + M + lavH/2, lavH);

      items.push({ id: uid("mir"), type: "wc_mirror",  x: lavX, y: cy(M+mirH/2, mirH), w: mirW, h: mirH });
      items.push({ id: uid("lav"), type: "wc_lavabo",  x: lavX, y: lavY, w: lavW, h: lavH });

      let toiX = cx(M + toiW/2, toiW);
      let toiY = cy(rh - M - toiH/2, toiH);

      const lavBottom = lavY + lavH/2;
      const toiTop = toiY - toiH/2;
      if (toiTop < lavBottom + 0.15) {
        if (rw >= 1.6) {
          toiX = cx(rw - M - toiW/2, toiW);
          toiY = cy(rh - M - toiH/2, toiH);
        } else {
          toiY = cy(Math.max(lavBottom + 0.15 + toiH/2, rh - M - toiH/2), toiH);
        }
      }
      items.push({ id: uid("toi"), type: "wc_toilet",  x: toiX, y: toiY, w: toiW, h: toiH });

      if (rw >= 1.6 && rh >= 2.0) {
        const btW = Math.min(rw*0.42, 0.8); const btH = Math.min(rh*0.45, 1.6);
        items.push({ id: uid("bt"), type: "wc_bathtub", x: cx(rw-M-btW/2, btW), y: cy(rh/2, btH),             w: btW,  h: btH });
      } else if (rw >= 1.0) {
        const shW = Math.min(rw*0.45, 0.9); const shH = shW;
        items.push({ id: uid("sh"), type: "wc_shower",  x: cx(rw-M-shW/2, shW), y: cy(M+shH/2, shH),          w: shW,  h: shH });
      }

    // ── Phòng vệ sinh phụ / Half Bathroom / WC ────────────────────────────
    } else if (lowerName.includes("vệ sinh") || lowerName.includes("wc") || lowerName.includes("toilet") || lowerName.includes("tắm")) {
      const lavW = Math.min(0.55, rw * 0.45);
      const lavH = Math.min(0.45, rh * 0.22);
      const toiW = Math.min(0.42, rw * 0.4);
      const toiH = Math.min(0.65, rh * 0.32);
      const mirW = lavW; const mirH = 0.15;

      const lavX = cx(M + lavW/2, lavW);
      const lavY = cy(M + mirH + M + lavH/2, lavH);

      items.push({ id: uid("mir"), type: "wc_mirror",  x: lavX, y: cy(M+mirH/2, mirH), w: mirW, h: mirH });
      items.push({ id: uid("lav"), type: "wc_lavabo",  x: lavX, y: lavY, w: lavW, h: lavH });

      let toiX = cx(M + toiW/2, toiW);
      let toiY = cy(rh - M - toiH/2, toiH);

      const lavBottom = lavY + lavH/2;
      const toiTop = toiY - toiH/2;
      if (toiTop < lavBottom + 0.15) {
        if (rw >= 1.6) {
          toiX = cx(rw - M - toiW/2, toiW);
          toiY = cy(rh - M - toiH/2, toiH);
        } else {
          toiY = cy(Math.max(lavBottom + 0.15 + toiH/2, rh - M - toiH/2), toiH);
        }
      }
      items.push({ id: uid("toi"), type: "wc_toilet",  x: toiX, y: toiY, w: toiW, h: toiH });

      // Shower stall if room is wide enough on right side
      if (rw >= 1.8 && rh >= 1.8) {
        const shW = Math.min(rw*0.38, 0.9); const shH = Math.min(rh*0.4, 0.9);
        items.push({ id: uid("sh"), type: "wc_shower",  x: cx(rw-M-shW/2, shW), y: cy(rh/2, shH),             w: shW,  h: shH });
      }

    // ── Nhà xe / Gara ──────────────────────────────────────────────────────
    } else if (lowerName.includes("gara") || lowerName.includes("garage") || lowerName.includes("xe")) {
      const carW = Math.min(rw - M*2, 2.0);
      const carH = Math.min(rh - M*2, 4.5);
      items.push({ id: uid("car"), type: "garage_car", x: cx(rw/2, carW), y: cy(rh/2, carH), w: carW, h: carH });

    // ── Phòng làm việc / Office ────────────────────────────────────────────
    } else if (lowerName.includes("làm việc") || lowerName.includes("office") || lowerName.includes("study")) {
      const dW = Math.min(rw - M*2, 1.5); const dH = Math.min(rh*0.28, 0.72);
      items.push({ id: uid("desk"), type: "office_desk", x: cx(rw/2, dW), y: cy(M+dH/2, dH), w: dW, h: dH });
      // Bookshelf/chair if room large enough
      if (area > 9) {
        const chW = 0.55;
        items.push({ id: uid("ch"), type: "living_chair", x: cx(rw/2, chW), y: cy(rh*0.6, chW), w: chW, h: chW });
      }

    // ── Phòng tập gym / Home Gym ───────────────────────────────────────────
    } else if (lowerName.includes("gym") || lowerName.includes("tập")) {
      const tmW = Math.min(rw*0.55, 0.8); const tmH = Math.min(rh*0.55, 1.8);
      items.push({ id: uid("tm"), type: "gym_treadmill", x: cx(M+tmW/2, tmW), y: cy(rh/2, tmH), w: tmW, h: tmH });

    // ── Phòng giặt ủi / Laundry ────────────────────────────────────────────
    } else if (lowerName.includes("giặt") || lowerName.includes("laundry")) {
      const mW = Math.min(rw * 0.55, 1.4); const mH = 0.65;
      items.push({ id: uid("lm"), type: "laundry_machines", x: cx(M+mW/2, mW), y: cy(M+mH/2, mH), w: mW, h: mH });
      if (rh > 2.0) {
        const snkW = 0.5; const snkH = 0.45;
        items.push({ id: uid("ls"), type: "laundry_sink", x: cx(M+snkW/2, snkW), y: cy(mH+M*2+snkH/2, snkH), w: snkW, h: snkH });
      }

    // ── Lối vào / Sảnh / Entry / Mudroom / Porch ───────────────────────────
    } else if (lowerName.includes("lối vào") || lowerName.includes("sảnh") || lowerName.includes("entry") || lowerName.includes("mudroom") || lowerName.includes("porch") || lowerName.includes("hiên")) {
      const bW = Math.min(rw * 0.6, 1.2); const bH = 0.45;
      items.push({ id: uid("bch"), type: "entry_bench",       x: cx(rw/2, bW),        y: cy(M+bH/2, bH),            w: bW,  h: bH });
      const cmW = 0.35; const cmH = 0.35;
      items.push({ id: uid("cs"),  type: "entry_coat_stand",  x: cx(rw-M-cmW/2, cmW), y: cy(M+cmH/2, cmH),          w: cmW, h: cmH });
      if (rw > 2.0) {
        const cMirW = Math.min(rw*0.4, 0.9); const cMirH = Math.min(rh*0.55, 1.5);
        items.push({ id: uid("cm"), type: "entry_console_mirror", x: cx(M+cMirW/2, cMirW), y: cy(rh/2, cMirH),      w: cMirW, h: cMirH });
      }

    // ── Phòng thay đồ / Walk-in Closet ─────────────────────────────────────
    } else if (lowerName.includes("thay đồ") || lowerName.includes("walk-in") || lowerName.includes("walk in")) {
      // Row of wardrobes along top wall
      const wW = Math.min(rw - M*2, 2.4); const wH = 0.6;
      items.push({ id: uid("w1"), type: "bed_wardrobe", x: cx(rw/2, wW), y: cy(M+wH/2, wH), w: wW, h: wH });
      // Second row along bottom wall if room deep enough
      if (rh > 2.0) {
        items.push({ id: uid("w2"), type: "bed_wardrobe", x: cx(rw/2, wW), y: cy(rh-M-wH/2, wH), w: wW, h: wH });
      }

    // ── Phòng chơi game / Giải trí / Game Room ─────────────────────────────
    } else if (lowerName.includes("game") || lowerName.includes("giải trí") || lowerName.includes("chơi")) {
      const sofaW = Math.min(rw * 0.65, 2.2); const sofaH = Math.min(rh * 0.22, 0.9);
      const tvW   = Math.min(sofaW * 0.8, 1.8); const tvH = 0.18;
      items.push({ id: uid("tv"),   type: "living_tv",   x: cx(rw/2, tvW),   y: cy(M+tvH/2, tvH),        w: tvW,   h: tvH });
      items.push({ id: uid("sofa"), type: "living_sofa", x: cx(rw/2, sofaW), y: cy(rh-M-sofaH/2, sofaH), w: sofaW, h: sofaH });

    // ── Ban công / Sân thượng / Balcony / Terrace ──────────────────────────
    } else if (lowerName.includes("ban công") || lowerName.includes("sân thượng") || lowerName.includes("balcon") || lowerName.includes("terrace")) {
      // Small outdoor chairs
      const chW = Math.min(0.6, rw * 0.3); const chH = chW;
      if (rw > 1.5) {
        items.push({ id: uid("ch1"), type: "living_chair", x: cx(rw*0.3, chW), y: cy(rh/2, chH), w: chW, h: chH });
        items.push({ id: uid("ch2"), type: "living_chair", x: cx(rw*0.7, chW), y: cy(rh/2, chH), w: chW, h: chH });
      } else {
        items.push({ id: uid("ch1"), type: "living_chair", x: cx(rw/2, chW), y: cy(rh/2, chH), w: chW, h: chH });
      }

    // ── Hành lang / Lối đi / Hallway ──────────────────────────────────────
    } else if (lowerName.includes("hành lang") || lowerName.includes("lối đi") || lowerName.includes("hallway")) {
      // No furniture in hallways (they're circulation paths)
      // Optional: small console if corridor is wide (>= 1.2m)
      if (Math.min(rw, rh) >= 1.2) {
        const cMirW = Math.min(Math.min(rw, rh) * 0.6, 0.8);
        const cMirH = Math.min(Math.max(rw, rh) * 0.35, 1.2);
        items.push({ id: uid("cm"), type: "entry_console_mirror", x: cx(rw/2, cMirW), y: cy(M+cMirH/2, cMirH), w: cMirW, h: cMirH });
      }

    // ── Sân vườn / Garden ─────────────────────────────────────────────────
    } else if (lowerName.includes("sân vườn") || lowerName.includes("garden")) {
      // Outdoor seating
      const chW = Math.min(0.65, rw * 0.2);
      items.push({ id: uid("ch1"), type: "living_chair", x: cx(rw*0.25, chW), y: cy(rh*0.4, chW), w: chW, h: chW });
      items.push({ id: uid("ch2"), type: "living_chair", x: cx(rw*0.75, chW), y: cy(rh*0.4, chW), w: chW, h: chW });
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
          <Group>
            {/* Console Table */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.1} shadowOffset={{ x: 1, y: 1 }} />
            {/* TV Screen */}
            <Rect x={-iw * 0.85 / 2} y={-2} width={iw * 0.85} height={4} fill="#090d16" stroke="#0f172a" strokeWidth={1} cornerRadius={1} />
            {/* Shelf lines */}
            <Line points={[-iw / 2 + 10, -ih / 4, iw / 2 - 10, -ih / 4]} stroke="#475569" strokeWidth={0.8} />
          </Group>
        );
      case "living_sofa":
        return (
          <Group>
            {/* Main Sofa Body */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={6} shadowColor="#0f172a" shadowBlur={5} shadowOpacity={0.12} shadowOffset={{ x: 1.5, y: 1.5 }} />
            {/* Cushions and details */}
            <Rect x={-iw / 2 + 1.5} y={-ih / 2 + 1.5} width={iw - 3} height={10} fill="#f1f5f9" stroke="#475569" strokeWidth={0.8} cornerRadius={2} />
            <Rect x={-iw / 2 + 1.5} y={-ih / 2 + 1.5} width={9} height={ih - 3} fill="#f1f5f9" stroke="#475569" strokeWidth={0.8} cornerRadius={3} />
            <Rect x={iw / 2 - 10.5} y={-ih / 2 + 1.5} width={9} height={ih - 3} fill="#f1f5f9" stroke="#475569" strokeWidth={0.8} cornerRadius={3} />
            <Line points={[-iw / 6, -ih / 2 + 10.5, -iw / 6, ih / 2 - 1.5]} stroke="#475569" strokeWidth={0.8} />
            <Line points={[iw / 6, -ih / 2 + 10.5, iw / 6, ih / 2 - 1.5]} stroke="#475569" strokeWidth={0.8} />
            {/* Coffee Table */}
            <Rect x={-iw * 0.45 / 2} y={-ih * 1.65} width={iw * 0.45} height={ih * 0.72} fill={fillColor} stroke="#0f172a" strokeWidth={1.2} cornerRadius={3} shadowColor="#0f172a" shadowBlur={3} shadowOpacity={0.08} shadowOffset={{ x: 1, y: 1 }} />
            <Rect x={-iw * 0.35 / 2} y={-ih * 1.55} width={iw * 0.35} height={ih * 0.52} fill="#ffffff" stroke="#475569" strokeWidth={0.8} cornerRadius={2} />
          </Group>
        );
      case "living_chair":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={5} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.1} shadowOffset={{ x: 1, y: 1 }} />
            {/* Backrest */}
            <Rect x={-iw / 2 + 1.5} y={-ih / 2 + 1.5} width={iw - 3} height={8} fill="#f1f5f9" stroke="#475569" strokeWidth={0.8} cornerRadius={2} />
            {/* Armrests */}
            <Rect x={-iw / 2 + 1.5} y={-ih / 2 + 1.5} width={8} height={ih - 3} fill="#f1f5f9" stroke="#475569" strokeWidth={0.8} cornerRadius={2} />
            <Rect x={iw / 2 - 9.5} y={-ih / 2 + 1.5} width={8} height={ih - 3} fill="#f1f5f9" stroke="#475569" strokeWidth={0.8} cornerRadius={2} />
          </Group>
        );
      case "bed_wardrobe":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.08} shadowOffset={{ x: 1, y: 1 }} />
            <Line points={[-iw / 6, -ih / 2 + 1, -iw / 6, ih / 2 - 1]} stroke="#475569" strokeWidth={0.8} />
            <Line points={[iw / 6, -ih / 2 + 1, iw / 6, ih / 2 - 1]} stroke="#475569" strokeWidth={0.8} />
            <Circle x={-iw / 4} y={0} radius={1.5} fill="#e2e8f0" stroke="#0f172a" strokeWidth={1} />
            <Circle x={iw / 12} y={0} radius={1.5} fill="#e2e8f0" stroke="#0f172a" strokeWidth={1} />
            <Circle x={iw * 5 / 12} y={0} radius={1.5} fill="#e2e8f0" stroke="#0f172a" strokeWidth={1} />
          </Group>
        );
      case "bed_nightstand":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.2} cornerRadius={2} shadowColor="#0f172a" shadowBlur={3} shadowOpacity={0.08} shadowOffset={{ x: 0.8, y: 0.8 }} />
            <Rect x={-iw * 0.4} y={-ih / 2 + 4} width={iw * 0.8} height={4} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} cornerRadius={1} />
          </Group>
        );
      case "bed_bed":
        {
          const isTatami = item.style === "tatami";
          return (
            <Group>
              {isTatami && (
                <>
                  {/* Tatami wooden deck platform */}
                  <Rect x={-iw / 2 - 6} y={-ih / 2 - 2} width={iw + 12} height={ih + 8} fill="#f5ebe0" stroke="#854d0e" strokeWidth={1.2} cornerRadius={2} shadowColor="#0f172a" shadowBlur={5} shadowOpacity={0.12} shadowOffset={{ x: 2, y: 2 }} />
                  <Line points={[-iw / 2 - 6, ih / 2 - 10, iw / 2 + 6, ih / 2 - 10]} stroke="#a16207" strokeWidth={0.8} />
                </>
              )}
              {/* Bed Mattress Frame */}
              <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={4} shadowColor="#0f172a" shadowBlur={isTatami ? 3 : 5} shadowOpacity={0.1} shadowOffset={{ x: 1, y: 1 }} />
              {/* Wood Headboard */}
              <Rect x={-iw / 2} y={-ih / 2} width={iw} height={8} fill="#e2e8f0" stroke="#0f172a" strokeWidth={1} cornerRadius={1} />
              {/* Pillow Left */}
              <Rect x={-iw * 0.44} y={-ih * 0.38} width={iw * 0.36} height={ih * 0.16} fill="#ffffff" stroke="#475569" strokeWidth={0.8} cornerRadius={3} />
              {/* Pillow Right */}
              <Rect x={iw * 0.08} y={-ih * 0.38} width={iw * 0.36} height={ih * 0.16} fill="#ffffff" stroke="#475569" strokeWidth={0.8} cornerRadius={3} />
              {/* Duvet / Blanket sheet */}
              <Rect x={-iw / 2 + 2} y={ih * 0.04} width={iw - 4} height={ih * 0.44} fill="#f8fafc" stroke="#475569" strokeWidth={0.8} cornerRadius={2} />
              {/* Folds/Stripes on duvet */}
              <Line points={[-iw / 2 + 2, ih * 0.04, iw / 2 - 2, ih * 0.04]} stroke="#0f172a" strokeWidth={1.5} />
              <Line points={[-iw / 3, ih * 0.09, -iw / 3, ih * 0.45]} stroke="#e2e8f0" strokeWidth={1} />
              <Line points={[0, ih * 0.09, 0, ih * 0.45]} stroke="#e2e8f0" strokeWidth={1} />
              <Line points={[iw / 3, ih * 0.09, iw / 3, ih * 0.45]} stroke="#e2e8f0" strokeWidth={1} />
            </Group>
          );
        }
      case "kitchen_counter":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={14} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} />
            <Rect x={-iw / 2} y={-ih / 2} width={14} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} />
          </Group>
        );
      case "kitchen_cooktop":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1} cornerRadius={1} />
            {/* Burners as light filled circles with thin outline */}
            <Circle x={-iw / 4} y={-ih / 4} radius={6} fill="#f8fafc" stroke="#0f172a" strokeWidth={0.8} />
            <Circle x={-iw / 4} y={-ih / 4} radius={2.2} fill="#cbd5e1" stroke="#475569" strokeWidth={0.5} />
            <Circle x={iw / 4} y={-ih / 4} radius={6} fill="#f8fafc" stroke="#0f172a" strokeWidth={0.8} />
            <Circle x={iw / 4} y={-ih / 4} radius={2.2} fill="#cbd5e1" stroke="#475569" strokeWidth={0.5} />
            <Circle x={-iw / 4} y={ih / 4} radius={6} fill="#f8fafc" stroke="#0f172a" strokeWidth={0.8} />
            <Circle x={-iw / 4} y={ih / 4} radius={2.2} fill="#cbd5e1" stroke="#475569" strokeWidth={0.5} />
            <Circle x={iw / 4} y={ih / 4} radius={6} fill="#f8fafc" stroke="#0f172a" strokeWidth={0.8} />
            <Circle x={iw / 4} y={ih / 4} radius={2.2} fill="#cbd5e1" stroke="#475569" strokeWidth={0.5} />
          </Group>
        );
      case "kitchen_sink":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.2} cornerRadius={2} />
            {/* Sink Basin */}
            <Rect x={-iw / 2 + 3} y={-ih / 2 + 3} width={iw - 6} height={ih - 6} fill="#f1f5f9" stroke="#475569" strokeWidth={1} cornerRadius={2} />
            {/* Faucet */}
            <Circle x={0} y={-ih / 2 + 5} radius={2} fill="#94a3b8" stroke="#0f172a" strokeWidth={0.8} />
            <Line points={[0, -ih / 2 + 5, 0, -ih / 2 + 13]} stroke="#94a3b8" strokeWidth={2} lineCap="round" />
          </Group>
        );
      case "kitchen_fridge":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={3} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.08} shadowOffset={{ x: 1, y: 1 }} />
            <Line points={[-iw / 2, 0, iw / 2, 0]} stroke="#0f172a" strokeWidth={1} />
            <Line points={[iw / 2 - 3, -ih / 3, iw / 2 - 3, -ih / 10]} stroke="#475569" strokeWidth={2} lineCap="round" />
            <Line points={[iw / 2 - 3, ih / 6, iw / 2 - 3, ih * 0.4]} stroke="#475569" strokeWidth={2} lineCap="round" />
          </Group>
        );
      case "dining_table":
        {
          const isRound = item.style === "round";
          const tableColor = fillColor;
          if (isRound) {
            const rRadius = Math.min(iw, ih) * 0.35;
            return (
              <Group>
                {/* Chairs around */}
                <Circle x={0} y={-rRadius - 6} radius={5} fill="#ffffff" stroke="#475569" strokeWidth={1} />
                <Circle x={0} y={rRadius + 6} radius={5} fill="#ffffff" stroke="#475569" strokeWidth={1} />
                <Circle x={-rRadius - 6} y={0} radius={5} fill="#ffffff" stroke="#475569" strokeWidth={1} />
                <Circle x={rRadius + 6} y={0} radius={5} fill="#ffffff" stroke="#475569" strokeWidth={1} />
                
                <Circle x={-rRadius * 0.707 - 4} y={-rRadius * 0.707 - 4} radius={5} fill="#ffffff" stroke="#475569" strokeWidth={1} />
                <Circle x={rRadius * 0.707 + 4} y={-rRadius * 0.707 - 4} radius={5} fill="#ffffff" stroke="#475569" strokeWidth={1} />
                <Circle x={-rRadius * 0.707 - 4} y={rRadius * 0.707 + 4} radius={5} fill="#ffffff" stroke="#475569" strokeWidth={1} />
                <Circle x={rRadius * 0.707 + 4} y={rRadius * 0.707 + 4} radius={5} fill="#ffffff" stroke="#475569" strokeWidth={1} />

                {/* Round Table Top */}
                <Circle x={0} y={0} radius={rRadius} fill={tableColor} stroke="#0f172a" strokeWidth={1.5} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.1} shadowOffset={{ x: 1, y: 1 }} />
              </Group>
            );
          }
          return (
            <Group>
              {/* Side chairs */}
              <Rect x={-iw * 0.3} y={-ih / 2 - 8} width={12} height={6} fill="#ffffff" stroke="#475569" strokeWidth={1} cornerRadius={1.5} />
              <Rect x={iw * 0.1} y={-ih / 2 - 8} width={12} height={6} fill="#ffffff" stroke="#475569" strokeWidth={1} cornerRadius={1.5} />
              <Rect x={-iw * 0.3} y={ih / 2 + 2} width={12} height={6} fill="#ffffff" stroke="#475569" strokeWidth={1} cornerRadius={1.5} />
              <Rect x={iw * 0.1} y={ih / 2 + 2} width={12} height={6} fill="#ffffff" stroke="#475569" strokeWidth={1} cornerRadius={1.5} />
              
              <Rect x={-iw / 2 - 8} y={-6} width={6} height={12} fill="#ffffff" stroke="#475569" strokeWidth={1} cornerRadius={1.5} />
              <Rect x={iw / 2 + 2} y={-6} width={6} height={12} fill="#ffffff" stroke="#475569" strokeWidth={1} cornerRadius={1.5} />

              {/* Table Top */}
              <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={tableColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={3} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.1} shadowOffset={{ x: 1, y: 1 }} />
            </Group>
          );
        }
      case "wc_toilet":
        return (
          <Group>
            {/* Tank */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={9} fill="#ffffff" stroke="#0f172a" strokeWidth={1.5} cornerRadius={1.5} shadowColor="#0f172a" shadowBlur={3} shadowOpacity={0.08} shadowOffset={{ x: 0.8, y: 0.8 }} />
            {/* Bowl outer */}
            <Rect x={-iw * 0.8 / 2} y={-ih / 2 + 9} width={iw * 0.8} height={ih - 9} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={8} />
            {/* Bowl inner */}
            <Rect x={-iw * 0.55 / 2} y={-ih / 2 + 11} width={iw * 0.55} height={ih - 14} fill="#ffffff" stroke="#475569" strokeWidth={0.8} cornerRadius={6} />
            {/* Flush button */}
            <Rect x={-4} y={-ih / 2 + 3} width={8} height={3} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.5} cornerRadius={0.5} />
          </Group>
        );
      case "wc_lavabo":
        {
          const isDouble = item.w >= 1.0 || item.style === "double";
          return (
            <Group>
              <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={3} shadowColor="#0f172a" shadowBlur={3} shadowOpacity={0.08} shadowOffset={{ x: 0.8, y: 0.8 }} />
              {isDouble ? (
                <>
                  {/* Left Basin */}
                  <Rect x={-iw / 2 + 4} y={-ih * 0.78 / 2} width={iw / 2 - 6} height={ih * 0.78} fill="#ffffff" stroke="#475569" strokeWidth={1} cornerRadius={5} />
                  <Rect x={-iw / 2 + 6} y={-ih * 0.58 / 2} width={iw / 2 - 10} height={ih * 0.58} fill="#ffffff" stroke="#94a3b8" strokeWidth={0.8} cornerRadius={4} />
                  <Circle x={-iw / 4} y={0} radius={1.5} fill="#475569" />
                  <Line points={[-iw / 4, -ih * 0.28, -iw / 4, -ih * 0.05]} stroke="#94a3b8" strokeWidth={1.5} lineCap="round" />
                  
                  {/* Right Basin */}
                  <Rect x={2} y={-ih * 0.78 / 2} width={iw / 2 - 6} height={ih * 0.78} fill="#ffffff" stroke="#475569" strokeWidth={1} cornerRadius={5} />
                  <Rect x={4} y={-ih * 0.58 / 2} width={iw / 2 - 10} height={ih * 0.58} fill="#ffffff" stroke="#94a3b8" strokeWidth={0.8} cornerRadius={4} />
                  <Circle x={iw / 4} y={0} radius={1.5} fill="#475569" />
                  <Line points={[iw / 4, -ih * 0.28, iw / 4, -ih * 0.05]} stroke="#94a3b8" strokeWidth={1.5} lineCap="round" />
                </>
              ) : (
                <>
                  {/* Single Basin */}
                  <Rect x={-iw * 0.78 / 2} y={-ih * 0.78 / 2} width={iw * 0.78} height={ih * 0.78} fill="#ffffff" stroke="#475569" strokeWidth={1} cornerRadius={5} />
                  <Rect x={-iw * 0.58 / 2} y={-ih * 0.58 / 2} width={iw * 0.58} height={ih * 0.58} fill="#ffffff" stroke="#94a3b8" strokeWidth={0.8} cornerRadius={4} />
                  <Circle x={0} y={0} radius={1.5} fill="#475569" />
                  <Line points={[0, -ih * 0.28, 0, -ih * 0.05]} stroke="#94a3b8" strokeWidth={1.5} lineCap="round" />
                </>
              )}
            </Group>
          );
        }
      case "wc_mirror":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1} cornerRadius={2} />
            <Rect x={-iw / 2 + 2} y={-ih / 2 + 2} width={iw - 4} height={ih - 4} fill="#ffffff" stroke="#cbd5e1" strokeWidth={0.5} cornerRadius={1} />
          </Group>
        );
      case "wc_shower":
        return (
          <Group>
            {/* Glass enclosure */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={1} shadowColor="#0f172a" shadowBlur={3} shadowOpacity={0.08} shadowOffset={{ x: 0.8, y: 0.8 }} />
            {/* Drain */}
            <Circle x={0} y={0} radius={4} fill="#e2e8f0" stroke="#475569" strokeWidth={0.8} />
            <Circle x={0} y={0} radius={1.5} fill="#090d16" />
            {/* Shower head symbol on one wall */}
            <Line points={[0, -ih / 2, 0, -ih / 2 + 8]} stroke="#94a3b8" strokeWidth={1.8} lineCap="round" />
            <Line points={[-4, -ih / 2 + 8, 4, -ih / 2 + 8]} stroke="#475569" strokeWidth={1.2} />
            {/* Diagonal line to indicate glass door entry */}
            <Line points={[-iw / 2, ih / 2, -iw / 2 + 10, ih / 2 - 10]} stroke="#0f172a" strokeWidth={1} dash={[2, 2]} />
          </Group>
        );
      case "wc_bathtub":
        {
          const isJacuzzi = item.style === "jacuzzi";
          if (isJacuzzi) {
            return (
              <Group>
                <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={4} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.1} shadowOffset={{ x: 1, y: 1 }} />
                <Rect x={-iw / 2 + 2} y={-ih / 2 + 2} width={iw - 4} height={ih - 4} fill="#ffffff" stroke="#475569" strokeWidth={1} cornerRadius={3} />
                <Circle x={0} y={0} radius={Math.min(iw, ih) * 0.375} fill="#f1f5f9" stroke="#475569" strokeWidth={0.8} />
                <Circle x={0} y={0} radius={3} fill="#0f172a" />
                <Circle x={-iw / 2 + 5} y={0} radius={1.5} fill="#475569" />
                <Circle x={iw / 2 - 5} y={0} radius={1.5} fill="#475569" />
                <Circle x={0} y={-ih / 2 + 5} radius={1.5} fill="#475569" />
                <Circle x={0} y={ih / 2 - 5} radius={1.5} fill="#475569" />
              </Group>
            );
          }
          return (
            <Group>
              <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={10} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.1} shadowOffset={{ x: 1, y: 1 }} />
              <Rect x={-iw / 2 + 2} y={-ih / 2 + 2} width={iw - 4} height={ih - 4} fill="#ffffff" stroke="#475569" strokeWidth={1} cornerRadius={8} />
              <Circle x={iw / 2 - 4} y={ih / 2 - 4} radius={2.5} fill="#94a3b8" />
              <Line points={[iw / 2 - 4, ih / 2 - 4, iw / 2 - 10, ih / 2 - 10]} stroke="#94a3b8" strokeWidth={1.5} lineCap="round" />
            </Group>
          );
        }
      case "garage_car":
        return (
          <Group>
            {/* Wheels shadow / bottom wheels */}
            <Rect x={-iw / 2 - 2} y={-ih * 0.35} width={4} height={12} fill="#0f172a" cornerRadius={1} />
            <Rect x={iw / 2 - 2} y={-ih * 0.35} width={4} height={12} fill="#0f172a" cornerRadius={1} />
            <Rect x={-iw / 2 - 2} y={ih * 0.25} width={4} height={12} fill="#0f172a" cornerRadius={1} />
            <Rect x={iw / 2 - 2} y={ih * 0.25} width={4} height={12} fill="#0f172a" cornerRadius={1} />
            
            {/* Main Car Body */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={10} shadowColor="#0f172a" shadowBlur={5} shadowOpacity={0.15} shadowOffset={{ x: 1.5, y: 1.5 }} />
            
            {/* Windshield & Windows */}
            <Rect x={-iw * 0.75 / 2} y={-ih * 0.25} width={iw * 0.75} height={ih * 0.12} fill="#bae6fd" stroke="#0f172a" strokeWidth={1} cornerRadius={2} />
            <Rect x={-iw * 0.7 / 2} y={-ih * 0.08} width={iw * 0.7} height={ih * 0.34} fill="#f1f5f9" stroke="#0f172a" strokeWidth={1} cornerRadius={3} />
            <Rect x={-iw * 0.75 / 2} y={ih * 0.28} width={iw * 0.75} height={ih * 0.08} fill="#bae6fd" stroke="#0f172a" strokeWidth={1} cornerRadius={1} />
            
            {/* Headlights */}
            <Rect x={-iw / 2 + 4} y={-ih / 2 + 1} width={6} height={3} fill="#eab308" stroke="#0f172a" strokeWidth={0.5} cornerRadius={1} />
            <Rect x={iw / 2 - 10} y={-ih / 2 + 1} width={6} height={3} fill="#eab308" stroke="#0f172a" strokeWidth={0.5} cornerRadius={1} />
            
            {/* Side Mirrors */}
            <Rect x={-iw / 2 - 4} y={-ih * 0.25} width={4} height={3} fill={fillColor} stroke="#0f172a" strokeWidth={0.8} cornerRadius={1} />
            <Rect x={iw / 2} y={-ih * 0.25} width={4} height={3} fill={fillColor} stroke="#0f172a" strokeWidth={0.8} cornerRadius={1} />
            
            {/* Car grill line */}
            <Line points={[-iw / 4, -ih / 2 + 2, iw / 4, -ih / 2 + 2]} stroke="#475569" strokeWidth={1} />
          </Group>
        );
      case "office_desk":
        {
          const isL = item.style === "l_shape";
          const isExec = item.style === "executive";
          if (isL) {
            return (
              <Group>
                {/* Main Desk top */}
                <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih * 0.5} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} />
                {/* Return part of L-desk (drawn on right side) */}
                <Rect x={iw / 2 - ih * 0.5} y={-ih / 2} width={ih * 0.5} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} />
                {/* Keyboard & Monitor on main desk */}
                <Rect x={-iw * 0.2} y={-ih / 2 + 6} width={iw * 0.4} height={5} fill="#ffffff" stroke="#475569" strokeWidth={0.8} cornerRadius={1} />
                <Rect x={-iw * 0.25} y={-ih / 2 + 1} width={iw * 0.5} height={2} fill="#090d16" stroke="#0f172a" strokeWidth={1} cornerRadius={1} />
                {/* Chair */}
                <Group x={-iw / 6} y={ih / 4}>
                  <Circle x={0} y={0} radius={6} fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />
                  <Rect x={-8} y={-1.5} width={1.5} height={3} fill="#475569" stroke="#0f172a" strokeWidth={0.5} />
                  <Rect x={6.5} y={-1.5} width={1.5} height={3} fill="#475569" stroke="#0f172a" strokeWidth={0.5} />
                </Group>
              </Group>
            );
          }
          if (isExec) {
            return (
              <Group>
                {/* Main Table top with shadow */}
                <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.8} cornerRadius={4} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.1} shadowOffset={{ x: 1, y: 1 }} />
                {/* Drawers left/right side lines */}
                <Line points={[-iw / 2 + 12, -ih / 2, -iw / 2 + 12, ih / 2]} stroke="#475569" strokeWidth={1.2} />
                <Line points={[iw / 2 - 12, -ih / 2, iw / 2 - 12, ih / 2]} stroke="#475569" strokeWidth={1.2} />
                {/* Large Monitor & keyboard */}
                <Rect x={-iw * 0.2} y={-ih / 2 + 10} width={iw * 0.4} height={7} fill="#ffffff" stroke="#475569" strokeWidth={0.8} cornerRadius={1} />
                <Rect x={-iw * 0.3} y={-ih / 2 + 2} width={iw * 0.6} height={3} fill="#090d16" stroke="#0f172a" strokeWidth={1.2} cornerRadius={1} />
                {/* Executive Chair behind it */}
                <Group x={0} y={ih / 2 + 10}>
                  <Circle x={0} y={0} radius={9} fill="#1e293b" stroke="#0f172a" strokeWidth={1.5} />
                  <Rect x={-11} y={-3} width={2} height={6} fill="#475569" stroke="#0f172a" strokeWidth={0.5} cornerRadius={0.5} />
                  <Rect x={9} y={-3} width={2} height={6} fill="#475569" stroke="#0f172a" strokeWidth={0.5} cornerRadius={0.5} />
                </Group>
              </Group>
            );
          }
          // Standard/Default desk
          return (
            <Group>
              <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={3} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.1} shadowOffset={{ x: 1, y: 1 }} />
              <Rect x={-iw * 0.25} y={-ih / 2 + 8} width={iw * 0.5} height={6} fill="#ffffff" stroke="#475569" strokeWidth={0.8} cornerRadius={1} />
              <Rect x={-iw * 0.35} y={-ih / 2 + 1} width={iw * 0.7} height={3} fill="#090d16" stroke="#0f172a" strokeWidth={1} cornerRadius={1} />
              <Group x={0} y={ih / 2 + 9}>
                <Circle x={0} y={0} radius={8} fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />
                <Rect x={-10} y={-2} width={2} height={4} fill="#475569" stroke="#0f172a" strokeWidth={0.5} cornerRadius={0.5} />
                <Rect x={8} y={-2} width={2} height={4} fill="#475569" stroke="#0f172a" strokeWidth={0.5} cornerRadius={0.5} />
              </Group>
            </Group>
          );
        }
      case "office_filing_cabinet":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} />
            {/* Drawers separation lines */}
            <Line points={[-iw / 2 + 2, -ih / 6, iw / 2 - 2, -ih / 6]} stroke="#475569" strokeWidth={1} />
            <Line points={[-iw / 2 + 2, ih / 6, iw / 2 - 2, ih / 6]} stroke="#475569" strokeWidth={1} />
            {/* Handles */}
            <Rect x={-8} y={-ih / 3 - 1} width={16} height={2} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} cornerRadius={0.5} />
            <Rect x={-8} y={-1} width={16} height={2} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} cornerRadius={0.5} />
            <Rect x={-8} y={ih / 3 - 1} width={16} height={2} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} cornerRadius={0.5} />
          </Group>
        );
      case "office_chair":
        return (
          <Group>
            {/* Swivel base lines (cross style) */}
            <Line points={[-iw / 2 + 4, -ih / 2 + 4, iw / 2 - 4, ih / 2 - 4]} stroke="#0f172a" strokeWidth={2} />
            <Line points={[-iw / 2 + 4, ih / 2 - 4, iw / 2 - 4, -ih / 2 + 4]} stroke="#0f172a" strokeWidth={2} />
            {/* Main seat cushion */}
            <Circle x={0} y={0} radius={Math.min(iw, ih) / 2.2} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} shadowColor="#0f172a" shadowBlur={3} shadowOpacity={0.1} />
            {/* Armrests */}
            <Rect x={-iw / 2 + 1} y={-ih / 4} width={3} height={ih / 2} fill="#1e293b" stroke="#0f172a" strokeWidth={1} cornerRadius={1} />
            <Rect x={iw / 2 - 4} y={-ih / 4} width={3} height={ih / 2} fill="#1e293b" stroke="#0f172a" strokeWidth={1} cornerRadius={1} />
            {/* Curved backrest */}
            <Rect x={-iw / 3} y={ih / 2 - 6} width={iw * 2 / 3} height={4} fill="#090d16" stroke="#0f172a" strokeWidth={1} cornerRadius={1.5} />
          </Group>
        );
      case "outdoor_bbq":
        return (
          <Group>
            {/* BBQ Grill frame - uses fillColor (normally white/light) to avoid being too black */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={3} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.15} />
            {/* Side trays */}
            <Rect x={-iw / 2 - 3} y={-ih / 4} width={3} height={ih / 2} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} />
            <Rect x={iw / 2} y={-ih / 4} width={3} height={ih / 2} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} />
            {/* Grill mesh area - charcoal gray */}
            <Rect x={-iw / 2 + 4} y={-ih / 2 + 4} width={iw - 8} height={ih - 8} fill="#334155" stroke="#0f172a" strokeWidth={0.8} />
            {/* Grill slats */}
            <Line points={[-iw / 2 + 8, -ih / 2 + 6, iw / 2 - 8, -ih / 2 + 6]} stroke="#ffffff" strokeWidth={0.8} />
            <Line points={[-iw / 2 + 8, -ih / 4, iw / 2 - 8, -ih / 4]} stroke="#ffffff" strokeWidth={0.8} />
            <Line points={[-iw / 2 + 8, 0, iw / 2 - 8, 0]} stroke="#ffffff" strokeWidth={0.8} />
            <Line points={[-iw / 2 + 8, ih / 4, iw / 2 - 8, ih / 4]} stroke="#ffffff" strokeWidth={0.8} />
            <Line points={[-iw / 2 + 8, ih / 2 - 6, iw / 2 - 8, ih / 2 - 6]} stroke="#ffffff" strokeWidth={0.8} />
            {/* Knobs */}
            <Circle x={-iw / 4} y={ih / 2 - 2} radius={1.5} fill="#ef4444" />
            <Circle x={0} y={ih / 2 - 2} radius={1.5} fill="#ffffff" />
            <Circle x={iw / 4} y={ih / 2 - 2} radius={1.5} fill="#ffffff" />
          </Group>
        );
      case "outdoor_lounge_chair":
        {
          const isSun = item.style === "sun_lounger";
          if (isSun) {
            return (
              <Group>
                {/* Sun Lounger Base */}
                <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} />
                {/* Woven strip patterns */}
                <Line points={[-iw / 2, -ih / 3, iw / 2, -ih / 3]} stroke="#cbd5e1" strokeWidth={1} />
                <Line points={[-iw / 2, -ih / 6, iw / 2, -ih / 6]} stroke="#cbd5e1" strokeWidth={1} />
                <Line points={[-iw / 2, 0, iw / 2, 0]} stroke="#cbd5e1" strokeWidth={1} />
                <Line points={[-iw / 2, ih / 6, iw / 2, ih / 6]} stroke="#cbd5e1" strokeWidth={1} />
                <Line points={[-iw / 2, ih / 3, iw / 2, ih / 3]} stroke="#cbd5e1" strokeWidth={1} />
                {/* Pillow */}
                <Rect x={-iw / 2 + 3} y={-ih / 2 + 4} width={iw - 6} height={6} fill="#ffffff" stroke="#0f172a" strokeWidth={0.8} cornerRadius={1.5} />
              </Group>
            );
          }
          // Wicker Chair
          return (
            <Group>
              <Circle x={0} y={0} radius={Math.min(iw, ih) / 2} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} />
              {/* Radial wicker lines */}
              <Line points={[-iw / 3, -ih / 3, iw / 3, ih / 3]} stroke="#b45309" strokeWidth={0.8} />
              <Line points={[-iw / 3, ih / 3, iw / 3, -ih / 3]} stroke="#b45309" strokeWidth={0.8} />
              <Line points={[0, -ih / 2, 0, ih / 2]} stroke="#b45309" strokeWidth={0.8} />
              <Line points={[-iw / 2, 0, iw / 2, 0]} stroke="#b45309" strokeWidth={0.8} />
              {/* Cushion */}
              <Circle x={0} y={0} radius={Math.min(iw, ih) / 3.2} fill="#ffffff" stroke="#0f172a" strokeWidth={1} />
            </Group>
          );
        }
      case "outdoor_dining_set":
        return (
          <Group>
            {/* Table */}
            <Rect x={-iw / 3} y={-ih / 3} width={iw * 2 / 3} height={ih * 2 / 3} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} shadowColor="#0f172a" shadowBlur={3} shadowOpacity={0.08} />
            {/* 4 chairs around the table */}
            {/* Top chair */}
            <Rect x={-iw / 6} y={-ih / 2 + 1} width={iw / 3} height={3} fill="#cbd5e1" stroke="#0f172a" strokeWidth={1} cornerRadius={0.5} />
            {/* Bottom chair */}
            <Rect x={-iw / 6} y={ih / 2 - 4} width={iw / 3} height={3} fill="#cbd5e1" stroke="#0f172a" strokeWidth={1} cornerRadius={0.5} />
            {/* Left chair */}
            <Rect x={-iw / 2 + 1} y={-ih / 6} width={3} height={ih / 3} fill="#cbd5e1" stroke="#0f172a" strokeWidth={1} cornerRadius={0.5} />
            {/* Right chair */}
            <Rect x={iw / 2 - 4} y={-ih / 6} width={3} height={ih / 3} fill="#cbd5e1" stroke="#0f172a" strokeWidth={1} cornerRadius={0.5} />
            {/* Umbrella in the center */}
            <Circle x={0} y={0} radius={8} fill="#38bdf8" stroke="#0f172a" strokeWidth={1} />
            <Line points={[-6, -6, 6, 6]} stroke="#ffffff" strokeWidth={1} />
            <Line points={[-6, 6, 6, -6]} stroke="#ffffff" strokeWidth={1} />
            <Circle x={0} y={0} radius={2} fill="#ffffff" stroke="#0f172a" strokeWidth={0.8} />
          </Group>
        );
      case "stairs": {
        const stairStyle = item.style || "straight";
        if (stairStyle === "l_shaped_landing" || stairStyle === "l_shaped_winder") {
          const isWinder = stairStyle === "l_shaped_winder";
          return (
            <Group>
              {/* Outer L-shaped border */}
              <Line
                points={[
                  -iw / 2, ih / 2,
                  -iw / 2, -ih / 2,
                  iw / 2, -ih / 2,
                  iw / 2, 0,
                  0, 0,
                  0, ih / 2,
                  -iw / 2, ih / 2
                ]}
                closed={true}
                fill={fillColor}
                stroke="#0f172a"
                strokeWidth={1.5}
              />
              {/* Landing square border: from (-iw/2, -ih/2) to (0, 0) */}
              {!isWinder ? (
                <Rect x={-iw / 2} y={-ih / 2} width={iw / 2} height={ih / 2} fill="#cbd5e1" stroke="#475569" strokeWidth={0.8} />
              ) : (
                // Winder landing has diagonal split lines
                <>
                  <Line points={[-iw / 2, -ih / 2, 0, 0]} stroke="#475569" strokeWidth={1} />
                  <Line points={[-iw / 2, -ih / 4, 0, 0]} stroke="#475569" strokeWidth={0.8} />
                  <Line points={[-iw / 4, -ih / 2, 0, 0]} stroke="#475569" strokeWidth={0.8} />
                </>
              )}
              {/* Left run steps (vertical run going up to landing) */}
              <Line points={[-iw / 2, ih * 0.35, 0, ih * 0.35]} stroke="#475569" strokeWidth={1} />
              <Line points={[-iw / 2, ih * 0.20, 0, ih * 0.20]} stroke="#475569" strokeWidth={1} />
              <Line points={[-iw / 2, ih * 0.05, 0, ih * 0.05]} stroke="#475569" strokeWidth={1} />
              <Line points={[-iw / 2, -ih * 0.10, 0, -ih * 0.10]} stroke="#475569" strokeWidth={1} />

              {/* Top run steps (horizontal run going right from landing) */}
              <Line points={[iw * 0.15, -ih / 2, iw * 0.15, 0]} stroke="#475569" strokeWidth={1} />
              <Line points={[iw * 0.30, -ih / 2, iw * 0.30, 0]} stroke="#475569" strokeWidth={1} />
              <Line points={[iw * 0.45, -ih / 2, iw * 0.45, 0]} stroke="#475569" strokeWidth={1} />

              {/* L-shaped Arrow */}
              <Line
                points={[
                  -iw / 4, ih * 0.4,
                  -iw / 4, -ih / 4,
                  iw * 0.4, -ih / 4
                ]}
                stroke="#0f172a"
                strokeWidth={1.2}
              />
              <Line points={[iw * 0.4 - 4, -ih / 4 - 4, iw * 0.4, -ih / 4, iw * 0.4 - 4, -ih / 4 + 4]} stroke="#0f172a" strokeWidth={1.2} />
            </Group>
          );
        } else if (stairStyle === "u_shaped") {
          return (
            <Group>
              {/* Outer boundary */}
              <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={1} />
              {/* Center divider */}
              <Line points={[0, ih / 2, 0, -ih / 4]} stroke="#0f172a" strokeWidth={1.5} />
              {/* Top landing */}
              <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih / 4} fill="#cbd5e1" stroke="#475569" strokeWidth={0.8} />

              {/* Left run steps */}
              <Line points={[-iw / 2, -ih * 0.1, 0, -ih * 0.1]} stroke="#475569" strokeWidth={1} />
              <Line points={[-iw / 2, ih * 0.05, 0, ih * 0.05]} stroke="#475569" strokeWidth={1} />
              <Line points={[-iw / 2, ih * 0.2, 0, ih * 0.2]} stroke="#475569" strokeWidth={1} />
              <Line points={[-iw / 2, ih * 0.35, 0, ih * 0.35]} stroke="#475569" strokeWidth={1} />

              {/* Right run steps */}
              <Line points={[0, -ih * 0.1, iw / 2, -ih * 0.1]} stroke="#475569" strokeWidth={1} />
              <Line points={[0, ih * 0.05, iw / 2, ih * 0.05]} stroke="#475569" strokeWidth={1} />
              <Line points={[0, ih * 0.2, iw / 2, ih * 0.2]} stroke="#475569" strokeWidth={1} />
              <Line points={[0, ih * 0.35, iw / 2, ih * 0.35]} stroke="#475569" strokeWidth={1} />

              {/* U-shaped Arrow */}
              <Line
                points={[
                  -iw / 4, ih * 0.4,
                  -iw / 4, -ih * 0.35,
                  iw / 4, -ih * 0.35,
                  iw / 4, ih * 0.4
                ]}
                stroke="#0f172a"
                strokeWidth={1.2}
              />
              <Line points={[iw / 4 - 4, ih * 0.4 - 4, iw / 4, ih * 0.4, iw / 4 + 4, ih * 0.4 - 4]} stroke="#0f172a" strokeWidth={1.2} />
            </Group>
          );
        } else {
          return (
            <Group>
              {/* Stair boundaries */}
              <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={1} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.08} shadowOffset={{ x: 1, y: 1 }} />
              {/* Stair steps lines */}
              <Line points={[-iw / 2, -ih * 0.3, iw / 2, -ih * 0.3]} stroke="#475569" strokeWidth={1} />
              <Line points={[-iw / 2, -ih * 0.1, iw / 2, -ih * 0.1]} stroke="#475569" strokeWidth={1} />
              <Line points={[-iw / 2, ih * 0.1, iw / 2, ih * 0.1]} stroke="#475569" strokeWidth={1} />
              <Line points={[-iw / 2, ih * 0.3, iw / 2, ih * 0.3]} stroke="#475569" strokeWidth={1} />
              {/* Direction Arrow */}
              <Line points={[0, ih * 0.4, 0, -ih * 0.4]} stroke="#0f172a" strokeWidth={1.2} />
              <Line points={[-4, -ih * 0.4 + 4, 0, -ih * 0.4, 4, -ih * 0.4 + 4]} stroke="#0f172a" strokeWidth={1.2} />
            </Group>
          );
        }
      }
      case "plant_pots":
        return (
          <Group>
            {/* Pot */}
            <Circle x={0} y={0} radius={6} fill="#c2410c" stroke="#0f172a" strokeWidth={1} shadowColor="#0f172a" shadowBlur={3} shadowOpacity={0.1} shadowOffset={{ x: 0.8, y: 0.8 }} />
            {/* Leaves */}
            <Circle x={0} y={0} radius={3} fill="#15803d" />
            <Line points={[0, 0, -10, -5]} stroke="#15803d" strokeWidth={2} lineCap="round" />
            <Line points={[0, 0, 10, -5]} stroke="#15803d" strokeWidth={2} lineCap="round" />
            <Line points={[0, 0, -5, 10]} stroke="#15803d" strokeWidth={2} lineCap="round" />
            <Line points={[0, 0, 5, 10]} stroke="#15803d" strokeWidth={2} lineCap="round" />
            <Line points={[0, 0, 0, -11]} stroke="#15803d" strokeWidth={2} lineCap="round" />
          </Group>
        );
      case "gym_treadmill":
        return (
          <Group>
            {/* Treadmill Frame */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.1} shadowOffset={{ x: 1, y: 1 }} />
            {/* Running belt - light gray */}
            <Rect x={-iw * 0.7 / 2} y={-ih / 2 + 6} width={iw * 0.7} height={ih - 12} fill="#cbd5e1" stroke="#475569" strokeWidth={0.8} />
            {/* Belt tracks */}
            <Line points={[-iw * 0.7 / 2, -ih / 4, iw * 0.7 / 2, -ih / 4]} stroke="#94a3b8" strokeWidth={0.8} />
            <Line points={[-iw * 0.7 / 2, 0, iw * 0.7 / 2, 0]} stroke="#94a3b8" strokeWidth={0.8} />
            <Line points={[-iw * 0.7 / 2, ih / 4, iw * 0.7 / 2, ih / 4]} stroke="#94a3b8" strokeWidth={0.8} />
            {/* Handles */}
            <Line points={[-iw / 2 + 2, -ih / 2 + 10, -iw / 2 + 2, -ih / 2 + 2, iw / 2 - 2, -ih / 2 + 2, iw / 2 - 2, -ih / 2 + 10]} stroke="#0f172a" strokeWidth={2} lineJoin="round" />
            {/* Console */}
            <Rect x={-iw * 0.4 / 2} y={-ih / 2 + 1} width={iw * 0.4} height={4} fill="#090d16" stroke="#0f172a" strokeWidth={0.8} cornerRadius={0.5} />
          </Group>
        );
      case "recreation_pool_table":
        return (
          <Group>
            {/* Table wood frame */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill="#854d0e" stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.1} shadowOffset={{ x: 1, y: 1 }} />
            {/* Green felt */}
            <Rect x={-iw / 2 + 4} y={-ih / 2 + 4} width={iw - 8} height={ih - 8} fill="#15803d" stroke="#0f172a" strokeWidth={1} />
            {/* Pockets */}
            <Circle x={-iw / 2 + 5} y={-ih / 2 + 5} radius={2.5} fill="#090d16" />
            <Circle x={iw / 2 - 5} y={-ih / 2 + 5} radius={2.5} fill="#090d16" />
            <Circle x={-iw / 2 + 5} y={ih / 2 - 5} radius={2.5} fill="#090d16" />
            <Circle x={iw / 2 - 5} y={ih / 2 - 5} radius={2.5} fill="#090d16" />
            <Circle x={0} y={-ih / 2 + 4} radius={2} fill="#090d16" />
            <Circle x={0} y={ih / 2 - 4} radius={2} fill="#090d16" />
          </Group>
        );
      case "bed_dresser":
        return (
          <Group>
            {/* Main dresser box */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} shadowColor="#0f172a" shadowBlur={4} shadowOpacity={0.08} shadowOffset={{ x: 1, y: 1 }} />
            {/* Drawer line details */}
            <Line points={[-iw / 6, -ih / 2 + 1, -iw / 6, ih / 2 - 1]} stroke="#475569" strokeWidth={0.8} />
            <Line points={[iw / 6, -ih / 2 + 1, iw / 6, ih / 2 - 1]} stroke="#475569" strokeWidth={0.8} />
            {/* Drawer handles */}
            <Rect x={-iw / 3 - 3} y={-1} width={6} height={2} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} cornerRadius={0.5} />
            <Rect x={-3} y={-1} width={6} height={2} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} cornerRadius={0.5} />
            <Rect x={iw / 3 - 3} y={-1} width={6} height={2} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} cornerRadius={0.5} />
          </Group>
        );
      case "entry_bench":
        return (
          <Group>
            {/* Bench seat */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={3} />
            {/* Cushion / slatted wood lines */}
            <Line points={[-iw / 2 + 6, 0, iw / 2 - 6, 0]} stroke="#475569" strokeWidth={1} />
            <Line points={[-iw / 2 + 6, -ih / 4, iw / 2 - 6, -ih / 4]} stroke="#475569" strokeWidth={0.8} />
            <Line points={[-iw / 2 + 6, ih / 4, iw / 2 - 6, ih / 4]} stroke="#475569" strokeWidth={0.8} />
          </Group>
        );
      case "entry_coat_stand":
        return (
          <Group>
            {/* Heavy base */}
            <Circle x={0} y={0} radius={Math.min(iw, ih) * 0.4} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} />
            {/* Vertical column center */}
            <Circle x={0} y={0} radius={3} fill="#475569" />
            {/* 4 hooks pointing in cardinal directions */}
            <Line points={[0, 0, 0, -ih * 0.45]} stroke="#0f172a" strokeWidth={1.5} lineCap="round" />
            <Line points={[0, 0, 0, ih * 0.45]} stroke="#0f172a" strokeWidth={1.5} lineCap="round" />
            <Line points={[0, 0, -iw * 0.45, 0]} stroke="#0f172a" strokeWidth={1.5} lineCap="round" />
            <Line points={[0, 0, iw * 0.45, 0]} stroke="#0f172a" strokeWidth={1.5} lineCap="round" />
            {/* Hook ends */}
            <Circle x={0} y={-ih * 0.45} radius={1.5} fill="#e2e8f0" />
            <Circle x={0} y={ih * 0.45} radius={1.5} fill="#e2e8f0" />
            <Circle x={-iw * 0.45} y={0} radius={1.5} fill="#e2e8f0" />
            <Circle x={iw * 0.45} y={0} radius={1.5} fill="#e2e8f0" />
          </Group>
        );
      case "entry_console_mirror":
        {
          const safeIw = isNaN(iw) || iw <= 0 ? 40 : iw;
          const safeIh = isNaN(ih) || ih <= 0 ? 16 : ih;
          return (
            <Group>
              {/* Console table top */}
              <Rect x={-safeIw / 2} y={-safeIh / 2} width={safeIw} height={safeIh} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={1} />
              {/* Wall mirror line behind it */}
              <Rect x={-safeIw * 0.8 / 2} y={-safeIh / 2 - 1.5} width={safeIw * 0.8} height={3} fill="#38bdf8" stroke="#0f172a" strokeWidth={1} cornerRadius={0.5} />
              {/* Decorative items on console */}
              <Circle x={-safeIw / 4} y={0} radius={Math.min(3, safeIw / 8)} fill="#22c55e" stroke="#15803d" strokeWidth={0.8} /> {/* plant bowl */}
              <Rect x={safeIw / 4 - 3} y={-2} width={Math.min(6, safeIw / 4)} height={Math.min(4, safeIh / 2)} fill="#e2e8f0" stroke="#475569" strokeWidth={0.5} /> {/* tray */}
            </Group>
          );
        }
      case "laundry_machines":
        {
          const isStacked = item.style === "stacked";
          return (
            <Group>
              {isStacked ? (
                <>
                  {/* Single machine outline but with double door and panel lines to represent stacking */}
                  <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={3} />
                  {/* Large drum door */}
                  <Circle x={0} y={ih * 0.08} radius={Math.min(iw, ih) * 0.32} fill="#cbd5e1" stroke="#0f172a" strokeWidth={1.2} />
                  <Circle x={-2} y={ih * 0.08} radius={Math.min(iw, ih) * 0.2} fill="#bae6fd" opacity={0.6} />
                  {/* Stacking panel indicator line */}
                  <Line points={[-iw / 2 + 2, -ih / 2 + 7, iw / 2 - 2, -ih / 2 + 7]} stroke="#475569" strokeWidth={0.8} />
                  {/* Controls */}
                  <Circle x={-iw / 4} y={-ih / 2 + 3.5} radius={1.5} fill="#0f172a" />
                  <Circle x={-iw / 4 + 6} y={-ih / 2 + 3.5} radius={1} fill="#475569" />
                  <Circle x={iw / 4} y={-ih / 2 + 3.5} radius={1.5} fill="#ef4444" />
                </>
              ) : (
                <>
                  {/* Side-by-side: Two separate units side by side */}
                  {/* Left unit: Washer */}
                  <Rect x={-iw / 2} y={-ih / 2} width={iw / 2 - 1} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} />
                  <Circle x={-iw / 4} y={ih * 0.08} radius={Math.min(iw / 2, ih) * 0.32} fill="#f1f5f9" stroke="#475569" strokeWidth={1} />
                  <Rect x={-iw / 2 + 3} y={-ih / 2 + 3} width={iw / 2 - 7} height={4} fill="#e2e8f0" />
                  <Circle x={-iw / 3} y={-ih / 2 + 5} radius={1} fill="#475569" />
                  
                  {/* Right unit: Dryer */}
                  <Rect x={1} y={-ih / 2} width={iw / 2 - 1} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} />
                  <Circle x={iw / 4} y={ih * 0.08} radius={Math.min(iw / 2, ih) * 0.32} fill="#f1f5f9" stroke="#475569" strokeWidth={1} />
                  <Rect x={4} y={-ih / 2 + 3} width={iw / 2 - 7} height={4} fill="#e2e8f0" />
                  <Circle x={iw / 3} y={-ih / 2 + 5} radius={1} fill="#475569" />
                </>
              )}
            </Group>
          );
        }
      case "laundry_sink":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} />
            {/* Basin */}
            <Rect x={-iw / 2 + 3} y={-ih / 2 + 3} width={iw - 6} height={ih - 6} fill="#f1f5f9" stroke="#475569" strokeWidth={1} cornerRadius={1} />
            {/* Washboard ribbed lines pattern on one side */}
            <Line points={[-iw / 4, -ih / 4, -iw / 4, ih / 4]} stroke="#cbd5e1" strokeWidth={1} />
            <Line points={[-iw / 4 + 3, -ih / 4, -iw / 4 + 3, ih / 4]} stroke="#cbd5e1" strokeWidth={1} />
            <Line points={[-iw / 4 + 6, -ih / 4, -iw / 4 + 6, ih / 4]} stroke="#cbd5e1" strokeWidth={1} />
            {/* Faucet */}
            <Circle x={iw / 4} y={-ih / 2 + 5} radius={1.5} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} />
            <Line points={[iw / 4, -ih / 2 + 5, iw / 4, -ih / 2 + 11]} stroke="#cbd5e1" strokeWidth={1.5} lineCap="round" />
          </Group>
        );
      case "garage_clothing_rack":
        return (
          <Group>
            {/* Rack base */}
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} />
            {/* Hanging bar */}
            <Line points={[-iw / 2 + 6, 0, iw / 2 - 6, 0]} stroke="#475569" strokeWidth={2} />
            {/* Clothes hangars */}
            <Line points={[-iw / 3, -4, -iw / 3, 4]} stroke="#cbd5e1" strokeWidth={1} />
            <Line points={[-iw / 6, -4, -iw / 6, 4]} stroke="#cbd5e1" strokeWidth={1} />
            <Line points={[0, -4, 0, 4]} stroke="#cbd5e1" strokeWidth={1} />
            <Line points={[iw / 6, -4, iw / 6, 4]} stroke="#cbd5e1" strokeWidth={1} />
            <Line points={[iw / 3, -4, iw / 3, 4]} stroke="#cbd5e1" strokeWidth={1} />
          </Group>
        );
      case "garage_generic_object":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} shadowColor="#0f172a" shadowBlur={3} shadowOpacity={0.08} shadowOffset={{ x: 0.8, y: 0.8 }} />
            <Line points={[-iw / 2, -ih / 2, iw / 2, ih / 2]} stroke="#475569" strokeWidth={1} />
            <Line points={[-iw / 2, ih / 2, iw / 2, -ih / 2]} stroke="#475569" strokeWidth={1} />
          </Group>
        );
      case "garage_hvac":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} />
            {/* Grille lines */}
            <Line points={[-iw / 2 + 4, -ih / 4, iw / 2 - 4, -ih / 4]} stroke="#475569" strokeWidth={1} />
            <Line points={[-iw / 2 + 4, 0, iw / 2 - 4, 0]} stroke="#475569" strokeWidth={1} />
            <Line points={[-iw / 2 + 4, ih / 4, iw / 2 - 4, ih / 4]} stroke="#475569" strokeWidth={1} />
            {/* Fan circle */}
            <Circle x={-iw / 6} y={0} radius={Math.min(iw, ih) * 0.35} fill="#e2e8f0" stroke="#0f172a" strokeWidth={1} />
            <Circle x={-iw / 6} y={0} radius={2} fill="#0f172a" />
          </Group>
        );
      case "garage_water_heater":
        return (
          <Group>
            <Circle x={0} y={0} radius={Math.min(iw, ih) / 2} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} />
            {/* Center cap */}
            <Circle x={0} y={0} radius={Math.min(iw, ih) / 5} fill="#ffffff" stroke="#475569" strokeWidth={0.8} />
            {/* Hot/cold pipe dots */}
            <Circle x={-Math.min(iw, ih) / 8} y={-Math.min(iw, ih) / 8} radius={1.5} fill="#ef4444" />
            <Circle x={Math.min(iw, ih) / 8} y={-Math.min(iw, ih) / 8} radius={1.5} fill="#0ea5e9" />
          </Group>
        );
      case "gym_bike":
        return (
          <Group>
            {/* Flywheel - light gray */}
            <Circle x={-iw / 3} y={0} radius={ih * 0.35} fill="#94a3b8" stroke="#0f172a" strokeWidth={1.2} />
            {/* Frame */}
            <Line points={[-iw / 3, 0, 0, 0, iw / 3, -ih / 4]} stroke="#0f172a" strokeWidth={2.5} />
            {/* Pedals */}
            <Circle x={0} y={0} radius={4} fill="#e2e8f0" stroke="#0f172a" strokeWidth={1} />
            {/* Seat */}
            <Rect x={iw / 3 - 4} y={-ih / 3 - 4} width={8} height={4} fill="#090d16" cornerRadius={1} />
            {/* Handlebars */}
            <Line points={[-iw / 3, -ih / 4, -iw / 3 - 4, -ih / 3]} stroke="#0f172a" strokeWidth={1.8} />
          </Group>
        );
      case "gym_bench":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={3} />
            {/* Padding split lines */}
            <Line points={[-iw / 4, -ih / 2, -iw / 4, ih / 2]} stroke="#475569" strokeWidth={1} />
            {/* Leg supports */}
            <Rect x={-iw / 2} y={-ih / 2 - 2} width={2} height={ih + 4} fill="#1e293b" />
            <Rect x={iw / 2 - 2} y={-ih / 2 - 2} width={2} height={ih + 4} fill="#1e293b" />
          </Group>
        );
      case "gym_weight_rack":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={1.5} />
            {/* Racks */}
            <Line points={[-iw / 2, -ih / 4, iw / 2, -ih / 4]} stroke="#475569" strokeWidth={1.2} />
            <Line points={[-iw / 2, ih / 4, iw / 2, ih / 4]} stroke="#475569" strokeWidth={1.2} />
            {/* Dumbbell shapes */}
            <Circle x={-iw / 3} y={-ih / 4} radius={2} fill="#0f172a" />
            <Circle x={-iw / 3 + 6} y={-ih / 4} radius={2} fill="#0f172a" />
            <Circle x={0} y={-ih / 4} radius={2.5} fill="#0f172a" />
            <Circle x={iw / 3} y={-ih / 4} radius={3} fill="#0f172a" />
          </Group>
        );
      case "gym_yoga_mat":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.2} cornerRadius={1} />
            {/* Rolled up lines on one end */}
            <Line points={[iw / 2 - 4, -ih / 2, iw / 2 - 4, ih / 2]} stroke="#475569" strokeWidth={0.8} />
            <Line points={[iw / 2 - 2, -ih / 2, iw / 2 - 2, ih / 2]} stroke="#475569" strokeWidth={1.2} />
          </Group>
        );
      case "living_bookshelf":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={1} />
            {/* Books */}
            <Rect x={-iw / 2 + 3} y={-ih / 2 + 2} width={4} height={ih - 4} fill="#ef4444" />
            <Rect x={-iw / 2 + 8} y={-ih / 2 + 2} width={3} height={ih - 4} fill="#0ea5e9" />
            <Rect x={-iw / 2 + 12} y={-ih / 2 + 2} width={5} height={ih - 4} fill="#eab308" />
            <Rect x={-iw / 2 + 18} y={-ih / 2 + 2} width={4} height={ih - 4} fill="#10b981" />
            <Rect x={iw / 4} y={-ih / 2 + 2} width={4} height={ih - 4} fill="#6366f1" />
          </Group>
        );
      case "living_credenza":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={2} />
            {/* Sliding doors details */}
            <Line points={[0, -ih / 2, 0, ih / 2]} stroke="#0f172a" strokeWidth={1} />
            <Circle x={-iw / 6} y={0} radius={2} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} />
            <Circle x={iw / 6} y={0} radius={2} fill="#cbd5e1" stroke="#0f172a" strokeWidth={0.8} />
          </Group>
        );
      case "living_coffee_table":
        return (
          <Group>
            <Rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} cornerRadius={4} shadowColor="#0f172a" shadowBlur={3} shadowOpacity={0.08} shadowOffset={{ x: 1, y: 1 }} />
            <Rect x={-iw * 0.8 / 2} y={-ih * 0.8 / 2} width={iw * 0.8} height={ih * 0.8} fill="#ffffff" stroke="#cbd5e1" strokeWidth={0.8} cornerRadius={2} />
          </Group>
        );
      case "living_side_table":
        return (
          <Group>
            <Circle x={0} y={0} radius={Math.min(iw, ih) / 2} fill={fillColor} stroke="#0f172a" strokeWidth={1.5} />
            <Circle x={0} y={0} radius={Math.min(iw, ih) / 2 - 3} fill="#ffffff" stroke="#cbd5e1" strokeWidth={0.8} />
          </Group>
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
            const preset = STYLE_PRESETS[value];
            if (preset) {
              return {
                ...r,
                style: value,
                finishes: {
                  ...r.finishes,
                  flooring: preset.flooring,
                  walls: preset.walls,
                  ceiling: preset.ceiling,
                  doors: preset.doors,
                  windows: preset.windows,
                }
              };
            }
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

  // ── Apply Finish To All Rooms ────────────────────────────────────────────
  const applyFinishToAllRooms = (
    targetType: "flooring" | "walls" | "ceiling" | "doors" | "windows",
    value: string
  ) => {
    if (floorPlan) {
      pushHistory(floorPlan);
      const updatedRooms = floorPlan.rooms.map((r) => ({
        ...r,
        finishes: {
          ...(r.finishes || {}),
          [targetType]: value,
        },
      }));
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

    // Use the same furniture generation as auto-generation for consistency
    const newFurniture = getDefaultFurnitureForRoom(room);

    if (!newFurniture || newFurniture.length === 0) {
      toast.info(`Chưa có mẫu đồ nội thất cho phòng "${room.name}"`);
      return;
    }

    // Give fresh unique IDs so they don't conflict with existing ones
    const timestampedFurniture: FurnitureItem[] = newFurniture.map((item) => ({
      ...item,
      id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }));

    pushHistory(floorPlan);
    const updatedRooms = floorPlan.rooms.map((r) => {
      if (r.id === room.id) {
        // Replace (not append) furniture to avoid duplicates on re-furnish
        return { ...r, furniture: timestampedFurniture };
      }
      return r;
    });
    const updatedPlan = { ...floorPlan, rooms: updatedRooms };
    setFloorPlan(updatedPlan);
    const nextPlans = [...floorPlans];
    nextPlans[activeFloorIndex] = updatedPlan;
    setFloorPlans(nextPlans);
    toast.success(`Đã trang trí nội thất cho ${room.name}!`);
  };

  // ── Opening (Door/Window) Edit/Add Utilities ──────────────────────────────
  const updateOpeningProperty = (openId: string, updates: Partial<Opening>) => {
    if (!floorPlan) return;
    pushHistory(floorPlan);
    const updatedOpenings = (floorPlan.openings || []).map((o) => {
      if (o.id === openId) {
        return { ...o, ...updates };
      }
      return o;
    });
    const updatedPlan = { ...floorPlan, openings: updatedOpenings };
    setFloorPlan(updatedPlan);
    const nextPlans = [...floorPlans];
    nextPlans[activeFloorIndex] = updatedPlan;
    setFloorPlans(nextPlans);
  };

  const rotateOpening = (openId: string) => {
    if (!floorPlan) return;
    pushHistory(floorPlan);
    const updatedOpenings = (floorPlan.openings || []).map((open) => {
      if (open.id === openId) {
        return { ...open, rotation: ((open.rotation || 0) + 90) % 360 };
      }
      return open;
    });
    const updatedPlan = { ...floorPlan, openings: updatedOpenings };
    setFloorPlan(updatedPlan);
    const nextPlans = [...floorPlans];
    nextPlans[activeFloorIndex] = updatedPlan;
    setFloorPlans(nextPlans);
    toast.success("Đã xoay ô cửa 90°");
  };

  const deleteOpening = (openId: string) => {
    if (!floorPlan) return;
    pushHistory(floorPlan);
    const updatedOpenings = (floorPlan.openings || []).filter((o) => o.id !== openId);
    const updatedPlan = { ...floorPlan, openings: updatedOpenings };
    setFloorPlan(updatedPlan);
    const nextPlans = [...floorPlans];
    nextPlans[activeFloorIndex] = updatedPlan;
    setFloorPlans(nextPlans);
    setSelectedOpeningId(null);
    toast.success("Đã xóa cửa/cửa sổ");
  };

  // ── Manual Furniture & Room Actions ────────────────────────────────────
  const [activeBottomPopup, setActiveBottomPopup] = useState<"furniture" | "structure" | null>(null);
  const [activeStructureCategory, setActiveStructureCategory] = useState<"door" | "stairs" | "window" | null>("door");
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [furnitureSearch, setFurnitureSearch] = useState("");

  const handleAddRoomManually = (roomName: string) => {
    if (!floorPlan) {
      toast.error("Vui lòng tạo mặt bằng trước!");
      return;
    }
    pushHistory(floorPlan);

    const nextRoomIndex = floorPlan.rooms.length;
    const newRoom: Room = {
      id: `room_${Date.now()}`,
      name: roomName,
      x: 1.0 + (nextRoomIndex * 0.5) % 3,
      y: 1.0 + (nextRoomIndex * 0.5) % 3,
      w: 3.5,
      h: 3.0,
      color: "#f8fafc",
      furniture: [],
      finishes: {
        flooring: "natural_oak",
        walls: "soft_white",
        ceiling: "paint_white",
        doors: "natural_oak",
        windows: "clear_glass"
      }
    };

    newRoom.furniture = getDefaultFurnitureForRoom(newRoom);

    const updatedPlan = {
      ...floorPlan,
      rooms: [...floorPlan.rooms, newRoom]
    };

    setFloorPlan(updatedPlan);
    const nextPlans = [...floorPlans];
    nextPlans[activeFloorIndex] = updatedPlan;
    setFloorPlans(nextPlans);

    setSelectedRoomId(newRoom.id);
    toast.success(`Đã thêm phòng ${roomName}! Hãy kéo các cạnh tường để thay đổi kích thước.`);
  };

  const handleAddFurniture = (type: string, customW?: number, customH?: number, customStyle?: string) => {
    let targetRoom = floorPlan.rooms.find(r => r.id === selectedRoomId);
    if (!targetRoom && floorPlan.rooms.length > 0) {
      targetRoom = floorPlan.rooms[0];
    }

    if (!targetRoom) {
      toast.error("Vui lòng chọn phòng trước khi thêm đồ nội thất!");
      return;
    }

    pushHistory(floorPlan);

    let w = customW || 1.0;
    let h = customH || 1.0;
    if (!customW || !customH) {
      if (type.includes("sofa")) { w = 1.8; h = 0.8; }
      else if (type.includes("tv")) { w = 1.5; h = 0.4; }
      else if (type.includes("dresser")) { w = 1.2; h = 0.5; }
      else if (type.includes("bed")) { w = 1.6; h = 2.0; }
      else if (type.includes("wardrobe")) { w = 1.6; h = 0.6; }
      else if (type.includes("nightstand")) { w = 0.5; h = 0.5; }
      else if (type.includes("dining")) { w = 1.4; h = 0.8; }
      else if (type.includes("counter")) { w = 2.0; h = 0.6; }
      else if (type.includes("cooktop")) { w = 0.8; h = 0.6; }
      else if (type.includes("sink")) { w = 0.8; h = 0.6; }
      else if (type.includes("fridge")) { w = 0.8; h = 0.8; }
      else if (type.includes("toilet")) { w = 0.5; h = 0.7; }
      else if (type.includes("lavabo")) { w = 0.6; h = 0.5; }
      else if (type.includes("bathtub")) { w = 0.8; h = 1.6; }
      else if (type.includes("car")) { w = 1.8; h = 4.2; }
      else if (type.includes("desk")) { w = 1.2; h = 0.6; }
      else if (type.includes("chair")) { w = 0.6; h = 0.6; }
      else if (type === "stairs") {
        if (customStyle?.startsWith("l_shaped")) {
          w = 1.6; h = 1.6;
        } else if (customStyle === "u_shaped") {
          w = 1.6; h = 2.0;
        } else {
          w = 1.0; h = 2.0;
        }
      }
      else if (type === "plant_pots") { w = 0.5; h = 0.5; }
      else if (type === "gym_treadmill") { w = 0.9; h = 1.8; }
      else if (type === "recreation_pool_table") { w = 1.6; h = 2.8; }
      else if (type === "wc_shower") { w = 0.9; h = 0.9; }
      else if (type.includes("bench")) { w = 1.2; h = 0.45; }
      else if (type.includes("coat_stand")) { w = 0.45; h = 0.45; }
      else if (type.includes("console_mirror")) { w = 1.0; h = 0.4; }
      else if (type.includes("laundry_machines")) { w = 1.4; h = 0.7; }
      else if (type.includes("laundry_sink")) { w = 0.65; h = 0.6; }
    }

    const spawnX = Math.round((targetRoom.w / 2) * 20) / 20;
    const spawnY = Math.round((targetRoom.h / 2) * 20) / 20;

    const newFurniture: FurnitureItem = {
      id: `fur_${type}_${Date.now()}`,
      type,
      x: spawnX,
      y: spawnY,
      w,
      h,
      rotation: 0,
      style: customStyle
    };

    const targetRoomId = targetRoom.id;

    const updatedRooms = floorPlan.rooms.map((r) => {
      if (r.id === targetRoomId) {
        return {
          ...r,
          furniture: [...(r.furniture || []), newFurniture]
        };
      }
      return r;
    });

    const updatedPlan = { ...floorPlan, rooms: updatedRooms };
    setFloorPlan(updatedPlan);
    const nextPlans = [...floorPlans];
    nextPlans[activeFloorIndex] = updatedPlan;
    setFloorPlans(nextPlans);

    setSelectedRoomId(targetRoomId);
    setSelectedFurnitureId(newFurniture.id);
    setSelectedFurnitureRoomId(targetRoomId);

    toast.success(`Đã thêm ${FURNITURE_METADATA[type]?.name || type}! Bạn có thể kéo thả để di chuyển.`);
  };

  const handleAddDoor = (style: string = "hinged") => {
    if (!floorPlan) {
      toast.error("Vui lòng tạo mặt bằng trước!");
      return;
    }
    pushHistory(floorPlan);
    const width = style === "garage" ? 2.4 : style === "sliding" ? 1.6 : 0.9;
    const newOpening: Opening = {
      id: `open_${activeFloorIndex}_${Date.now()}`,
      type: "door",
      x: 3.0,
      y: 3.0,
      w: width,
      rotation: 0,
      style
    };
    const updatedOpenings = [...(floorPlan.openings || []), newOpening];
    const updatedPlan = { ...floorPlan, openings: updatedOpenings };
    setFloorPlan(updatedPlan);
    const nextPlans = [...floorPlans];
    nextPlans[activeFloorIndex] = updatedPlan;
    setFloorPlans(nextPlans);
    setSelectedOpeningId(newOpening.id);
    const label = style === "garage" ? "cửa garage" : style === "sliding" ? "cửa lùa" : "cửa đi bản lề";
    toast.success(`Đã thêm một ${label} mới! Hãy kéo thả cửa đến vị trí mong muốn.`);
  };

  const handleAddWindow = (style: string = "hinged") => {
    if (!floorPlan) {
      toast.error("Vui lòng tạo mặt bằng trước!");
      return;
    }
    pushHistory(floorPlan);
    const width = style === "sliding" ? 1.5 : 1.2;
    const newOpening: Opening = {
      id: `open_${activeFloorIndex}_${Date.now()}`,
      type: "window",
      x: 3.0,
      y: 3.0,
      w: width,
      rotation: 0,
      style
    };
    const updatedOpenings = [...(floorPlan.openings || []), newOpening];
    const updatedPlan = { ...floorPlan, openings: updatedOpenings };
    setFloorPlan(updatedPlan);
    const nextPlans = [...floorPlans];
    nextPlans[activeFloorIndex] = updatedPlan;
    setFloorPlans(nextPlans);
    setSelectedOpeningId(newOpening.id);
    const label = style === "blinds" ? "cửa sổ màn sáo" : style === "sliding" ? "cửa sổ lùa" : "cửa sổ bản lề";
    toast.success(`Đã thêm một ${label} mới! Hãy kéo thả cửa sổ đến vị trí mong muốn.`);
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
      const isSelected = selectedOpeningId === open.id;
      const strokeColor = isSelected ? "#00b5cd" : "#1e293b";
      const strokeWidth = isSelected ? 3 : 2;

      if (open.type === "door") {
        const isSliding = open.style === "sliding";
        const isGarage = open.style === "garage";
        const arcPoints = [];
        const segments = 12;
        for (let i = 0; i <= segments; i++) {
          const angle = (i * Math.PI) / (segments * 2);
          arcPoints.push(Math.cos(angle) * ow, -Math.sin(angle) * ow);
        }

        return (
          <Group
            key={open.id}
            x={ox}
            y={oy}
            rotation={open.rotation}
            draggable={true}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const newX = (e.target.x() - pan.x) / scale;
              const newY = (e.target.y() - pan.y) / scale;
              const roundedX = Math.round(newX * 20) / 20; // 0.05m
              const roundedY = Math.round(newY * 20) / 20;
              e.target.x(pan.x + roundedX * scale);
              e.target.y(pan.y + roundedY * scale);
            }}
            onClick={(e) => {
              e.cancelBubble = true;
              setSelectedOpeningId(open.id);
              setSelectedRoomId(null);
              setSelectedFurnitureId(null);
              setSelectedFurnitureRoomId(null);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              setSelectedOpeningId(open.id);
              setSelectedRoomId(null);
              setSelectedFurnitureId(null);
              setSelectedFurnitureRoomId(null);
            }}
            onDblClick={(e) => {
              e.cancelBubble = true;
              rotateOpening(open.id);
            }}
            onDblTap={(e) => {
              e.cancelBubble = true;
              rotateOpening(open.id);
            }}
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage && activeTool !== "draw_wall") stage.container().style.cursor = "move";
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = activeTool === "draw_wall" ? PEN_CURSOR : "default";
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const newX = (e.target.x() - pan.x) / scale;
              const newY = (e.target.y() - pan.y) / scale;
              const roundedX = Math.round(newX * 20) / 20; // snap to 0.05m
              const roundedY = Math.round(newY * 20) / 20;

              if (floorPlan) {
                pushHistory(floorPlan);
                const updatedOpenings = floorPlan.openings.map((o) => {
                  if (o.id === open.id) {
                    return { ...o, x: roundedX, y: roundedY };
                  }
                  return o;
                });
                const updatedPlan = { ...floorPlan, openings: updatedOpenings };
                setFloorPlan(updatedPlan);
                const nextPlans = [...floorPlans];
                nextPlans[activeFloorIndex] = updatedPlan;
                setFloorPlans(nextPlans);
                toast.success(`Đã di chuyển cửa đến (${roundedX}m, ${roundedY}m)`);
              }
            }}
          >
            {isSliding ? (
              <>
                {/* Invisible hit area */}
                <Rect x={-ow / 2} y={-thickness / 2} width={ow} height={thickness} fill="transparent" />
                {/* Sliding door track frame */}
                <Rect x={-ow / 2} y={-thickness / 2} width={ow} height={thickness} stroke={strokeColor} strokeWidth={1} />
                {/* Panel 1 */}
                <Rect x={-ow / 2 + 2} y={-thickness / 4} width={ow / 2 - 1} height={thickness / 2} fill="#e2e8f0" stroke={strokeColor} strokeWidth={strokeWidth} />
                {/* Panel 2 */}
                <Rect x={0} y={0} width={ow / 2 - 2} height={thickness / 2} fill="#e2e8f0" stroke={strokeColor} strokeWidth={strokeWidth} />
              </>
            ) : isGarage ? (
              <>
                {/* Invisible hit area */}
                <Rect x={-ow / 2} y={-thickness / 2} width={ow} height={thickness} fill="transparent" />
                {/* Garage door boundary */}
                <Rect x={-ow / 2} y={-thickness / 2} width={ow} height={thickness} fill="#f1f5f9" stroke={strokeColor} strokeWidth={strokeWidth} />
                {/* Grooves for garage door */}
                <Line points={[-ow / 2, -thickness * 0.2, ow / 2, -thickness * 0.2]} stroke="#475569" strokeWidth={1} />
                <Line points={[-ow / 2, 0, ow / 2, 0]} stroke="#475569" strokeWidth={1} />
                <Line points={[-ow / 2, thickness * 0.2, ow / 2, thickness * 0.2]} stroke="#475569" strokeWidth={1} />
              </>
            ) : (
              <>
                {/* Invisible large hit area to make dragging easy */}
                <Rect x={0} y={-ow} width={ow} height={ow} fill="transparent" />
                <Line points={arcPoints} stroke={strokeColor} strokeWidth={isSelected ? 1.5 : 1} dash={[3, 3]} />
                <Line points={[0, 0, 0, -ow]} stroke={strokeColor} strokeWidth={strokeWidth} />
              </>
            )}
            {/* Indication circle at pivot point when selected */}
            {isSelected && (
              <Circle
                x={0}
                y={0}
                radius={6}
                fill="#00b5cd"
                stroke="white"
                strokeWidth={1.5}
              />
            )}
          </Group>
        );
      } else {
        return (
          <Group
            key={open.id}
            x={ox}
            y={oy}
            rotation={open.rotation}
            draggable={true}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const newX = (e.target.x() - pan.x) / scale;
              const newY = (e.target.y() - pan.y) / scale;
              const roundedX = Math.round(newX * 20) / 20; // 0.05m
              const roundedY = Math.round(newY * 20) / 20;
              e.target.x(pan.x + roundedX * scale);
              e.target.y(pan.y + roundedY * scale);
            }}
            onClick={(e) => {
              e.cancelBubble = true;
              setSelectedOpeningId(open.id);
              setSelectedRoomId(null);
              setSelectedFurnitureId(null);
              setSelectedFurnitureRoomId(null);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              setSelectedOpeningId(open.id);
              setSelectedRoomId(null);
              setSelectedFurnitureId(null);
              setSelectedFurnitureRoomId(null);
            }}
            onDblClick={(e) => {
              e.cancelBubble = true;
              rotateOpening(open.id);
            }}
            onDblTap={(e) => {
              e.cancelBubble = true;
              rotateOpening(open.id);
            }}
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage && activeTool !== "draw_wall") stage.container().style.cursor = "move";
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = activeTool === "draw_wall" ? PEN_CURSOR : "default";
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const newX = (e.target.x() - pan.x) / scale;
              const newY = (e.target.y() - pan.y) / scale;
              const roundedX = Math.round(newX * 20) / 20; // snap to 0.05m
              const roundedY = Math.round(newY * 20) / 20;

              if (floorPlan) {
                pushHistory(floorPlan);
                const updatedOpenings = floorPlan.openings.map((o) => {
                  if (o.id === open.id) {
                    return { ...o, x: roundedX, y: roundedY };
                  }
                  return o;
                });
                const updatedPlan = { ...floorPlan, openings: updatedOpenings };
                setFloorPlan(updatedPlan);
                const nextPlans = [...floorPlans];
                nextPlans[activeFloorIndex] = updatedPlan;
                setFloorPlans(nextPlans);
                toast.success(`Đã di chuyển cửa sổ đến (${roundedX}m, ${roundedY}m)`);
              }
            }}
          >
            {/* Invisible large hit area to make dragging easy */}
            <Rect
              x={-ow / 2}
              y={-12}
              width={ow}
              height={24}
              fill="transparent"
            />
            <Rect
              x={-ow / 2}
              y={-thickness / 2}
              width={ow}
              height={thickness}
              fill="white"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              cornerRadius={1}
            />
            {open.style === "sliding" ? (
              <>
                {/* Two sliding panes */}
                <Line points={[-ow / 2 + 2, -thickness / 4, 2, -thickness / 4]} stroke={strokeColor} strokeWidth={1} />
                <Line points={[-2, thickness / 4, ow / 2 - 2, thickness / 4]} stroke={strokeColor} strokeWidth={1} />
              </>
            ) : open.style === "blinds" ? (
              <>
                {/* Blinds slats */}
                <Line points={[-ow / 2 + 4, -thickness / 4, -ow / 2 + 6, thickness / 4]} stroke="#64748b" strokeWidth={1} />
                <Line points={[-ow / 4, -thickness / 4, -ow / 4 + 2, thickness / 4]} stroke="#64748b" strokeWidth={1} />
                <Line points={[0, -thickness / 4, 2, thickness / 4]} stroke="#64748b" strokeWidth={1} />
                <Line points={[ow / 4, -thickness / 4, ow / 4 + 2, thickness / 4]} stroke="#64748b" strokeWidth={1} />
                <Line points={[ow / 2 - 6, -thickness / 4, ow / 2 - 4, thickness / 4]} stroke="#64748b" strokeWidth={1} />
              </>
            ) : (
              // Hinged / default window
              <Line
                points={[-ow / 2, 0, ow / 2, 0]}
                stroke={isSelected ? "#00b5cd" : "#94a3b8"}
                strokeWidth={isSelected ? 1.5 : 1}
              />
            )}
            {/* Indication circle at pivot point when selected */}
            {isSelected && (
              <Circle
                x={0}
                y={0}
                radius={6}
                fill="#00b5cd"
                stroke="white"
                strokeWidth={1.5}
              />
            )}
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
            setSelectedOpeningId(null);
          }}
          onTap={() => {
            setSelectedRoomId(isSelected ? null : room.id);
            setSelectedFurnitureId(null);
            setSelectedFurnitureRoomId(null);
            setSelectedOpeningId(null);
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


          {/* Wall Resize Draggable Handles */}
          {isSelected && (
            <>
              {/* Left Wall Edge */}
              <Line
                x={isDragged ? dragOffset.x * scale : 0}
                y={0}
                points={[0, 0, 0, room.h * scale]}
                stroke="rgba(0,0,0,0.01)"
                strokeWidth={8}
                hitStrokeWidth={16}
                draggable={true}
                onMouseEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage && activeTool !== "draw_wall") stage.container().style.cursor = "ew-resize";
                  (e.target as any).stroke("#00b5cd");
                  e.target.getLayer()?.batchDraw();
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = activeTool === "draw_wall" ? PEN_CURSOR : "default";
                  (e.target as any).stroke("rgba(0,0,0,0.01)");
                  e.target.getLayer()?.batchDraw();
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  e.target.y(0); // keep y locked
                  const deltaX = e.target.x() / scale;
                  let proposedW = room.w - deltaX;
                  proposedW = Math.round(proposedW * 20) / 20; // snap to 0.05m
                  if (proposedW < 1.0) proposedW = 1.0;
                  const finalDeltaX = room.w - proposedW;
                  e.target.x(finalDeltaX * scale);
                  setDraggedRoomId(room.id);
                  setDragOffset({ x: finalDeltaX, y: 0, w: -finalDeltaX, h: 0 });
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  const newX = Math.round((room.x + dragOffset.x) * 20) / 20;
                  const newW = Math.round((room.w + dragOffset.w) * 20) / 20;
                  updateRoomSizeAndPosition(room.id, newX, room.y, newW, room.h);
                  setDraggedRoomId(null);
                  setDragOffset({ x: 0, y: 0, w: 0, h: 0 });
                  toast.success(`Đã cập nhật tường trái phòng ${room.name}`);
                }}
              />

              {/* Right Wall Edge */}
              <Line
                x={isDragged ? (room.w + dragOffset.w) * scale : room.w * scale}
                y={0}
                points={[0, 0, 0, room.h * scale]}
                stroke="rgba(0,0,0,0.01)"
                strokeWidth={8}
                hitStrokeWidth={16}
                draggable={true}
                onMouseEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage && activeTool !== "draw_wall") stage.container().style.cursor = "ew-resize";
                  (e.target as any).stroke("#00b5cd");
                  e.target.getLayer()?.batchDraw();
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = activeTool === "draw_wall" ? PEN_CURSOR : "default";
                  (e.target as any).stroke("rgba(0,0,0,0.01)");
                  e.target.getLayer()?.batchDraw();
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  e.target.y(0); // keep y locked
                  const dragX = e.target.x();
                  const deltaW = (dragX - room.w * scale) / scale;
                  let proposedW = room.w + deltaW;
                  proposedW = Math.round(proposedW * 20) / 20; // snap to 0.05m
                  if (proposedW < 1.0) proposedW = 1.0;
                  const finalDeltaW = proposedW - room.w;
                  e.target.x((room.w + finalDeltaW) * scale);
                  setDraggedRoomId(room.id);
                  setDragOffset({ x: 0, y: 0, w: finalDeltaW, h: 0 });
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  const newW = Math.round((room.w + dragOffset.w) * 20) / 20;
                  updateRoomSizeAndPosition(room.id, room.x, room.y, newW, room.h);
                  setDraggedRoomId(null);
                  setDragOffset({ x: 0, y: 0, w: 0, h: 0 });
                  toast.success(`Đã cập nhật tường phải phòng ${room.name}`);
                }}
              />

              {/* Top Wall Edge */}
              <Line
                x={0}
                y={isDragged ? dragOffset.y * scale : 0}
                points={[0, 0, room.w * scale, 0]}
                stroke="rgba(0,0,0,0.01)"
                strokeWidth={8}
                hitStrokeWidth={16}
                draggable={true}
                onMouseEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage && activeTool !== "draw_wall") stage.container().style.cursor = "ns-resize";
                  (e.target as any).stroke("#00b5cd");
                  e.target.getLayer()?.batchDraw();
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = activeTool === "draw_wall" ? PEN_CURSOR : "default";
                  (e.target as any).stroke("rgba(0,0,0,0.01)");
                  e.target.getLayer()?.batchDraw();
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  e.target.x(0); // keep x locked
                  const deltaY = e.target.y() / scale;
                  let proposedH = room.h - deltaY;
                  proposedH = Math.round(proposedH * 20) / 20; // snap to 0.05m
                  if (proposedH < 1.0) proposedH = 1.0;
                  const finalDeltaY = room.h - proposedH;
                  e.target.y(finalDeltaY * scale);
                  setDraggedRoomId(room.id);
                  setDragOffset({ x: 0, y: finalDeltaY, w: 0, h: -finalDeltaY });
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  const newY = Math.round((room.y + dragOffset.y) * 20) / 20;
                  const newH = Math.round((room.h + dragOffset.h) * 20) / 20;
                  updateRoomSizeAndPosition(room.id, room.x, newY, room.w, newH);
                  setDraggedRoomId(null);
                  setDragOffset({ x: 0, y: 0, w: 0, h: 0 });
                  toast.success(`Đã cập nhật tường trên phòng ${room.name}`);
                }}
              />

              {/* Bottom Wall Edge */}
              <Line
                x={0}
                y={isDragged ? (room.h + dragOffset.h) * scale : room.h * scale}
                points={[0, 0, room.w * scale, 0]}
                stroke="rgba(0,0,0,0.01)"
                strokeWidth={8}
                hitStrokeWidth={16}
                draggable={true}
                onMouseEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage && activeTool !== "draw_wall") stage.container().style.cursor = "ns-resize";
                  (e.target as any).stroke("#00b5cd");
                  e.target.getLayer()?.batchDraw();
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = activeTool === "draw_wall" ? PEN_CURSOR : "default";
                  (e.target as any).stroke("rgba(0,0,0,0.01)");
                  e.target.getLayer()?.batchDraw();
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  e.target.x(0); // keep x locked
                  const dragY = e.target.y();
                  const deltaH = (dragY - room.h * scale) / scale;
                  let proposedH = room.h + deltaH;
                  proposedH = Math.round(proposedH * 20) / 20; // snap to 0.05m
                  if (proposedH < 1.0) proposedH = 1.0;
                  const finalDeltaH = proposedH - room.h;
                  e.target.y((room.h + finalDeltaH) * scale);
                  setDraggedRoomId(room.id);
                  setDragOffset({ x: 0, y: 0, w: 0, h: finalDeltaH });
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  const newH = Math.round((room.h + dragOffset.h) * 20) / 20;
                  updateRoomSizeAndPosition(room.id, room.x, room.y, room.w, newH);
                  setDraggedRoomId(null);
                  setDragOffset({ x: 0, y: 0, w: 0, h: 0 });
                  toast.success(`Đã cập nhật tường dưới phòng ${room.name}`);
                }}
              />
            </>
          )}

          {showLabels && (
            <>
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
            </>
          )}
        </Group>

      );
    });
  };

  const renderKonvaFurniture = (plan: FloorPlanData) => {
    const scale = METER_TO_PX * zoom;

    return plan.rooms.flatMap((room) => {
      return (room.furniture || []).map((item) => {
        const iw = item.w * scale;
        const ih = item.h * scale;

        return (
          <Group
            key={item.id}
            x={pan.x + (room.x + item.x) * scale}
            y={pan.y + (room.y + item.y) * scale}
            rotation={item.rotation || 0}
            draggable={true}
            onClick={(e) => {
              e.cancelBubble = true;
              setSelectedRoomId(room.id);
              setSelectedFurnitureId(item.id);
              setSelectedFurnitureRoomId(room.id);
              setSelectedOpeningId(null);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              setSelectedRoomId(room.id);
              setSelectedFurnitureId(item.id);
              setSelectedFurnitureRoomId(room.id);
              setSelectedOpeningId(null);
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
              const absX = (e.target.x() - pan.x) / scale;
              const absY = (e.target.y() - pan.y) / scale;
              const roundedAbsX = Math.round(absX * 20) / 20; // snap to 0.05m
              const roundedAbsY = Math.round(absY * 20) / 20;
              e.target.x(pan.x + roundedAbsX * scale);
              e.target.y(pan.y + roundedAbsY * scale);
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              
              // Calculate absolute position on the floorplan in meters
              const absX = (e.target.x() - pan.x) / scale;
              const absY = (e.target.y() - pan.y) / scale;
              const roundedAbsX = Math.round(absX * 20) / 20; // snap to 0.05m
              const roundedAbsY = Math.round(absY * 20) / 20;

              // Bounding box of the furniture accounting for rotation
              const rot = item.rotation || 0;
              const isRotated = (rot % 180 !== 0);
              const currentW = isRotated ? item.h : item.w;
              const currentH = isRotated ? item.w : item.h;

              const fMinX = roundedAbsX - currentW / 2;
              const fMaxX = roundedAbsX + currentW / 2;
              const fMinY = roundedAbsY - currentH / 2;
              const fMaxY = roundedAbsY + currentH / 2;

               const tol = (wallThickness / 1000) / 2 + 0.01; // Dynamic padding based on wall thickness plus 1cm gap
              let isCrossingWall = false;
              let targetRoom = null;

              if (floorPlan) {
                for (const r of floorPlan.rooms) {
                  const overlaps = (
                    fMinX < r.x + r.w - tol &&
                    fMaxX > r.x + tol &&
                    fMinY < r.y + r.h - tol &&
                    fMaxY > r.y + tol
                  );
                  const fullyInside = (
                    fMinX >= r.x + tol &&
                    fMaxX <= r.x + r.w - tol &&
                    fMinY >= r.y + tol &&
                    fMaxY <= r.y + r.h - tol
                  );

                  if (overlaps && !fullyInside) {
                    isCrossingWall = true;
                    break;
                  }
                  if (fullyInside) {
                    targetRoom = r;
                  }
                }
              }

              if (floorPlan && !isCrossingWall) {
                pushHistory(floorPlan);

                const finalTargetRoomId = targetRoom ? targetRoom.id : room.id;

                const updatedRooms = floorPlan.rooms.map((r) => {
                  // Source room only (remove item if changing room)
                  if (r.id === room.id && r.id !== finalTargetRoomId) {
                    return {
                      ...r,
                      furniture: (r.furniture || []).filter((f) => f.id !== item.id)
                    };
                  }
                  // Target room only (add item at new relative offset)
                  if (r.id === finalTargetRoomId && r.id !== room.id) {
                    const newF = {
                      ...item,
                      x: roundedAbsX - r.x,
                      y: roundedAbsY - r.y
                    };
                    return {
                      ...r,
                      furniture: [...(r.furniture || []), newF]
                    };
                  }
                  // Same room move (either inside or outside the room, but associated with the same room)
                  if (r.id === room.id && r.id === finalTargetRoomId) {
                    const updated = (r.furniture || []).map((f) => {
                      if (f.id === item.id) {
                        return {
                          ...f,
                          x: roundedAbsX - r.x,
                          y: roundedAbsY - r.y
                        };
                      }
                      return f;
                    });
                    return { ...r, furniture: updated };
                  }
                  return r;
                });

                const updatedPlan = { ...floorPlan, rooms: updatedRooms };
                setFloorPlan(updatedPlan);
                const nextPlans = [...floorPlans];
                nextPlans[activeFloorIndex] = updatedPlan;
                setFloorPlans(nextPlans);

                setSelectedFurnitureRoomId(finalTargetRoomId);
                if (targetRoom) {
                  toast.success(`Đã di chuyển đồ vật vào phòng ${targetRoom.name}`);
                } else {
                  toast.success("Đã di chuyển đồ vật ra ngoài bản vẽ");
                }
              } else {
                // Reset position visually to original position relative to Stage
                e.target.x(pan.x + (room.x + item.x) * scale);
                e.target.y(pan.y + (room.y + item.y) * scale);
                e.target.getLayer()?.batchDraw();
                toast.error("Không thể đặt ở đây! Đồ vật không được đè lên tường.");
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
      });
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
            setSelectedOpeningId(null);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            setSelectedCameraRoomId(room.id);
            setSelectedRoomId(room.id);
            setSelectedOpeningId(null);
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
    const shape = gatherInfo.shape || "hình chữ nhật";
    const shapePoints = gatherInfo.shapePoints || getDefaultPointsForShape(shape, landW, landL);

    if (shapePoints && shapePoints.length > 0) {
      const points = shapePoints.flatMap(p => [
        pan.x + p.x * scale,
        pan.y + p.y * scale
      ]);
      return (
        <Line
          points={points}
          closed={true}
          stroke="#94a3b8"
          strokeWidth={1.5}
          dash={[6, 4]}
        />
      );
    }

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
      ? Array.from({ length: gatherInfo.floors }, (_, i) => `Tầng ${i + 1}`)
      : ["Tầng 1"];

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

  const selectedOpening = selectedOpeningId
    ? floorPlan?.openings?.find((o) => o.id === selectedOpeningId)
    : null;

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-[calc(100vh-64px)] bg-white text-slate-900 font-sans overflow-hidden">
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

          {/* Labels toggle */}
          {floorPlan && (
            <button
              onClick={() => setShowLabels(l => !l)}
              title={showLabels ? "Ẩn tên phòng và thông số" : "Hiện tên phòng và thông số"}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                showLabels ? "bg-[#00b5cd]/10 text-[#00b5cd] border border-[#00b5cd]/30" : "bg-slate-100 text-slate-400 hover:text-slate-700"
              }`}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
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
        {/* Sidebar Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={() => setActiveSidebarTab("chat")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeSidebarTab === "chat"
                ? "border-[#00b5cd] text-[#00b5cd] bg-slate-50/50"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/30"
            }`}
          >
            Trò chuyện AI
          </button>
          <button
            onClick={() => setActiveSidebarTab("history")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeSidebarTab === "history"
                ? "border-[#00b5cd] text-[#00b5cd] bg-slate-50/50"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/30"
            }`}
          >
            Lịch sử dự án
          </button>
        </div>

        {activeSidebarTab === "chat" ? (
          <>
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

                  // Special 2D floor plan auto-preview bubble
                  if (msg.role === "assistant" && msg.content.startsWith("__2D_PREVIEW__")) {
                    const previewDataUrl = msg.content.replace("__2D_PREVIEW__", "");
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="flex justify-start"
                      >
                        <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white shadow-sm border border-slate-100 overflow-hidden">
                          <div className="px-3.5 pt-2.5 pb-1.5 text-xs text-slate-500 font-medium flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-[#00b5cd]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
                            Bản vẽ 2D tự động tạo
                          </div>
                          <div className="px-2 pb-1">
                            <img
                              src={previewDataUrl}
                              alt="2D Floor Plan Preview"
                              className="w-full rounded-xl border border-slate-100 object-contain"
                              style={{ maxHeight: "180px" }}
                            />
                          </div>
                          <div className="px-3 pb-2.5">
                            <a
                              href={previewDataUrl}
                              download={`${projectName.replace(/\s+/g, "_")}_floorplan_2d.png`}
                              className="w-full mt-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all border border-slate-200"
                            >
                              <Download className="w-3 h-3" /> Tải bản vẽ 2D
                            </a>
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
                            ? "bg-[#00b5cd] text-white font-semibold rounded-br-md"
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
                        className="w-1.5 h-1.5 bg-[#00b5cd] rounded-full"
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
            <div className="p-3 border-t border-slate-200 bg-white shrink-0">
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
          </>
        ) : (
          <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
            {/* History List header */}
            <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Danh sách bản vẽ</span>
              <button
                onClick={handleNewProject}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#00b5cd] hover:bg-[#009db3] text-white text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Dự án mới
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300">
              {(() => {
                const displayProjects = projects.filter((p: any) => p.floorPlans && p.floorPlans.length > 0);
                const ITEMS_PER_PAGE = 5;
                const totalPages = Math.ceil(displayProjects.length / ITEMS_PER_PAGE);
                const currentPage = Math.max(1, Math.min(historyPage, totalPages || 1));
                const paginatedProjects = [...displayProjects]
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

                if (displayProjects.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 text-xs font-medium">
                      Chưa có dự án bản vẽ 2D nào được lưu.
                    </div>
                  );
                }

                return (
                  <>
                    {paginatedProjects.map((proj) => {
                      const isActive = currentProjectId === proj.id;
                      const isEditing = editingProjectId === proj.id;
                      const dateStr = new Date(proj.updatedAt).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      });
                      const floors = proj.gatherInfo?.floors || 0;
                      const area = proj.gatherInfo?.area || "Chưa xác định";

                      return (
                        <div
                          key={proj.id}
                          onClick={() => !isEditing && handleLoadProject(proj)}
                          className={`group p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isActive
                              ? "bg-[#00b5cd]/5 border-[#00b5cd] shadow-sm"
                              : "bg-white border-slate-200 hover:border-[#00b5cd]/50 hover:shadow-sm"
                          }`}
                        >
                          {isEditing ? (
                            <div className="flex-1 pr-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                autoFocus
                                value={editingProjectName}
                                onChange={(e) => setEditingProjectName(e.target.value)}
                                onBlur={() => handleSaveProjectName(proj.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveProjectName(proj.id);
                                  if (e.key === "Escape") setEditingProjectId(null);
                                }}
                                className="w-full bg-slate-100 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#00b5cd]"
                              />
                              <span className="text-[8px] text-slate-400 block mt-0.5 font-normal">Press Enter to save · Esc to cancel</span>
                            </div>
                          ) : (
                            <div className="space-y-1 min-w-0 flex-1 pr-2">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {proj.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold">
                                <span>{dateStr}</span>
                                <span>•</span>
                                <span>{floors > 0 ? `${floors} tầng` : "Chưa tạo"}</span>
                                <span>•</span>
                                <span>{area}</span>
                              </div>
                            </div>
                          )}

                          {!isEditing && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProjectId(proj.id);
                                  setEditingProjectName(proj.name);
                                }}
                                className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                                title="Đổi tên dự án"
                              >
                                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                              </button>
                              <button
                                onClick={(e) => handleDeleteProject(proj.id, e)}
                                className="w-7 h-7 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                                title="Xóa dự án"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="p-2.5 mt-2 border-t border-slate-200/60 bg-white/50 rounded-xl flex items-center justify-between text-xs text-slate-500 font-semibold select-none">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                          className="p-1 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-0.5 cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          Trước
                        </button>
                        <span>
                          Trang {currentPage} / {totalPages}
                        </span>
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                          className="p-1 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-0.5 cursor-pointer"
                        >
                          Sau
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── CANVAS AREA ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col pt-12 relative overflow-hidden">

        {/* Draw Wall status banner */}
        {activeTool === "draw_wall" && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3 bg-[#1e293b]/95 backdrop-blur text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl border border-white/10">
              <div className="w-2 h-2 rounded-full bg-[#00b5cd] animate-pulse flex-shrink-0" />
              <span>
                {drawingPoints.length === 0
                  ? "Click để đặt điểm tường đầu tiên"
                  : drawingPoints.length < 3
                  ? `${drawingPoints.length} điểm — Tiếp tục click để vẽ tường`
                  : `${drawingPoints.length} điểm — Click vào điểm đầu hoặc double-click để đóng phòng`}
              </span>
              <div className="flex items-center gap-1.5 ml-1 border-l border-white/20 pl-3">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono">Esc</kbd>
                <span className="text-white/50 text-[10px]">hủy</span>
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono ml-1">⌫</kbd>
                <span className="text-white/50 text-[10px]">xóa điểm</span>
              </div>
            </div>
          </div>
        )}

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
          style={{
            cursor:
              activeTool === "draw_wall"
                ? "crosshair"
                : isPanning
                ? "grabbing"
                : "default",
            background: "white",
          }}
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
                  {renderKonvaFurniture(floorPlan)}
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

            {/* Draw Wall preview layer */}
            <Layer listening={false}>
              {renderDrawWallPreview()}
            </Layer>
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
          <div className="absolute bottom-6 right-6 flex flex-col gap-1.5 items-center z-10">
            <span className="text-[10px] text-slate-500 font-mono bg-white/90 border border-slate-200 shadow-sm rounded px-1.5 py-0.5 select-none mb-1">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(4, z * 1.2))}
              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors shadow-sm cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))}
              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors shadow-sm cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setZoom(1); setPan({ x: 60, y: 60 }); }}
              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors shadow-sm cursor-pointer"
              title="Fit to screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Floating Toolbar (Maket.ai style) */}
          {floorPlan && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
              
              {/* Furniture Popover */}
              {activeBottomPopup === "furniture" && (
                <div className="mb-3 w-[420px] bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 flex flex-col gap-2.5 max-h-[380px] animate-in fade-in slide-in-from-bottom-2 duration-150">
                  {/* Search Bar */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Tìm kiếm nội thất..."
                      value={furnitureSearch}
                      onChange={(e) => setFurnitureSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-[#00b5cd]/50 transition-colors"
                    />
                    {furnitureSearch && (
                      <button
                        onClick={() => setFurnitureSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Search Mode vs Two-Column Mode */}
                  {furnitureSearch ? (
                    <div className="overflow-y-auto pr-1 flex-1 space-y-1 max-h-[280px]">
                      {(() => {
                        const query = furnitureSearch.toLowerCase();
                        const matchedItems: { type: string; name: string; catIdx: number; itemIdx: number; subItems?: any[]; w?: number; h?: number; style?: string }[] = [];
                        FURNITURE_CATEGORIES.forEach((cat, catIdx) => {
                          cat.items.forEach((item, itemIdx) => {
                            if (item.name.toLowerCase().includes(query)) {
                              matchedItems.push({ ...item, catIdx, itemIdx });
                            }
                          });
                        });

                        if (matchedItems.length === 0) {
                          return <div className="text-center py-4 text-xs text-slate-400">Không tìm thấy kết quả</div>;
                        }

                        return matchedItems.map((item) => (
                          <button
                            key={item.type}
                            onClick={() => {
                              if (item.subItems) {
                                setSelectedCategoryIndex(item.catIdx);
                                setSelectedItemIndex(item.itemIdx);
                                setFurnitureSearch("");
                              } else {
                                handleAddFurniture(item.type, item.w, item.h, item.style);
                                setActiveBottomPopup(null);
                                setFurnitureSearch("");
                              }
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-100 transition-all flex items-center justify-between cursor-pointer"
                          >
                            <span>{item.name}</span>
                            {item.subItems ? (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-[#00b5cd]" />
                            )}
                          </button>
                        ));
                      })()}
                    </div>
                  ) : (
                    <div className="flex flex-1 min-h-0 divide-x divide-slate-100 overflow-hidden">
                      {/* Left Sidebar: Categories list */}
                      <div className="w-[155px] pr-1.5 overflow-y-auto space-y-0.5 max-h-[280px]">
                        {FURNITURE_CATEGORIES.map((cat, idx) => {
                          const isSelected = selectedCategoryIndex === idx;
                          // Category icon helper
                          const getCategoryIcon = (name: string) => {
                            const n = name.toLowerCase();
                            if (n.includes("tắm")) return <Bath className="w-3.5 h-3.5" />;
                            if (n.includes("ngủ")) return <Bed className="w-3.5 h-3.5" />;
                            if (n.includes("vào") || n.includes("giặt")) return <WashingMachine className="w-3.5 h-3.5" />;
                            if (n.includes("xe") || n.includes("kho")) return <Car className="w-3.5 h-3.5" />;
                            if (n.includes("gym")) return <Dumbbell className="w-3.5 h-3.5" />;
                            if (n.includes("bếp") || n.includes("ăn")) return <Utensils className="w-3.5 h-3.5" />;
                            if (n.includes("khách")) return <Sofa className="w-3.5 h-3.5" />;
                            if (n.includes("việc")) return <Briefcase className="w-3.5 h-3.5" />;
                            if (n.includes("trời")) return <Trees className="w-3.5 h-3.5" />;
                            if (n.includes("giải")) return <Gamepad className="w-3.5 h-3.5" />;
                            return <Plus className="w-3.5 h-3.5" />;
                          };

                          return (
                            <button
                              key={cat.name}
                              onMouseEnter={() => {
                                setSelectedCategoryIndex(idx);
                                setSelectedItemIndex(null);
                              }}
                              onClick={() => {
                                setSelectedCategoryIndex(idx);
                                setSelectedItemIndex(null);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                isSelected
                                  ? "bg-slate-100 text-[#00b5cd]"
                                  : "text-slate-600 hover:bg-slate-50/80 hover:text-slate-800"
                              }`}
                            >
                              {getCategoryIcon(cat.name)}
                              <span className="truncate">{cat.name}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Right Panel: Items in Category */}
                      <div className="flex-1 pl-2.5 overflow-y-auto max-h-[280px]">
                        {selectedCategoryIndex !== null && (
                          selectedItemIndex === null ? (
                            <div className="space-y-0.5">
                              {FURNITURE_CATEGORIES[selectedCategoryIndex].items.map((item, itemIdx) => (
                                <button
                                  key={itemIdx}
                                  onClick={() => {
                                    if (item.subItems) {
                                      setSelectedItemIndex(itemIdx);
                                    } else {
                                      handleAddFurniture(item.type, (item as any).w, (item as any).h, (item as any).style);
                                      setActiveBottomPopup(null);
                                    }
                                  }}
                                  className="w-full text-left px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-all flex items-center justify-between cursor-pointer"
                                >
                                  <span className="truncate pr-1">{item.name}</span>
                                  {item.subItems ? (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5 text-[#00b5cd] flex-shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : (
                            // Sub-items List (Variations)
                            <div className="space-y-0.5">
                              <button
                                onClick={() => setSelectedItemIndex(null)}
                                className="w-full flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#00b5cd] hover:bg-slate-50 rounded-md transition-colors cursor-pointer mb-1.5"
                              >
                                <ChevronLeft className="w-3 h-3" />
                                QUAY LẠI
                              </button>
                              {FURNITURE_CATEGORIES[selectedCategoryIndex].items[selectedItemIndex].subItems?.map((sub, subIdx) => (
                                <button
                                  key={subIdx}
                                  onClick={() => {
                                    handleAddFurniture(sub.type, sub.w, sub.h, sub.style);
                                    setActiveBottomPopup(null);
                                  }}
                                  className="w-full text-left px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-all flex items-center justify-between cursor-pointer"
                                >
                                  <span className="truncate pr-1">{sub.name}</span>
                                  <Plus className="w-3.5 h-3.5 text-[#00b5cd] flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Structure Popover */}
              {activeBottomPopup === "structure" && (
                <div className="mb-3 flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  {/* Left panel: main options */}
                  <div className="w-48 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 flex flex-col gap-1">
                    <button
                      onMouseEnter={() => setActiveStructureCategory("door")}
                      onClick={() => setActiveStructureCategory("door")}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl border border-transparent transition-all flex items-center justify-between cursor-pointer ${
                        activeStructureCategory === "door"
                          ? "bg-slate-50 border-slate-100 text-[#00b5cd]"
                          : "text-slate-700 hover:bg-slate-50 hover:border-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.5 12H3"/>
                        </svg>
                        <span>Door</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    <button
                      onMouseEnter={() => setActiveStructureCategory("stairs")}
                      onClick={() => setActiveStructureCategory("stairs")}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl border border-transparent transition-all flex items-center justify-between cursor-pointer ${
                        activeStructureCategory === "stairs"
                          ? "bg-slate-50 border-slate-100 text-[#00b5cd]"
                          : "text-slate-700 hover:bg-slate-50 hover:border-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                          <path d="M3 21h18M3 21v-4h4v-4h4v-4h4v-4h4V3" />
                        </svg>
                        <span>Stairs</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    <button
                      onMouseEnter={() => setActiveStructureCategory("window")}
                      onClick={() => setActiveStructureCategory("window")}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl border border-transparent transition-all flex items-center justify-between cursor-pointer ${
                        activeStructureCategory === "window"
                          ? "bg-slate-50 border-slate-100 text-[#00b5cd]"
                          : "text-slate-700 hover:bg-slate-50 hover:border-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" className="text-slate-500">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                          <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="2"/>
                          <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="2"/>
                          <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        <span>Window</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>

                  {/* Right panel: submenu */}
                  {activeStructureCategory && (
                    <div className="w-56 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100 justify-center">
                      {activeStructureCategory === "door" && (
                        <>
                          <button
                            onClick={() => {
                              handleAddDoor("garage");
                              setActiveBottomPopup(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer hover:text-[#00b5cd]"
                          >
                            Garage Door
                          </button>
                          <button
                            onClick={() => {
                              handleAddDoor("hinged");
                              setActiveBottomPopup(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer hover:text-[#00b5cd]"
                          >
                            Hinged Door
                          </button>
                          <button
                            onClick={() => {
                              handleAddDoor("sliding");
                              setActiveBottomPopup(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer hover:text-[#00b5cd]"
                          >
                            Sliding Door
                          </button>
                        </>
                      )}

                      {activeStructureCategory === "stairs" && (
                        <>
                          <button
                            onClick={() => {
                              handleAddFurniture("stairs", undefined, undefined, "l_shaped_landing");
                              setActiveBottomPopup(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer hover:text-[#00b5cd]"
                          >
                            L-shaped staircase (landing)
                          </button>
                          <button
                            onClick={() => {
                              handleAddFurniture("stairs", undefined, undefined, "l_shaped_winder");
                              setActiveBottomPopup(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer hover:text-[#00b5cd]"
                          >
                            L-shaped staircase (winder)
                          </button>
                          <button
                            onClick={() => {
                              handleAddFurniture("stairs", undefined, undefined, "straight");
                              setActiveBottomPopup(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer hover:text-[#00b5cd]"
                          >
                            Straight staircase
                          </button>
                          <button
                            onClick={() => {
                              handleAddFurniture("stairs", undefined, undefined, "u_shaped");
                              setActiveBottomPopup(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer hover:text-[#00b5cd]"
                          >
                            U-shaped staircase
                          </button>
                        </>
                      )}

                      {activeStructureCategory === "window" && (
                        <>
                          <button
                            onClick={() => {
                              handleAddWindow("blinds");
                              setActiveBottomPopup(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer hover:text-[#00b5cd]"
                          >
                            Blinds Window
                          </button>
                          <button
                            onClick={() => {
                              handleAddWindow("hinged");
                              setActiveBottomPopup(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer hover:text-[#00b5cd]"
                          >
                            Hinged Window
                          </button>
                          <button
                            onClick={() => {
                              handleAddWindow("sliding");
                              setActiveBottomPopup(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer hover:text-[#00b5cd]"
                          >
                            Sliding Window
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Toolbar bar */}
              <div className="flex items-center bg-white border border-slate-200 shadow-xl rounded-2xl p-1 gap-1.5">
                <button
                  onClick={() => {
                    setActiveBottomPopup(p => {
                      const next = p === "furniture" ? null : "furniture";
                      if (next === "furniture") {
                        setSelectedCategoryIndex(0);
                        setSelectedItemIndex(null);
                      }
                      return next;
                    });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeBottomPopup === "furniture"
                      ? "bg-[#00b5cd]/10 text-[#00b5cd] border border-[#00b5cd]/30"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13h18M3 7h18M3 19h18M7 3v4M17 3v4"/></svg>
                  <span>Nội thất</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${activeBottomPopup === "furniture" ? "rotate-180" : ""}`} />
                </button>

                <button
                  onClick={() => {
                    setActiveBottomPopup(p => p === "structure" ? null : "structure");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeBottomPopup === "structure"
                      ? "bg-[#00b5cd]/10 text-[#00b5cd] border border-[#00b5cd]/30"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                  <span>Kết cấu</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${activeBottomPopup === "structure" ? "rotate-180" : ""}`} />
                </button>

                <div className="w-px h-5 bg-slate-200" />

                <button
                  onClick={() => {
                    setActiveTool("select");
                    setActiveBottomPopup(null);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTool === "select"
                      ? "bg-slate-900 text-white shadow-sm border border-slate-900"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 3 10.07 19.97 12.58 12.58 19.97 10.07 3 3"/><line x1="13" y1="13" x2="21" y2="21"/></svg>
                  <span>Chọn</span>
                </button>

                <button
                  onClick={() => {
                    if (activeTool === "draw_wall") {
                      // Toggle off: cancel drawing
                      setActiveTool("select");
                      setDrawingPoints([]);
                      setDrawMousePos(null);
                    } else {
                      setActiveTool("draw_wall");
                      setActiveBottomPopup(null);
                      setDrawingPoints([]);
                      setDrawMousePos(null);
                      toast.info("Click để đặt điểm tường. Double-click hoặc click vào điểm đầu để đóng phòng.");
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTool === "draw_wall"
                      ? "bg-[#00b5cd] text-white shadow-sm border border-[#00b5cd]"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3h18v4H3zM3 10h8v4H3zM3 17h12v4H3z"/>
                  </svg>
                  <span>Vẽ tường</span>
                </button>
              </div>

            </div>
          )}
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
        <div className="w-[380px] flex-shrink-0 flex flex-col bg-slate-50 border-l border-slate-200 pt-12 z-20 text-slate-800 font-sans overflow-y-auto">
          {activeTab === "visualize" ? (() => {
            const selectedCam = selectedCameraRoomId ? cameras[selectedCameraRoomId] : null;
            const targetRoomName = selectedCameraRoomId && floorPlan
              ? floorPlan.rooms.find(r => r.id === selectedCameraRoomId)?.name || "Kitchen"
              : "Room Camera";

            return (
              <div className="p-6 space-y-6">
                {/* 3D Camera Preview Box */}
                <div className="relative w-full aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex flex-col items-center justify-center text-slate-400 group shadow-inner">
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
                        {renderProgress > 0 && (
                          <span className="text-xs font-bold text-[#00b5cd] mt-1">{renderProgress}%</span>
                        )}
                        {renderStatusMessage && (
                          <span className="text-[9px] text-slate-400 mt-1 max-w-[180px] truncate">{renderStatusMessage}</span>
                        )}
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

                    {/* Render Mode */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-700 block">Chế độ render</span>
                      <div className="relative">
                        <select
                          value={renderMode}
                          onChange={(e) => setRenderMode(e.target.value as "Floorplan to 3D" | "Floorplan to 3D Floorplan")}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#00b5cd]/50 cursor-pointer appearance-none pr-8"
                        >
                          <option value="Floorplan to 3D">Floorplan to 3D</option>
                          <option value="Floorplan to 3D Floorplan">Floorplan to 3D Floorplan</option>
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
              })() : selectedOpening ? (() => {
                const open = selectedOpening;
                return (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedOpeningId(null);
                            }}
                            className="text-slate-500 hover:text-slate-800 cursor-pointer mr-1 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          {open.type === "door" ? "Cửa đi" : "Cửa sổ"}
                        </h3>
                        <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                          Bộ chỉnh sửa cửa
                        </span>
                      </div>
                    </div>

                    {/* Type toggle */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Loại cửa</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateOpeningProperty(open.id, { type: "door" })}
                          className={`px-3 py-2 text-center rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                            open.type === "door"
                              ? "border-[#00b5cd] bg-[#00b5cd]/5 text-[#00b5cd]"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          Cửa đi
                        </button>
                        <button
                          onClick={() => updateOpeningProperty(open.id, { type: "window" })}
                          className={`px-3 py-2 text-center rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                            open.type === "window"
                              ? "border-[#00b5cd] bg-[#00b5cd]/5 text-[#00b5cd]"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          Cửa sổ
                        </button>
                      </div>
                    </div>

                    {/* Dimensions */}
                    <div className="space-y-4">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Kích thước (m)</span>
                      
                      {/* Width Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600 font-medium">Chiều rộng (ngang)</span>
                          <span className="font-semibold text-slate-800">{open.w.toFixed(2)} m</span>
                        </div>
                        <input
                          type="range"
                          min="0.4"
                          max="3.0"
                          step="0.05"
                          value={open.w}
                          onChange={(e) => {
                            const w = parseFloat(e.target.value);
                            updateOpeningProperty(open.id, { w });
                          }}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#00b5cd]"
                        />
                      </div>

                      {/* Rotation Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600 font-medium">Góc xoay</span>
                          <span className="font-semibold text-slate-800">{(open.rotation || 0)}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="315"
                          step="45"
                          value={open.rotation || 0}
                          onChange={(e) => {
                            const rotation = parseInt(e.target.value);
                            updateOpeningProperty(open.id, { rotation });
                          }}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#00b5cd]"
                        />
                      </div>
                    </div>

                    {/* Remove opening button */}
                    <div className="pt-4 border-t border-slate-200">
                      <button
                        onClick={() => deleteOpening(open.id)}
                        className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-2xl transition-all cursor-pointer text-xs text-center flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4 text-slate-400" />
                        Xóa cửa / cửa sổ
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
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 1 0 10 10"/></svg>
                        <span>Style</span>
                      </div>
                      {selectedRoom.style ? (
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                          <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-200">
                            {ROOM_STYLES.find(s => s.value === selectedRoom.style)?.image ? (
                              <img src={ROOM_STYLES.find(s => s.value === selectedRoom.style)?.image} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full" style={{ backgroundColor: ROOM_STYLES.find(s => s.value === selectedRoom.style)?.color || "#e2e8f0" }} />
                            )}
                          </div>
                          <span className="text-[11px] font-bold">{selectedRoom.style}</span>
                        </div>
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                      )}
                    </button>

                    {/* Flooring */}
                    <button
                      onClick={() => {
                        setActiveFinishTarget({ type: "flooring", roomId: selectedRoom.id });
                      }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
                        <span>Flooring</span>
                      </div>
                      {selectedRoom.finishes?.flooring ? (() => {
                        const matched = ROOM_FLOORINGS.find(f => f.value === selectedRoom.finishes?.flooring);
                        return (
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                            <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-100">
                              {matched?.image ? (
                                <img src={matched.image} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full" style={{ backgroundColor: matched?.color || "#e2e8f0" }} />
                              )}
                            </div>
                            <span className="text-[11px] font-bold">{matched?.name || selectedRoom.finishes.flooring}</span>
                          </div>
                        );
                      })() : (
                        <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                      )}
                    </button>

                    {/* Walls */}
                    <button
                      onClick={() => {
                        setActiveFinishTarget({ type: "walls", roomId: selectedRoom.id });
                      }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6h6"/></svg>
                        <span>Walls</span>
                      </div>
                      {selectedRoom.finishes?.walls ? (() => {
                        const matched = ROOM_WALLS.find(w => w.value === selectedRoom.finishes?.walls);
                        return (
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                            <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-100">
                              {matched?.image ? (
                                <img src={matched.image} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full" style={{ backgroundColor: matched?.color || "#ffffff" }} />
                              )}
                            </div>
                            <span className="text-[11px] font-bold">{matched?.name || selectedRoom.finishes.walls}</span>
                          </div>
                        );
                      })() : (
                        <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                      )}
                    </button>

                    {/* Ceiling */}
                    <button
                      onClick={() => {
                        setActiveFinishTarget({ type: "ceiling", roomId: selectedRoom.id });
                      }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><path d="M3 21h18M3 21v-4h4v-4h4v-4h4v-4h4V3"/></svg>
                        <span>Ceiling</span>
                      </div>
                      {selectedRoom.finishes?.ceiling ? (() => {
                        const matched = ROOM_CEILINGS.find(c => c.value === selectedRoom.finishes?.ceiling);
                        return (
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                            <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-100">
                              {matched?.image ? (
                                <img src={matched.image} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full" style={{ backgroundColor: matched?.color || "#ffffff" }} />
                              )}
                            </div>
                            <span className="text-[11px] font-bold">{matched?.name || selectedRoom.finishes.ceiling}</span>
                          </div>
                        );
                      })() : (
                        <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                      )}
                    </button>

                    {/* Doors */}
                    <button
                      onClick={() => {
                        setActiveFinishTarget({ type: "doors", roomId: selectedRoom.id });
                      }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5 M13.5 12H3"/></svg>
                        <span>Doors</span>
                      </div>
                      {selectedRoom.finishes?.doors ? (() => {
                        const matched = ROOM_DOORS.find(d => d.value === selectedRoom.finishes?.doors);
                        return (
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                            <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-100">
                              {matched?.image ? (
                                <img src={matched.image} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full" style={{ backgroundColor: matched?.color || "#ffffff" }} />
                              )}
                            </div>
                            <span className="text-[11px] font-bold">{matched?.name || selectedRoom.finishes.doors}</span>
                          </div>
                        );
                      })() : (
                        <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                      )}
                    </button>

                    {/* Windows */}
                    <button
                      onClick={() => {
                        setActiveFinishTarget({ type: "windows", roomId: selectedRoom.id });
                      }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>
                        <span>Windows</span>
                      </div>
                      {selectedRoom.finishes?.windows ? (() => {
                        const matched = ROOM_WINDOWS.find(w => w.value === selectedRoom.finishes?.windows);
                        return (
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                            <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-100">
                              {matched?.image ? (
                                <img src={matched.image} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full" style={{ backgroundColor: matched?.color || "#ffffff" }} />
                              )}
                            </div>
                            <span className="text-[11px] font-bold">{matched?.name || selectedRoom.finishes.windows}</span>
                          </div>
                        );
                      })() : (
                        <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                      )}
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
                          setSelectedOpeningId(null);
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
                            {`Tầng ${activeFloorIndex + 1}`}
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
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Design References</span>
                        <button
                          onClick={() => {
                            const defaultFinishes = {
                              flooring: { type: "material" as const, value: "natural_oak", name: "Natural Oak" },
                              walls: { type: "color" as const, value: "#ffffff", name: "White" },
                              ceiling: { type: "color" as const, value: "#ffffff", name: "White" },
                              doors: { type: "material" as const, value: "natural_oak", name: "Natural Oak" },
                              windows: { type: "color" as const, value: "#1c1c1e", name: "Dark" },
                            };
                            setFinishes(defaultFinishes);
                            setSelectedStyle("");
                            // Reset finishes cho toàn bộ phòng
                            if (floorPlan) {
                              pushHistory(floorPlan);
                              const updatedRooms = floorPlan.rooms.map((r) => ({
                                ...r,
                                style: undefined,
                                finishes: {
                                  flooring: defaultFinishes.flooring.value,
                                  walls: defaultFinishes.walls.value,
                                  ceiling: defaultFinishes.ceiling.value,
                                  doors: defaultFinishes.doors.value,
                                  windows: defaultFinishes.windows.value,
                                },
                              }));
                              const updatedPlan = { ...floorPlan, rooms: updatedRooms };
                              setFloorPlan(updatedPlan);
                              const nextPlans = [...floorPlans];
                              nextPlans[activeFloorIndex] = updatedPlan;
                              setFloorPlans(nextPlans);
                            }
                            toast.success("Đã reset vật liệu toàn bộ bản vẽ");
                          }}
                          className="text-[10px] text-[#00b5cd] hover:underline font-semibold cursor-pointer"
                        >
                          Reset all
                        </button>
                      </div>

                      {/* Style */}
                      <button
                        onClick={() => setShowStyleModal(true)}
                        className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 1 0 10 10"/></svg>
                          <span>Style</span>
                        </div>
                        {selectedStyle ? (
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                            <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-200">
                              {ROOM_STYLES.find(s => s.value === selectedStyle)?.image ? (
                                <img src={ROOM_STYLES.find(s => s.value === selectedStyle)?.image} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full" style={{ backgroundColor: ROOM_STYLES.find(s => s.value === selectedStyle)?.color || "#e2e8f0" }} />
                              )}
                            </div>
                            <span className="text-[11px] font-bold">{selectedStyle}</span>
                          </div>
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                        )}
                      </button>

                      {/* Flooring */}
                      <button
                        onClick={() => setShowFinishModal("flooring")}
                        className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
                          <span>Flooring</span>
                        </div>
                        {finishes.flooring.value ? (() => {
                          const matched = ROOM_FLOORINGS.find(f => f.value === finishes.flooring.value);
                          return (
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                              <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-100">
                                {matched?.image ? (
                                  <img src={matched.image} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full" style={{ backgroundColor: matched?.color || finishes.flooring.value }} />
                                )}
                              </div>
                              <span className="text-[11px] font-bold">{matched?.name || finishes.flooring.name}</span>
                            </div>
                          );
                        })() : (
                          <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                        )}
                      </button>

                      {/* Walls */}
                      <button
                        onClick={() => setShowFinishModal("walls")}
                        className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6h6"/></svg>
                          <span>Walls</span>
                        </div>
                        {finishes.walls.value ? (() => {
                          const matched = ROOM_WALLS.find(w => w.value === finishes.walls.value);
                          return (
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                              <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-100">
                                {matched?.image ? (
                                  <img src={matched.image} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full" style={{ backgroundColor: matched?.color || finishes.walls.value }} />
                                )}
                              </div>
                              <span className="text-[11px] font-bold">{matched?.name || finishes.walls.name}</span>
                            </div>
                          );
                        })() : (
                          <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                        )}
                      </button>

                      {/* Ceiling */}
                      <button
                        onClick={() => setShowFinishModal("ceiling")}
                        className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><path d="M3 21h18M3 21v-4h4v-4h4v-4h4v-4h4V3"/></svg>
                          <span>Ceiling</span>
                        </div>
                        {finishes.ceiling.value ? (() => {
                          const matched = ROOM_CEILINGS.find(c => c.value === finishes.ceiling.value);
                          return (
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                              <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-100">
                                {matched?.image ? (
                                  <img src={matched.image} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full" style={{ backgroundColor: matched?.color || finishes.ceiling.value }} />
                                )}
                              </div>
                              <span className="text-[11px] font-bold">{matched?.name || finishes.ceiling.name}</span>
                            </div>
                          );
                        })() : (
                          <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                        )}
                      </button>

                      {/* Doors */}
                      <button
                        onClick={() => setShowFinishModal("doors")}
                        className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5 M13.5 12H3"/></svg>
                          <span>Doors</span>
                        </div>
                        {finishes.doors.value ? (() => {
                          const matched = ROOM_DOORS.find(d => d.value === finishes.doors.value);
                          return (
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                              <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-100">
                                {matched?.image ? (
                                  <img src={matched.image} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full" style={{ backgroundColor: matched?.color || finishes.doors.value }} />
                                )}
                              </div>
                              <span className="text-[11px] font-bold">{matched?.name || finishes.doors.name}</span>
                            </div>
                          );
                        })() : (
                          <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                        )}
                      </button>

                      {/* Windows */}
                      <button
                        onClick={() => setShowFinishModal("windows")}
                        className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" className="text-slate-500"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>
                          <span>Windows</span>
                        </div>
                        {finishes.windows.value ? (() => {
                          const matched = ROOM_WINDOWS.find(w => w.value === finishes.windows.value);
                          return (
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-slate-700">
                              <div className="w-4 h-4 rounded-full border border-slate-100 overflow-hidden bg-slate-100">
                                {matched?.image ? (
                                  <img src={matched.image} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full" style={{ backgroundColor: matched?.color || finishes.windows.value }} />
                                )}
                              </div>
                              <span className="text-[11px] font-bold">{matched?.name || finishes.windows.name}</span>
                            </div>
                          );
                        })() : (
                          <span className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">+</span>
                        )}
                      </button>
                    </div>

                    {/* Add Doors / Windows manually */}
                    <div className="space-y-3 pt-4 border-t border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Thêm Cửa / Cửa Sổ</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAddDoor()}
                        className="flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all cursor-pointer text-xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#00b5cd]" />
                        Thêm Cửa Đi
                      </button>
                      <button
                        onClick={() => handleAddWindow()}
                        className="flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all cursor-pointer text-xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#00b5cd]" />
                        Thêm Cửa Sổ
                      </button>
                    </div>
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
        onSelectShape={(shapeName, pts, _placements, width, length) =>
          handleShapeSelected(shapeName, pts, width, length)
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

      {/* ── DRAW WALL: Name Room Modal ──────────────────────────────── */}
      <AnimatePresence>
        {showDrawWallNameModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden font-sans"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#00b5cd]/10 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#00b5cd" strokeWidth="2" fill="none"><path d="M3 3h18v4H3zM3 10h8v4H3zM3 17h12v4H3z"/></svg>
                  </div>
                  <span className="font-bold text-slate-800 text-sm">Đặt tên phòng</span>
                </div>
                <button
                  onClick={() => { setShowDrawWallNameModal(false); setDrawingPoints([]); setActiveTool("select"); }}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs text-slate-500">Bạn vừa vẽ phòng với <strong>{drawingPoints.length} điểm</strong>. Chọn loại phòng hoặc nhập tên tùy ý.</p>
                {/* Quick room name buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {["Phòng khách", "Phòng ngủ", "Phòng bếp", "Phòng ăn", "WC", "Toilet", "Hành lang", "Gara"].map(name => (
                    <button
                      key={name}
                      onClick={() => setDrawWallRoomName(name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        drawWallRoomName === name
                          ? "bg-[#00b5cd] text-white border-[#00b5cd]"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#00b5cd]/50 hover:text-[#00b5cd]"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                {/* Custom name input */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Tên tùy chỉnh</label>
                  <input
                    type="text"
                    value={drawWallRoomName}
                    onChange={e => setDrawWallRoomName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        setShowDrawWallNameModal(false);
                        finaliseDrawWall(drawingPoints);
                      }
                    }}
                    placeholder="Nhập tên phòng..."
                    autoFocus
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-[#00b5cd] focus:ring-2 focus:ring-[#00b5cd]/20 transition-all"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setShowDrawWallNameModal(false); setDrawingPoints([]); setActiveTool("select"); }}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      setShowDrawWallNameModal(false);
                      finaliseDrawWall(drawingPoints);
                    }}
                    className="flex-1 py-2 rounded-xl bg-[#00b5cd] text-white text-xs font-bold hover:bg-[#009db3] transition-all cursor-pointer shadow-sm"
                  >
                    Tạo phòng
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

                          const preset = STYLE_PRESETS[style.name];
                          if (preset) {
                            // 1. Update Floor/Level finishes state
                            const flooringMatch = ROOM_FLOORINGS.find(f => f.value === preset.flooring) || ROOM_FLOORINGS[0];
                            const wallsMatch = ROOM_WALLS.find(w => w.value === preset.walls) || ROOM_WALLS[0];
                            const ceilingMatch = ROOM_CEILINGS.find(c => c.value === preset.ceiling) || ROOM_CEILINGS[0];
                            const doorsMatch = ROOM_DOORS.find(d => d.value === preset.doors) || ROOM_DOORS[0];
                            const windowsMatch = ROOM_WINDOWS.find(w => w.value === preset.windows) || ROOM_WINDOWS[0];
                            
                            setFinishes({
                              flooring: { type: "material", value: flooringMatch.value, name: flooringMatch.name },
                              walls: { type: wallsMatch.value.startsWith("#") ? "color" : "material", value: wallsMatch.value, name: wallsMatch.name },
                              ceiling: { type: ceilingMatch.value.startsWith("#") ? "color" : "material", value: ceilingMatch.value, name: ceilingMatch.name },
                              doors: { type: doorsMatch.value.startsWith("#") ? "color" : "material", value: doorsMatch.value, name: doorsMatch.name },
                              windows: { type: windowsMatch.value.startsWith("#") ? "color" : "material", value: windowsMatch.value, name: windowsMatch.name },
                            });

                            // 2. Update style and finishes of all existing rooms on this floor
                            if (floorPlan) {
                              pushHistory(floorPlan);
                              const updatedRooms = floorPlan.rooms.map((r) => ({
                                ...r,
                                style: style.name,
                                finishes: {
                                  ...r.finishes,
                                  flooring: preset.flooring,
                                  walls: preset.walls,
                                  ceiling: preset.ceiling,
                                  doors: preset.doors,
                                  windows: preset.windows,
                                }
                              }));
                              const updatedPlan = { ...floorPlan, rooms: updatedRooms };
                              setFloorPlan(updatedPlan);
                              const nextPlans = [...floorPlans];
                              nextPlans[activeFloorIndex] = updatedPlan;
                              setFloorPlans(nextPlans);
                            }
                          }
                          toast.success(`Đã chọn phong cách: ${style.name} cho cả tầng`);
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
                {finishes[showFinishModal]?.type === "material" ? (() => {
                  // Map finish type to correct material list + images
                  const FINISH_MATERIALS: Record<string, { name: string; value: string; color: string; img: string }[]> = {
                    flooring: [
                      { name: "Terrazzo", value: "Terrazzo", color: "#cbd5e1", img: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=150&q=80" },
                      { name: "Natural Oak", value: "natural_oak", color: "#e3c29b", img: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=150&q=80" },
                      { name: "Oak Wood", value: "Oak Wood", color: "#e3c29b", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=150&q=80" },
                      { name: "Concrete - Light", value: "Concrete - Light", color: "#e2e8f0", img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=150&q=80" },
                      { name: "Concrete - Dark", value: "Concrete - Dark", color: "#94a3b8", img: "https://images.unsplash.com/photo-1558979158-65a1eaa08691?auto=format&fit=crop&w=150&q=80" },
                      { name: "White Wood Panelling", value: "White Wood Panelling", color: "#f8fafc", img: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=150&q=80" },
                    ],
                    walls: [
                      { name: "White Plaster", value: "White Plaster", color: "#ffffff", img: "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=150&q=80" },
                      { name: "Terracotta Fan Tile", value: "Terracotta Fan Tile", color: "#c2410c", img: "https://images.unsplash.com/photo-1501183007986-d0d080b147f9?auto=format&fit=crop&w=150&q=80" },
                      { name: "Exposed Brick", value: "Exposed Brick", color: "#b91c1c", img: "https://images.unsplash.com/photo-1565891741441-64926e441838?auto=format&fit=crop&w=150&q=80" },
                      { name: "Concrete Render", value: "Concrete Render", color: "#cbd5e1", img: "https://images.unsplash.com/photo-1558979158-65a1eaa08691?auto=format&fit=crop&w=150&q=80" },
                    ],
                    ceiling: [
                      { name: "Soft White", value: "#ffffff", color: "#ffffff", img: "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=150&q=80" },
                      { name: "Raw Concrete", value: "#cbd5e1", color: "#cbd5e1", img: "https://images.unsplash.com/photo-1558979158-65a1eaa08691?auto=format&fit=crop&w=150&q=80" },
                      { name: "Wood Beams", value: "#ca8a04", color: "#ca8a04", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=150&q=80" },
                    ],
                    doors: [
                      { name: "Natural Oak", value: "natural_oak", color: "#ca8a04", img: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=150&q=80" },
                      { name: "Soft White", value: "#ffffff", color: "#ffffff", img: "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=150&q=80" },
                      { name: "Matte Black", value: "#1e293b", color: "#1e293b", img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=150&q=80" },
                    ],
                    windows: [
                      { name: "Soft White", value: "#ffffff", color: "#ffffff", img: "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=150&q=80" },
                      { name: "Matte Black", value: "#1e293b", color: "#1e293b", img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=150&q=80" },
                      { name: "Anodized Silver", value: "#cbd5e1", color: "#cbd5e1", img: "https://images.unsplash.com/photo-1558979158-65a1eaa08691?auto=format&fit=crop&w=150&q=80" },
                    ],
                  };
                  const materialList = FINISH_MATERIALS[showFinishModal] || [];
                  return (
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
                      <div className="grid grid-cols-2 gap-4 max-h-[280px] overflow-y-auto pr-1">
                        {materialList.map((mat) => {
                          const isSelected = finishes[showFinishModal]?.value === mat.value;
                          return (
                            <div
                              key={mat.value}
                              onClick={() => {
                                setFinishes(prev => ({
                                  ...prev,
                                  [showFinishModal]: { type: "material", value: mat.value, name: mat.name }
                                }));
                                applyFinishToAllRooms(showFinishModal as "flooring" | "walls" | "ceiling" | "doors" | "windows", mat.value);
                                setShowFinishModal(null);
                                toast.success(`Đã áp dụng vật liệu "${mat.name}" cho toàn bộ bản vẽ`);
                              }}
                              className={`group bg-[#1c1c1e] border rounded-xl overflow-hidden cursor-pointer hover:border-[#00b5cd]/50 transition-all p-1.5 ${
                                isSelected ? "border-[#00b5cd] ring-2 ring-[#00b5cd]/25" : "border-[#2d2d30]"
                              }`}
                            >
                              <div
                                className="w-full aspect-[4/3] rounded-lg mb-2 border border-[#2d2d30] relative overflow-hidden flex items-center justify-center"
                                style={{ backgroundColor: mat.color }}
                              >
                                {isSelected && (
                                  <div className="absolute inset-0 bg-[#00b5cd]/15 flex items-center justify-center">
                                    <div className="w-6 h-6 rounded-full bg-[#00b5cd] flex items-center justify-center text-white shadow-lg">
                                      <svg viewBox="0 0 24 24" width="12" height="12" stroke="white" strokeWidth="3" fill="none"><path d="M20 6 9 17l-5-5"/></svg>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="px-1.5 pb-1.5 text-center text-xs font-semibold text-slate-200 truncate">
                                {mat.name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })() : (
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
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val.length === 6 || val.length === 3) {
                              applyFinishToAllRooms(showFinishModal as "flooring" | "walls" | "ceiling" | "doors" | "windows", `#${val}`);
                            }
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
                              applyFinishToAllRooms(showFinishModal as "flooring" | "walls" | "ceiling" | "doors" | "windows", c.val);
                              setShowFinishModal(null);
                              toast.success(`Đã áp dụng màu "${c.name}" cho toàn bộ bản vẽ`);
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

