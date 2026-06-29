import React, { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Rect, Text, Line, Group } from "react-konva";
import {
  Download, Sparkles, ZoomIn, ZoomOut, RotateCw,
  Send, CheckCircle2, Circle, Settings2, ArrowLeft,
  Maximize2, Plus, Minus
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

// ── Constants ──────────────────────────────────────────────────────────────
const METER_TO_PX = 48;
const _GRID_SIZE = 0.5;

// ── Types ──────────────────────────────────────────────────────────────────
interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface Opening {
  id: string;
  type: "door" | "window";
  x: number;
  y: number;
  w: number;
  rotation: number;
}

interface FloorPlanData {
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
  const [renderResult, setRenderResult] = useState<string | null>(null);
  const [isRendering3D, setIsRendering3D] = useState(false);
  const [showShapeModal, setShowShapeModal] = useState(false);
  const [showRoomsModal, setShowRoomsModal] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<"layout" | "visualize">("visualize");
  const [autoRenderPending, setAutoRenderPending] = useState(false);
  const [wallThickness, setWallThickness] = useState<number>(100); // 100mm (4 inches)
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState<"flooring" | "walls" | "ceiling" | "doors" | "windows" | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [finishes, setFinishes] = useState<Record<string, { type: "material" | "color"; value: string; name: string }>>({
    flooring: { type: "material", value: "natural_oak", name: "Natural Oak" },
    walls: { type: "color", value: "#ffffff", name: "Trắng" },
    ceiling: { type: "color", value: "#ffffff", name: "Trắng" },
    doors: { type: "material", value: "natural_oak", name: "Natural Oak" },
    windows: { type: "color", value: "#1c1c1e", name: "Đen" },
  });

  // ── Auto-resize canvas ──────────────────────────────────────────────────
  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Auto-scroll chat ────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

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
5. Khi đã có đủ thông tin Số tầng, Kích thước đất, Hình dạng, và Số phòng, bạn BẮT BUỘC phải hỏi người dùng câu sau: "Tôi đã có đủ thông tin cấu trúc mặt bằng. Bạn có muốn tiến hành dựng phối cảnh 3D luôn không? Nếu bạn đồng ý (hoặc không còn yêu cầu bổ sung nào), tôi sẽ tự động sinh phối cảnh qua PiAPI."
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

Thông tin:
- Kích thước lô đất: ${landW}m x ${landL}m
- Hình dạng: ${shape}
- Yêu cầu phòng: ${rooms}
- Phong cách / yêu cầu bổ sung: ${extras}
- Tổng số tầng: ${totalFloors} tầng

Hãy phân bổ các phòng hợp lý cho ${floorLabel}. Nếu là tầng trệt: ưu tiên phòng khách, bếp, garage. Nếu tầng trên: ưu tiên phòng ngủ, WC.

Quy tắc bắt buộc:
1. Tất cả tọa độ x, y, w, h tính bằng mét (số thực).
2. x ∈ [0, ${landW}], y ∈ [0, ${landL}]. Phòng KHÔNG được vượt ra ngoài ranh giới đất.
3. Các phòng sát nhau, chia sẻ cạnh tường, không đè lên nhau.
4. Để lại hành lang/lối đi hợp lý (ít nhất 1-1.2m).
5. Chọn màu HEX nhạt và đẹp cho mỗi phòng.

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
            (r: any, idx: number) => ({
              id: `room_${floor}_${idx}_${Date.now()}`,
              name: r.name || "Phòng",
              x: Math.max(0, Math.min(landW - 1, parseFloat(r.x) || 0)),
              y: Math.max(0, Math.min(landL - 1, parseFloat(r.y) || 0)),
              w: Math.max(1, Math.min(landW, parseFloat(r.w) || 2)),
              h: Math.max(1, Math.min(landL, parseFloat(r.h) || 2)),
              color: r.color || getRoomColor(r.name || ""),
            })
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
      setActiveViewTab("layout");

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

    setIsRendering3D(true);
    addMessage("assistant", "🎨 Đang render phối cảnh 3D siêu thực từ mặt bằng...");

    try {
      let base64Image = "";
      if (stageRef.current) {
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
      const roomForRender = selectedRoomId
        ? floorPlan.rooms.find((r) => r.id === selectedRoomId)?.name || "Phòng khách"
        : "Phòng khách";

      const renderPrompt = `You are a professional 3D architectural visualizer.
Convert this 2D floor plan into a hyper-realistic 3D interior perspective render for the [${roomForRender}].
The property includes: ${roomsDesc}.
Style: ${gatherInfo.extras || "Modern Vietnamese contemporary"}.
Requirements:
- Natural light flooding in, warm shadows, 8K photorealistic quality.
- Elegant modern furniture, natural materials (wood, marble, fabric).
- Magazine-quality composition (ArchDaily style).
- NO floor plan lines, NO dimension text, pure 3D photorealistic render only.`;

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

  // ── Auto-render 3D after floor plan is generated ────────────────────────
  useEffect(() => {
    if (floorPlan && autoRenderPending) {
      const timer = setTimeout(() => {
        setAutoRenderPending(false);
        addMessage(
          "assistant",
          "🔄 Tôi đang tự động khởi chạy tiến trình dựng phối cảnh 3D qua PiAPI cho mặt bằng này..."
        );
        // Wait for stage to render completely
        setTimeout(() => {
          handleRender3D();
        }, 1500);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [floorPlan, autoRenderPending, addMessage, handleRender3D]);

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
              stroke="#8e8e93"
              strokeWidth={1}
              dash={[3, 3]}
            />
            <Line
              points={[0, 0, 0, -ow]}
              stroke="#e5e7eb"
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
              fill="#2c2c2e"
              stroke="#8e8e93"
              strokeWidth={1}
              cornerRadius={1}
            />
            <Line
              points={[-ow / 2, 0, ow / 2, 0]}
              stroke="#00b5cd"
              strokeWidth={1.5}
            />
          </Group>
        );
      }
    });
  };

  // ── Render floor plan on Konva ──────────────────────────────────────────
  const renderKonvaFloorPlan = (plan: FloorPlanData) => {
    const scale = METER_TO_PX * zoom;
    const isLayoutMode = activeViewTab === "layout";
    const thickness = (wallThickness / 1000) * scale;

    return plan.rooms.map((room) => {
      const isSelected = selectedRoomId === room.id;
      const fillColor = room.color || getRoomColor(room.name);

      if (isLayoutMode) {
        return (
          <Group
            key={room.id}
            onClick={() => setSelectedRoomId(isSelected ? null : room.id)}
            onTap={() => setSelectedRoomId(isSelected ? null : room.id)}
          >
            {/* Room Base area fill */}
            <Rect
              x={pan.x + room.x * scale}
              y={pan.y + room.y * scale}
              width={room.w * scale}
              height={room.h * scale}
              fill="#131314"
              stroke="#4c4c4e"
              strokeWidth={thickness}
              cornerRadius={2}
            />
            
            {/* Render Furniture */}
            {renderFurnitureForRoom(room, scale)}

            {/* Room label (Name) */}
            <Text
              x={pan.x + room.x * scale + 6}
              y={pan.y + room.y * scale + room.h * scale / 2 - 14}
              width={room.w * scale - 12}
              text={room.name}
              fontSize={Math.max(9, Math.min(13, room.w * scale / 7))}
              fill="#ffffff"
              fontStyle="bold"
              align="center"
              wrap="word"
            />
            {/* Room label (Area) */}
            <Text
              x={pan.x + room.x * scale + 6}
              y={pan.y + room.y * scale + room.h * scale / 2 + 4}
              width={room.w * scale - 12}
              text={`${(room.w * room.h).toFixed(1)}m²`}
              fontSize={Math.max(8, Math.min(11, room.w * scale / 9))}
              fill="#8e8e93"
              align="center"
            />
          </Group>
        );
      }

      return (
        <Group
          key={room.id}
          onClick={() => setSelectedRoomId(isSelected ? null : room.id)}
          onTap={() => setSelectedRoomId(isSelected ? null : room.id)}
        >
          <Rect
            x={pan.x + room.x * scale}
            y={pan.y + room.y * scale}
            width={room.w * scale}
            height={room.h * scale}
            fill={fillColor + "33"}
            stroke={fillColor}
            strokeWidth={isSelected ? 2.5 : 1.5}
            cornerRadius={4}
          />
          <Text
            x={pan.x + room.x * scale + 6}
            y={pan.y + room.y * scale + room.h * scale / 2 - 14}
            width={room.w * scale - 12}
            text={room.name}
            fontSize={Math.max(9, Math.min(13, room.w * scale / 7))}
            fill={fillColor}
            fontStyle="bold"
            align="center"
            wrap="word"
          />
          <Text
            x={pan.x + room.x * scale + 6}
            y={pan.y + room.y * scale + room.h * scale / 2 + 4}
            width={room.w * scale - 12}
            text={`${(room.w * room.h).toFixed(1)}m²`}
            fontSize={Math.max(8, Math.min(11, room.w * scale / 9))}
            fill={fillColor + "cc"}
            align="center"
          />
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
          {floorPlan && (
            <button
              onClick={handleRender3D}
              disabled={isRendering3D}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#d4a853] hover:bg-[#c49843] disabled:opacity-50 text-[#1a1612] text-xs font-bold rounded-lg transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isRendering3D ? "Đang render..." : "Render 3D"}
            </button>
          )}
          {floorPlan && (
            <button
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-500 text-xs font-semibold rounded-lg transition-all"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Tạo lại
            </button>
          )}
          <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
            <Settings2 className="w-3.5 h-3.5" />
            <span>Cài đặt</span>
          </div>
        </div>
      </div>

      {/* ── CHAT SIDEBAR ─────────────────────────────────────────────────── */}
      {activeViewTab === "visualize" && (
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
              disabled={isGenerating || currentStep === "done"}
              placeholder={
                currentStep === "done" || isGenerating
                  ? "Đang xử lý..."
                  : "Trả lời iGen..."
              }
              className="flex-1 bg-transparent text-slate-700 text-xs placeholder-slate-400 outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isGenerating || currentStep === "done"}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#d4a853] hover:bg-[#c49843] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[#1a1612]"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ── CANVAS AREA ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col pt-12 relative overflow-hidden">
        {/* Floor tabs */}
        {floorPlans.length > 1 && (
          <div className="absolute top-12 left-0 right-0 flex items-center gap-1 px-4 py-2 z-10">
            {floorLabels.map((label, i) => (
              <button
                key={i}
                onClick={() => {
                  setActiveFloorIndex(i);
                  setFloorPlan(floorPlans[i]);
                  setSelectedRoomId(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeFloorIndex === i
                    ? "bg-[#d4a853] text-white"
                    : "bg-slate-100 text-slate-400 hover:text-slate-700"
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
          style={{ cursor: isPanning ? "grabbing" : "default", background: activeViewTab === "layout" ? "#111112" : "white" }}
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
                  {activeViewTab === "layout" && renderOpenings(floorPlan)}
                </>
              )}
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
                          <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
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

        {/* ── BOTTOM PANEL: Room info + Render result ────────────────────── */}
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

      {/* ── RIGHT SIDEBAR (LAYOUT CONFIG) ───────────────────────────────── */}
      {activeViewTab === "layout" && (
        <div className="w-[320px] flex-shrink-0 flex flex-col bg-[#141415] border-l border-[#2d2d30] pt-12 z-20 text-slate-100 font-sans overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Title and size */}
            <div className="border-b border-[#2d2d30] pb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-100">
                    {activeFloorIndex === 0 ? "Tầng Trệt" : `Tầng ${activeFloorIndex}`}
                  </h3>
                  <button className="text-slate-500 hover:text-slate-300">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  </button>
                </div>
                <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Tên tầng</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-300">
                  {gatherInfo.landWidth || 5}m × {gatherInfo.landLength || 15}m
                </span>
                <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Kích thước ngoại thất</div>
              </div>
            </div>

            {/* CONFIGURATION */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Cấu hình</span>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">Độ dày tường</span>
                <div className="flex items-center gap-2 border border-[#2d2d30] bg-[#111112] rounded-full px-2.5 py-1">
                  <button
                    onClick={() => setWallThickness(t => Math.max(50, t - 50))}
                    className="text-slate-400 hover:text-white cursor-pointer select-none transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-slate-100 text-xs font-semibold w-12 text-center select-none">
                    {wallThickness}mm
                  </span>
                  <button
                    onClick={() => setWallThickness(t => Math.min(300, t + 50))}
                    className="text-slate-400 hover:text-white cursor-pointer select-none transition-colors"
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
                className="w-full flex items-center justify-between border border-[#2d2d30] rounded-xl px-4 py-3 bg-[#18181a] hover:bg-[#1c1c1e] text-slate-300 font-semibold cursor-pointer text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#111112] border border-[#2d2d30] flex items-center justify-center text-slate-400">
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" /><path d="M12 6V18" /><path d="M6 12H18" /></svg>
                  </div>
                  <span>Phong cách (Style)</span>
                </div>
                <span className="text-slate-400 font-medium">
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
                className="w-full flex items-center justify-between border border-[#2d2d30] rounded-xl px-4 py-3 bg-[#18181a] hover:bg-[#1c1c1e] text-slate-300 font-semibold cursor-pointer text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#111112] border border-[#2d2d30] flex items-center justify-center text-slate-400">
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M4 19h16v2H4v-2zm0-4h16v2H4v-2zm0-4h16v2H4v-2zm0-4h16v2H4V7zm0-4h16v2H4V3z"/></svg>
                  </div>
                  <span>Lát sàn (Flooring)</span>
                </div>
                <span className="text-[#00b5cd] font-medium">{finishes.flooring.name}</span>
              </button>

              {/* Walls */}
              <button
                onClick={() => setShowFinishModal("walls")}
                className="w-full flex items-center justify-between border border-[#2d2d30] rounded-xl px-4 py-3 bg-[#18181a] hover:bg-[#1c1c1e] text-slate-300 font-semibold cursor-pointer text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#111112] border border-[#2d2d30] flex items-center justify-center text-slate-400">
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M12 2a10 10 0 0 0-10 10c0 5.52 4.48 10 10 10s10-4.48 10-10a10 10 0 0 0-10-10zm1 14.5h-2v-2h2v2zm0-4h-2v-6h2v6z"/></svg>
                  </div>
                  <span>Sơn tường (Walls)</span>
                </div>
                {finishes.walls.type === "color" ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded border border-[#2d2d30]" style={{ backgroundColor: finishes.walls.value }} />
                    <span className="text-slate-400 text-[11px] font-mono">{finishes.walls.value}</span>
                  </div>
                ) : (
                  <span className="text-[#00b5cd] font-medium">{finishes.walls.name}</span>
                )}
              </button>

              {/* Ceiling */}
              <button
                onClick={() => setShowFinishModal("ceiling")}
                className="w-full flex items-center justify-between border border-[#2d2d30] rounded-xl px-4 py-3 bg-[#18181a] hover:bg-[#1c1c1e] text-slate-300 font-semibold cursor-pointer text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#111112] border border-[#2d2d30] flex items-center justify-center text-slate-400">
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M12 2L2 22h20L12 2zm0 4l7.5 13h-15L12 6z"/></svg>
                  </div>
                  <span>Trần nhà (Ceiling)</span>
                </div>
                {finishes.ceiling.type === "color" ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded border border-[#2d2d30]" style={{ backgroundColor: finishes.ceiling.value }} />
                    <span className="text-slate-400 text-[11px] font-mono">{finishes.ceiling.value}</span>
                  </div>
                ) : (
                  <span className="text-[#00b5cd] font-medium">{finishes.ceiling.name}</span>
                )}
              </button>

              {/* Doors */}
              <button
                onClick={() => setShowFinishModal("doors")}
                className="w-full flex items-center justify-between border border-[#2d2d30] rounded-xl px-4 py-3 bg-[#18181a] hover:bg-[#1c1c1e] text-slate-300 font-semibold cursor-pointer text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#111112] border border-[#2d2d30] flex items-center justify-center text-slate-400">
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.5 12H3"/></svg>
                  </div>
                  <span>Cửa đi (Doors)</span>
                </div>
                <span className="text-[#00b5cd] font-medium">{finishes.doors.name}</span>
              </button>

              {/* Windows */}
              <button
                onClick={() => setShowFinishModal("windows")}
                className="w-full flex items-center justify-between border border-[#2d2d30] rounded-xl px-4 py-3 bg-[#18181a] hover:bg-[#1c1c1e] text-slate-300 font-semibold cursor-pointer text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#111112] border border-[#2d2d30] flex items-center justify-center text-slate-400">
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-9 14H4v-5h7v5zm0-7H4V6h7v5zm9 7h-7v-5h7v5zm0-7h-7V6h7v5z"/></svg>
                  </div>
                  <span>Cửa sổ (Windows)</span>
                </div>
                {finishes.windows.type === "color" ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded border border-[#2d2d30]" style={{ backgroundColor: finishes.windows.value }} />
                    <span className="text-slate-400 text-[11px] font-mono">{finishes.windows.value}</span>
                  </div>
                ) : (
                  <span className="text-[#00b5cd] font-medium">{finishes.windows.name}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
