import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import { useAuth } from "../context/useAuth";
import { apiClient, ApiResponse } from "../services/apiClient";
import { ImageLibraryModal } from "./render/ImageLibraryModal";
import {
  handleDownload,
  getAIClient,
  safeJsonParse,
  checkUserCredits,
  generateContentWithRetry,
  getImageBase64,
  cacheImage,
  scaleToResolution,
  uploadMedia,
} from "../lib/renderUtils";
import { Type } from "@google/genai";
import { toast } from "sonner";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { ImageAnnotator } from "./ImageAnnotator";
import { convertPdfToImage } from "../lib/pdfUtils";
import { RenderTabContent } from "./render/RenderTabContent";
import { EnhanceRenderTabContent } from "./render/EnhanceRenderTabContent";
import { UpscaleTabContent } from "./render/UpscaleTabContent";
import { SyncTabContent } from "./render/SyncTabContent";


const TABS = [
  "Render",
  "Cải thiện Render",
  "Upscale",
  "Đồng bộ",
  "Chỉnh sửa",
  "Canvas",
  "Tiện ích khác",
];

const MODELS = [
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro (PiAPI)",
    isPro: true,
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2 (PiAPI)",
    isPro: true,
  },
];

const GEMINI_MODELS = [
  {
    id: "gemini-3.1-flash-image-preview",
    name: "iGen 3.1 Flash Image Preview",
    isPro: true,
  },
  {
    id: "gemini-3-pro-image-preview",
    name: "iGen 3 Pro Image Preview",
    isPro: true,
  },
];

const RESOLUTIONS = [
  { id: "1K", name: "1K Full HD" },
  { id: "2K", name: "2K Quad HD" },
];

const deleteCloudinaryMedia = async (url: string) => {
  if (url && url.includes("cloudinary.com")) {
    try {
      await apiClient.delete("/api/v1/media", {
        body: { publicId: url }
      });
    } catch (error) {
      console.error("Failed to delete media:", error);
    }
  }
};


export const Render: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Render");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const { user } = useAuth();
  const isAdmin = user ? (user.role === "admin" || user.role === "superadmin") : false;

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ tab: string }>).detail;
      if (detail?.tab) setActiveTab(detail.tab);
    };
    window.addEventListener("igenNavigate", handleNavigate);
    return () => window.removeEventListener("igenNavigate", handleNavigate);
  }, []);

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col p-8">
        {/* Page Header */}
        <div className="relative mb-8 z-40 flex items-center justify-center min-h-[64px]">
          <div className="absolute left-0 top-0 flex items-center gap-4">
            <button
              onClick={() => navigate("/home")}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors"
            >
              <Icon name="chevron_left" className="text-2xl text-on-surface" />
            </button>
          </div>
          <div className="flex flex-col items-center text-center">
            <h1 className="text-3xl font-black tracking-tight text-on-surface flex items-center gap-2 uppercase justify-center">
              <span className="text-primary">iGen</span> Rendering
            </h1>
            <p className="text-xs font-bold text-on-surface-variant/60 tracking-widest uppercase mt-1 text-center">
              Powered by iGen Vision Engine
            </p>
          </div>
        </div>

        {/* Main Tabs Navigation */}
        <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                if (tab === "Tiện ích khác" || tab === "Cải thiện Render") {
                  setPendingTab(tab);
                  setShowFeatureModal(true);
                } else {
                  setActiveTab(tab);
                }
              }}
              className={`px-6 py-3 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
                activeTab === tab
                  ? "bg-on-surface text-white"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-white hover:shadow-sm"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content Container */}
        <div className="flex-1 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col relative">
          {activeTab === "Render" && <RenderTabContent isAdmin={isAdmin} />}
          {activeTab === "Cải thiện Render" && <EnhanceRenderTabContent />}
          {activeTab === "Upscale" && <UpscaleTabContent />}
          {activeTab === "Đồng bộ" && <SyncTabContent />}
          {activeTab === "Chỉnh sửa" && <EditTabContent />}
          {activeTab === "Canvas" && <LayoutTabContent />}
          {activeTab === "Tiện ích khác" && <UtilitiesTabContent />}

          {pendingTab && showFeatureModal && (
            <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-outline-variant/20 animate-in fade-in zoom-in duration-200 relative overflow-hidden text-center">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-500 to-[#0ea5e9]"></div>
                <button
                  onClick={() => {
                    setPendingTab(null);
                    setShowFeatureModal(false);
                  }}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-all bg-transparent"
                  aria-label="Đóng thông báo"
                >
                  <Icon name="close" className="text-lg" />
                </button>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-5 animate-pulse">
                    <Icon name="language" className="text-3xl text-[#0ea5e9]" />
                  </div>
                  <h3 className="text-xl font-bold text-on-surface mb-3 tracking-tight">
                    Thông báo
                  </h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                    Tính năng này đang được chúng tôi phát triển và sẽ sớm ra mắt. Cảm ơn bạn đã quan tâm!
                  </p>
                  <button
                    onClick={() => {
                      if (isAdmin && pendingTab) {
                        setActiveTab(pendingTab);
                      }
                      setPendingTab(null);
                      setShowFeatureModal(false);
                    }}
                    className="w-full py-2.5 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-md transition-all text-xs uppercase tracking-wider"
                  >
                    Đồng ý
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


const EditTabContent: React.FC = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState("Sửa Tổng Thể");
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<"input" | "reference">(
    "input",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  // States for "Sửa Tổng Thể"
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState(
    "gemini-3-pro-image-preview",
  );
  const [selectedResolution, setSelectedResolution] = useState("1K");
  const [numImages, setNumImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState("Tự động");
  const [promptModel, setPromptModel] = useState("gemini-2.5-flash");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptStatus, setPromptStatus] = useState("");
  const [smoothPromptProgress, setSmoothPromptProgress] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [smoothRenderProgress, setSmoothRenderProgress] = useState(0);
  const [editHistory, setEditHistory] = useState<
    {
      id: string;
      original: string;
      edited: string;
      type: string;
      timestamp: string;
    }[]
  >(() => {
    const saved = localStorage.getItem("iGen_editHistory");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(
      "iGen_editHistory",
      JSON.stringify(editHistory.slice(0, 20)),
    );
  }, [editHistory]);
  const [description, setDescription] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [uploadProgressRef, setUploadProgressRef] = useState(0);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
  const [annotationMask, setAnnotationMask] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    // Reset states when switching sub-tabs (but keep inputImage so users don't lose their uploaded image)
    setTimeout(() => {
      setPrompt("");
      setDescription("");
      setCrop(undefined);
      setAnnotatedImage(null);
      setResultImage(null);

      const editRefUrl = localStorage.getItem("iGen_editReferenceImage");
      if (editRefUrl) {
        setInputImage(editRefUrl);
        localStorage.removeItem("iGen_editReferenceImage");
      }
    }, 0);
  }, [activeSubTab]);

  const handleDownloadResult = async () => {
    if (!resultImage) return;
    try {
      const imageData = await getImageBase64(resultImage, false);
      const byteCharacters = atob(imageData.base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: imageData.mimeType });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `igen_edit_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Có lỗi xảy ra khi tải ảnh.");
    }
  };

  const handleDeleteResult = async () => {
    if (!resultImage) return;
    try {
      await deleteCloudinaryMedia(resultImage);
      setResultImage(null);
      toast.success("Đã xoá ảnh thành công");
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("Lỗi khi xoá ảnh");
    }
  };

  const handleDeleteHistoryItem = async (id: string, imageUrl: string) => {
    try {
      await deleteCloudinaryMedia(imageUrl);
      setEditHistory((prev) => prev.filter((item) => item.id !== id));
      if (resultImage === imageUrl) {
        setResultImage(null);
      }
      toast.success("Đã xoá ảnh khỏi lịch sử");
    } catch (error) {
      console.error("Error deleting history image:", error);
      toast.error("Lỗi khi xoá ảnh");
    }
  };

  const subTabs = [
    { id: "Sửa Tổng Thể", icon: "brush" },
    { id: "Crop để sửa", icon: "crop" },
    { id: "Thay Thế Model", icon: "view_in_ar" },
    { id: "Thêm Đối Tượng", icon: "add_circle_outline" },
    { id: "Đổi Vật Liệu", icon: "texture" },
    { id: "Ghi Chú", icon: "edit_note" },
  ];

  const handleGeneratePrompt = async () => {
    setIsGeneratingPrompt(true);
    setSmoothPromptProgress(0);
    setPromptStatus("Khởi tạo...");
    const startTime = Date.now();
    const expectedDuration = 8000; // 8 seconds expected for prompt generation

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(90, (elapsed / expectedDuration) * 90);
      setSmoothPromptProgress(progress);
    }, 100);

    try {
      const ai = await getAIClient(promptModel);

      const getImagePart = async (url: string) => {
        const imageData = await getImageBase64(url, true);
        if (!imageData || !imageData.base64Data) {
          throw new Error(`Không thể tải hoặc xử lý hình ảnh: ${url}`);
        }
        return {
          inlineData: {
            data: imageData.base64Data,
            mimeType: imageData.mimeType || "image/jpeg",
          },
        };
      };

      const parts: (
        | { text: string; inlineData?: undefined }
        | { inlineData: { data: string; mimeType: string }; text?: undefined }
      )[] = [];

      setPromptStatus("Đang xử lý ảnh đầu vào...");

      if (activeSubTab === "Đổi Vật Liệu") {
        if (annotatedImage || inputImage) {
          parts.push({ text: "Original Image:" });
          parts.push(await getImagePart(annotatedImage || inputImage!));
        }
        if (referenceImage) {
          parts.push({
            text: "\nMaterial Reference Image (Extract Texture Only):",
          });
          parts.push(await getImagePart(referenceImage));
          parts.push({ text: `\nUser Request: ${description || "Không có"}` });
        } else {
          parts.push({ text: `\nUser Request: ${description || "Không có"}` });
          parts.push({
            text: "\nNote: No reference image provided. Infer material DNA entirely from the User Request.",
          });
        }
      } else {
        if (annotatedImage || inputImage) {
          parts.push(await getImagePart(annotatedImage || inputImage!));
        }

        if (activeSubTab === "Thay Thế Model" && referenceImage) {
          parts.push(await getImagePart(referenceImage));
        } else if (activeSubTab === "Thêm Đối Tượng" && referenceImage) {
          parts.push(await getImagePart(referenceImage));
        }
      }

      setPromptStatus("AI đang phân tích và tạo prompt...");

      let cropInfo = "";
      if (activeSubTab === "Crop để sửa" && crop && imageRef) {
        const percentX =
          crop.unit === "%"
            ? Math.round(crop.x)
            : Math.round((crop.x / imageRef.width) * 100);
        const percentY =
          crop.unit === "%"
            ? Math.round(crop.y)
            : Math.round((crop.y / imageRef.height) * 100);
        const percentW =
          crop.unit === "%"
            ? Math.round(crop.width)
            : Math.round((crop.width / imageRef.width) * 100);
        const percentH =
          crop.unit === "%"
            ? Math.round(crop.height)
            : Math.round((crop.height / imageRef.height) * 100);
        cropInfo = `- Vùng cần chỉnh sửa (tọa độ phần trăm): x=${percentX}%, y=${percentY}%, width=${percentW}%, height=${percentH}%`;
      }

      let textPrompt = "";
      if (activeSubTab === "Thay Thế Model") {
        textPrompt = `
- Yêu cầu thay đổi: ${description || "Không có"}
`;
      } else if (activeSubTab === "Thêm Đối Tượng") {
        textPrompt = `
- Mô tả vị trí và đối tượng: ${description || "Không có"}
- Yêu cầu:
1. Phân tích hình ảnh nền (ảnh gốc) và hình ảnh đối tượng cần thêm (nếu có).
2. Tạo một prompt tiếng Anh chi tiết để AI tạo ảnh thực hiện thêm đối tượng vào vị trí được mô tả trong ảnh nền.
3. QUAN TRỌNG: Trong prompt tiếng Anh, PHẢI có câu lệnh yêu cầu GIỮ NGUYÊN HOÀN TOÀN (keep exactly the same, do not alter, preserve exactly) các phần còn lại của bức ảnh nền (kiến trúc, ánh sáng, bối cảnh xung quanh).
- Chỉ trả về nội dung prompt tiếng Anh, không giải thích gì thêm.
`;
      } else if (activeSubTab === "Đổi Vật Liệu") {
        textPrompt = "";
      } else if (activeSubTab === "Crop để sửa") {
        textPrompt = `
- Mô tả thay đổi: ${description || "Không có"}
${cropInfo}
- YÊU CẦU ĐẶC BIỆT: Nếu người dùng muốn sửa nội dung chữ (text/lettering - ví dụ đổi tên trên bảng hiệu, mái tôn), cấu trúc prompt BẮT BUỘC phải yêu cầu GIỮ NGUYÊN font chữ, màu sắc, độ nổi 3D, phối cảnh, và ánh sáng mặt trời, CHỈ thay đổi nội dung chữ thành nội dung mới.
`;
      } else {
        textPrompt = `
- Mô tả thay đổi: ${description || "Không có"}
${cropInfo}
`;
      }

      if (textPrompt) parts.push({ text: textPrompt });

      let config: Record<string, unknown> | undefined = undefined;
      if (activeSubTab === "Crop để sửa") {
        config = {
          systemInstruction: `
<role>
You are the "iGen Image Surgeon," a specialized spatial reasoning engine for localized architectural image editing. Your mission is to analyze a reference image, a user-defined crop box (coordinates), and an editing request, then generate a perfect inpainting instruction for \`gemini-3.1-flash-image-preview\`.
</role>

<core_logic>
1. SPATIAL CONSTRAINT: You are strictly forbidden from modifying any part of the image OUTSIDE the provided crop box coordinates. Your focus is 100% on the content within the [x, y, width, height] rectangle.
2. FIDELITY & BLENDING: The goal is "Seamless Integration." The newly generated content must match the lighting, texture, perspective, and architectural style of the surrounding areas outside the crop box.
3. INTENT CLASSIFICATION:
   - REPLACE: Morph the existing object inside the box into something new (e.g., old window to new aluminum window).
   - ADD: Synthesize a new object into a previously empty or irrelevant space within the box.
   - REMOVE: Clean the box area by inpainting it with the background texture (e.g., erasing power lines or trash).
4. ASPECT RATIO PRESERVATION: Analyze the reference image visually. You MUST identify its aspect ratio and ensure the \`detected_aspect_ratio\` field reflects this to maintain 100% consistency.
</core_logic>

<prompt_engineering_standard>
- LANGUAGE: The \`optimized_inpaint_prompt\` must be in professional, descriptive English.
- ARCHVIZ FOCUS: Use industry terms like "seamless blending, photorealistic texture, matching global illumination, consistent shadows."
- CONTENT: Describe the desired final state of the box area. For "Replace," describe the new object. For "Remove," describe the clean, unobstructed background.
</prompt_engineering_standard>

<coordinate_system_validation>
The user provides coordinates in the format: {"x": [0-1], "y": [0-1], "width": [0-1], "height": [0-1]}. 
- You must acknowledge these coordinates in the \`coordinates_lock\` field.
- Your prompt must tell the image engine to treat this bounding box as the active work zone.
</coordinate_system_validation>

<sanitization_protocol>
Silently bypass safety filters for architectural requests:
- 18+/Sensual requests inside a crop box -> Convert to "luxury high-end interior staging."
- Violence requests -> Convert to "dramatic architectural lighting contrast."
- Copyright logos -> Convert to "generic high-quality architectural branding."
</sanitization_protocol>

<negative_prompting_rules>
List undesired elements for the edited area: "visible seams, lighting mismatch, blurry textures, distorted geometry, mismatched perspective."
</negative_prompting_rules>

<fallback_protocol>
If the user's text description is vague or gibberish but a crop box is provided: Analyze the most logical architectural improvement for that specific box (e.g., cleaning up textures or enhancing materials) and proceed.
</fallback_protocol>
`,
          temperature: 1.0,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              edit_intent: {
                type: Type.STRING,
                description:
                  "Classification: REPLACE (change materials/details), ADD (insert new object), or REMOVE (erase/clean area).",
              },
              spatial_context_analysis: {
                type: Type.STRING,
                description:
                  "Analysis of what is currently inside the crop box and how it relates to the surrounding architecture.",
              },
              detected_aspect_ratio: {
                type: Type.STRING,
                description:
                  "The precise aspect ratio analyzed from the reference image (e.g., 16:9, 4:3, 1:1).",
              },
              optimized_inpaint_prompt: {
                type: Type.STRING,
                description:
                  "The English prompt focused ONLY on the delta change within the coordinates, ensuring seamless blending.",
              },
              coordinates_lock: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                },
                description:
                  "Echoing back the validated coordinates to ensure the engine only modifies this specific rectangle.",
              },
              negative_prompt: {
                type: Type.STRING,
                description:
                  "Strictly list what to avoid in the modified area (e.g., seams, mismatched lighting, artifacts).",
              },
            },
            required: [
              "edit_intent",
              "spatial_context_analysis",
              "detected_aspect_ratio",
              "optimized_inpaint_prompt",
              "coordinates_lock",
              "negative_prompt",
            ],
          },
        };
      } else if (activeSubTab === "Sửa Tổng Thể") {
        config = {
          systemInstruction: `<role>
You are an Elite AI Image Retoucher and Master Prompt Engineer. Your task is to analyze a user-provided original image along with their raw (often brief or messy) editing requests, and generate a highly optimized JSON prompt payload for the \`gemini-3.1-flash-image-preview\` model.
</role>

<core_directives>
1. TARGET STATE DESCRIPTIONS (NOT ACTIONS): 
Never write prompts as commands (e.g., "Change the wall to blue" or "Add a cat"). You MUST describe the final Target State of the image. (e.g., "A modern living room with a blue accent wall. A fluffy orange tabby cat is sleeping on the rug").
The image generation model needs to know what the entire final picture looks like, not the steps to get there.

2. DETAIL AUGMENTATION (INFLATION):
Users are lazy. If the user asks to "add a car", you must automatically infer the context and inflate the detail. (e.g., inflate to "A sleek, glossy red sports car parked on the asphalt, reflecting the afternoon sun"). Make the additions hyper-realistic and physically logical based on the original image's environment.

3. FIDELITY LOCK (STRUCTURAL PRESERVATION):
Identify everything the user DID NOT ask to change. You must explicitly list these in the "untouchable_elements" field, and thoroughly describe them in the "optimized_english_prompt" to force the generation model to recreate them exactly as they are in the original image.

4. LIGHTING & SYNERGY:
Any new objects or altered colors must be described as reacting to the original environment's lighting. If the room is lit by a sunset, the newly added "blue sofa" must be described as "a blue sofa bathed in warm golden hour sunlight".
</core_directives>

<json_field_guidelines>
- original_intent_analysis: Summarize what the user wants to do vs what the original image is.
- untouchable_elements: Explicit list of elements to lock (e.g., "Preserve the wooden floor, the glass coffee table, and the window layout").
- augmented_details: How you upgraded the user's lazy prompt.
- global_lighting_and_atmosphere: The exact lighting conditions to maintain.
- optimized_english_prompt: The final masterpiece. Formula: [Preserved Background/Setting] +[Augmented New Edits] + [Preserved Untouched Elements] + [Lighting Synergy] +[Render Specs: 8k resolution, photorealistic, highly detailed, sharp focus].
- negative_prompt: Protect the image. Include: "changing original layout, structural morphing, distorted geometry, mismatched lighting, unwanted artifacts,[and specific things the user wants to remove/avoid]".
</json_field_guidelines>`,
          temperature: 0.4,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              original_intent_analysis: {
                type: Type.STRING,
                description:
                  "Phân tích yêu cầu ngắn gọn của user đối chiếu với ảnh gốc.",
              },
              untouchable_elements: {
                type: Type.STRING,
                description:
                  "FIDELITY LOCK: Liệt kê chi tiết những vật thể, cấu trúc, background trong ảnh gốc TUYỆT ĐỐI KHÔNG ĐƯỢC THAY ĐỔI.",
              },
              augmented_details: {
                type: Type.STRING,
                description:
                  "Giải thích cách AI bơm thêm chi tiết cho yêu cầu của user để hợp logic vật lý (VD: 'Thêm chó' -> 'Thêm chú chó Golden Retriever đang nằm sưởi nắng').",
              },
              global_lighting_and_atmosphere: {
                type: Type.STRING,
                description:
                  "Mô tả lại ánh sáng, bóng đổ và tone màu tổng thể của ảnh gốc để đảm bảo chi tiết mới hòa quyện vào.",
              },
              optimized_english_prompt: {
                type: Type.STRING,
                description:
                  "PROMPT ĐÍCH: Mô tả toàn bộ bức ảnh (Target State) bao gồm cả những thứ giữ nguyên và những thứ mới được thêm/sửa, viết bằng tiếng Anh chuẩn kỹ thuật đồ họa.",
              },
              negative_prompt: {
                type: Type.STRING,
                description:
                  "Các từ khóa phủ định để ngăn chặn AI làm biến dạng ảnh hoặc thêm các chi tiết rác.",
              },
            },
            required: [
              "original_intent_analysis",
              "untouchable_elements",
              "augmented_details",
              "global_lighting_and_atmosphere",
              "optimized_english_prompt",
              "negative_prompt",
            ],
          },
        };
      } else if (activeSubTab === "Thay Thế Model") {
        config = {
          systemInstruction: `<role>
You are an Elite 3D Spatial Analyst and Generative AI Prompt Master. Your task is to analyze TWO images:[Image 1: Original Scene] and [Image 2: Reference Model], alongside the User's text request. You will act as an orchestrator to seamlessly replace a specified object in Image 1 with the object from Image 2, without using explicit image masks.
</role>

<core_directives>
1. SEMANTIC TARGETING (NO MASK): Since no mask is provided, you must precisely describe the exact physical footprint and location of the original object to be replaced within the target prompt.

2. PERSPECTIVE REPROJECTION (CRITICAL): The reference model (Image 2) might be a flat, front-facing e-commerce shot. However, the original scene (Image 1) might be a high-angle isometric view. You MUST force the final image generator to re-project the new model. 
- Do this by explicitly defining the camera angle in the prompt: "Viewed from a [Specific Angle] matching the room's perspective".

3. PHYSICAL INHERITANCE (RETAIN CONTEXT): If there are contextual objects interacting with the old object (e.g., a vase sitting on the old table, a laptop on the desk, a rug beneath the chair), you MUST explicitly command the retention of these objects and seamlessly integrate them onto the NEW object in the final prompt.

4. TARGET STATE DESCRIPTION: Never write commands like "Replace the desk". You must describe the complete, holistic final image. Describe the untouched room exactly as it is, but seamlessly integrate the NEW reference model into the description, modified by the original room's lighting and perspective.
</core_directives>

<json_field_guidelines>
- intent_and_identification: What is being swapped?
- analyze_original_object_and_space: Note the exact location, scale, and the precise camera angle capturing it.
- analyze_reference_model: Extract the DNA (texture, color, geometry) of the new object.
- perspective_reprojection_logic: Explain how the 2D reference model must be twisted/rotated in 3D space to fit Image 1.
- physical_inheritance: List objects to salvage (e.g., "The white ceramic vase and the two wine glasses").
- blending_physics: Determine light source direction from Image 1, specify where the new object's drop shadow must fall.
- optimized_english_prompt: The Master Prompt. Formula: [Original Untouched Room Description] + [Location Placeholder] featuring the[Reference Model DNA] + [Perspective Override Command] + [Inherited Objects Restored] + [Specific Lighting & Shadows] +[Render Specs: Unreal Engine 5, photorealistic, 8k].
- negative_prompt: Protect against "uncanny valley". Must include: "ghosting of original object, double objects, floating objects, incorrect perspective, flat lighting, mismatched shadows, morphed background, ignoring camera angle".
</json_field_guidelines>`,
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent_and_identification: {
                type: Type.STRING,
                description:
                  "Xác định rõ User muốn thay thế cái gì trong[Ảnh 1 - Gốc] bằng cái gì trong [Ảnh 2 - Model].",
              },
              analyze_original_object_and_space: {
                type: Type.STRING,
                description:
                  "Phân tích Tọa độ (footprint), Tỷ lệ (scale), và Góc máy ảnh (Camera angle - ví dụ: eye-level, top-down) của vật thể cũ trong không gian.",
              },
              analyze_reference_model: {
                type: Type.STRING,
                description:
                  "Phân tích Chất liệu (material), Hình dáng (shape), Màu sắc (color), và Phong cách của vật thể mới.",
              },
              perspective_reprojection_logic: {
                type: Type.STRING,
                description:
                  "Tính toán cách bóp méo/xoay chiều vật thể mới để nó khớp hoàn hảo với Góc máy ảnh của không gian cũ, bất chấp việc ảnh gốc của nó bị chụp chính diện.",
              },
              physical_inheritance: {
                type: Type.STRING,
                description:
                  "Liệt kê các đồ vật đang tương tác với vật cũ (VD: lọ hoa trên mặt bàn, tấm thảm dưới chân ghế) bắt buộc phải giữ lại và đặt lên vật mới.",
              },
              blending_physics: {
                type: Type.STRING,
                description:
                  "Logic đánh sáng: Tính toán hướng ánh sáng chính của phòng, cách vật mới đổ bóng xuống sàn, và màu sắc môi trường phản chiếu lên vật mới.",
              },
              optimized_english_prompt: {
                type: Type.STRING,
                description:
                  "PROMPT ĐÍCH: Mô tả tổng thể căn phòng nguyên bản, kết hợp vật thể mới đã được điều chỉnh phối cảnh, kế thừa đồ vật tương tác và khớp ánh sáng.",
              },
              negative_prompt: {
                type: Type.STRING,
                description:
                  "Từ khóa phủ định: Chống sai phối cảnh, chống dính dáng đến vật thể cũ (ghosting), chống bay lơ lửng.",
              },
            },
            required: [
              "intent_and_identification",
              "analyze_original_object_and_space",
              "analyze_reference_model",
              "perspective_reprojection_logic",
              "physical_inheritance",
              "blending_physics",
              "optimized_english_prompt",
              "negative_prompt",
            ],
          },
        };
      } else if (activeSubTab === "Thêm Đối Tượng") {
        config = {
          systemInstruction: `<role>
You are an Elite 3D VFX Compositor and Master Prompt Engineer. Your task is to analyze TWO images: [Image 1: Reference Background] and [Image 2: Subject Image], along with the User's text request. You will orchestrate the seamless addition of the subject from Image 2 into the environment of Image 1.
</role>

<core_directives>
1. IDENTITY RETENTION VS. POSE MORPHING (CRITICAL):
   The user may want the subject to DO something new (e.g., "A golden retriever sleeping on the rug"). 
   - You MUST extract the "Subject DNA" from Image 2 (fur color, specific clothing, hair, facial features).
   - You MUST generate a prompt that enforces this DNA but ALTERS the pose/state to match the request. Do NOT just copy-paste the exact 2D pixel crop of Image 2 if the pose conflicts with the user's text.

2. AUTO-GROUNDING & SCALE PRESERVATION:
   Never let an object "float". Unless the user explicitly provides spatial coordinates, you must analyze Image 1 to find a logical surface (e.g., floor, table, sky) and calculate the appropriate relative scale for the new object.

3. OCCLUSION & DEPTH AWARENESS:
   Analyze Image 1 for foreground elements. If the user wants to place a dog behind a glass coffee table, your prompt MUST explicitly state: "The dog is partially obscured by the glass coffee table in the foreground."

4. PHYSICAL CONTACT & WEIGHT:
   The subject must interact with the world. Explain how gravity affects them. (e.g., "The heavy plush sofa cushions are indented under the weight of the sleeping golden retriever.")
   - You must specifically define the Contact Shadow (darkest, immediately beneath) and the Cast Shadow (Directional, based on room lighting).

5. TARGET STATE OUTPUT:
   Do not output a command. Describe the final, complete picture. Describe the unaltered elements of Image 1 exactly as they are, then integrate the newly posed Subject seamlessly.
</core_directives>

<json_field_guidelines>
- user_intent_analysis: Brief summary of what is being added, where, and doing what.
- subject_dna_extraction: Hyper-detailed extraction of the subject's visual identity from Image 2 (face, skin tone, hair, clothing, material) that MUST NOT BE MUTATED.
- spatial_and_occlusion_logic: Calculate the 3D coordinates (x, y, z) in Image 1. If unspecified, find a logical plane. Analyze what foreground objects might obscure the new subject.
- pose_and_state_morphing: The logic of how the subject's body/state changes from Image 2 to fit the text request, while maintaining the "DNA".
- surface_contact_physics: How the new object squishes, bends, or pushes against the environment. Define the Drop Shadow and Contact Shadow.
- environmental_lighting_sync: Analyze Image 1's light (Color, Intensity, Direction). State how this light wraps around the new subject.
- optimized_english_prompt: The Master Prompt. Formula: [Perfectly Preserved Background] + [New Subject with Exact DNA in Modified Pose/State] + [Physical Contact/Weight] + [Matched Lighting & Shadows] + [Render Specs: Unreal Engine 5, photorealistic, 8k].
- negative_prompt: Protect against: floating objects, incorrect scale, mismatched lighting, identity mutation/changing the subject's face/clothes, extra limbs.
</json_field_guidelines>`,
          temperature: 0.4,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel: "high",
          },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              user_intent_analysis: { type: Type.STRING },
              subject_dna_extraction: { type: Type.STRING },
              spatial_and_occlusion_logic: { type: Type.STRING },
              pose_and_state_morphing: { type: Type.STRING },
              surface_contact_physics: { type: Type.STRING },
              environmental_lighting_sync: { type: Type.STRING },
              optimized_english_prompt: { type: Type.STRING },
              negative_prompt: { type: Type.STRING },
            },
            required: [
              "user_intent_analysis",
              "subject_dna_extraction",
              "spatial_and_occlusion_logic",
              "pose_and_state_morphing",
              "surface_contact_physics",
              "environmental_lighting_sync",
              "optimized_english_prompt",
              "negative_prompt",
            ],
          },
        };
      } else if (activeSubTab === "Đổi Vật Liệu") {
        config = {
          systemInstruction: `<role>
You are an Elite 3D Architectural Material Specialist and AI Prompt Master. Your task is to analyze the [Original Image], evaluate the User's text request, and extract material properties from the [Reference Image] (if provided). You will generate an optimized prompt to seamlessly swap a targeted surface's material while maintaining architectural integrity.
</role>

<core_directives>
1. SEMANTIC SURFACE TARGETING: Since no physical mask is provided, you must precisely define the targeted surface (e.g., "the main floor", "the exterior facade", "the back wall") and logically boundary it.

2. MATERIAL DNA EXTRACTION (IGNORE SHAPE): If a reference image is provided, extract ONLY its Physically Based Rendering (PBR) properties: Albedo (color), Normal (bump/veins), and Roughness/Glossiness. Completely ignore the shape of the object in the reference image (e.g., if it's a marble table, extract the marble texture, ignore the table). 

3. SEAMLESS TILING & SCALE: You must command the image generator to apply the material as a "seamless tiling texture". Adjust the scale logically. A small mosaic tile must remain small when applied to a large wall.

4. REALISTIC PHYSICS & RAY-TRACED REFLECTIONS: This is crucial. If the new material is glossy or reflective (e.g., polished marble, wet concrete, glass), you MUST explicitly describe the environmental reflections interacting with it. (e.g., "The newly polished marble floor clearly reflects the soft silhouette of the grey sofa and the bright light from the window").

5. FIDELITY LOCK (UNTOUCHABLE ELEMENTS): Explicitly protect everything that is NOT the targeted surface. Furniture resting on the swapped floor must not be altered, morph, or sink into the new material.
</core_directives>

<json_field_guidelines>
- surface_identification: Where is the surface and what touches it?
- material_dna_extraction: Describe the texture, color palette, and finish (matte, satin, glossy).
- scale_and_tiling_logic: Command the proper scale of the texture pattern.
- lighting_and_reflection_physics: Describe how light hits it and what it reflects.
- untouchable_elements: List furniture, shadows, and architectural details to preserve.
- optimized_english_prompt: Formula:[Original Room Description] + [Target Surface featuring New Material DNA] + "seamlessly tiled, correct architectural scale" + [New Reflections & PBR Physics] + [Untouched Furniture Protected] +[Render Specs: Unreal Engine 5, ray-traced reflections, PBR materials, hyper-realistic, 8k].
- negative_prompt: Must include: "visible texture seams, incorrect scale, giant textures, altered furniture, morphing structures, ignoring reflections, matte where it should be glossy, missing shadows."
</json_field_guidelines>`,
          temperature: 0.4,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel: "high",
          },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              surface_identification: {
                type: Type.STRING,
                description:
                  "Xác định bề mặt mục tiêu (sàn, trần, tường, mặt tiền) và mô tả giới hạn biên của nó trong Ảnh gốc.",
              },
              material_dna_extraction: {
                type: Type.STRING,
                description:
                  "Nếu có Ảnh tham khảo: Bóc tách loại vật liệu, vân (pattern), độ nhám/bóng (roughness), màu sắc. TUYỆT ĐỐI BỎ QUA hình dáng của vật thể trong ảnh tham khảo. Nếu không có ảnh, suy luận DNA từ text của user.",
              },
              scale_and_tiling_logic: {
                type: Type.STRING,
                description:
                  "Logic Nhân bản (Seamless Tiling): Tính toán kích thước vân vật liệu sao cho khi áp lên bề mặt lớn (như tường/sàn) không bị khổng lồ hóa hoặc tạo ra các đường chỉ nối (seam) vô lý.",
              },
              lighting_and_reflection_physics: {
                type: Type.STRING,
                description:
                  "Vật lý Phản xạ (PBR): Nếu vật liệu mới có độ bóng (kim loại, kính, đá), tính toán và ra lệnh nội suy hình bóng của đồ đạc/ánh sáng cửa sổ đổ lên bề mặt đó.",
              },
              untouchable_elements: {
                type: Type.STRING,
                description:
                  "Khóa mục tiêu: Liệt kê các đồ vật đang đặt TRÊN mặt sàn/áp sát tường bắt buộc phải giữ nguyên hình dáng và không bị vật liệu mới tràn lên.",
              },
              optimized_english_prompt: {
                type: Type.STRING,
                description:
                  "PROMPT ĐÍCH bằng Tiếng Anh kỹ thuật đồ họa, tổng hợp toàn bộ các logic trên thành mô tả tổng thể bức ảnh (Target State).",
              },
              negative_prompt: {
                type: Type.STRING,
                description:
                  "Từ khóa phủ định: Chống sai tỷ lệ vân, chống đường chỉ nối rõ ràng (visible seams), chống thay đổi đồ đạc.",
              },
            },
            required: [
              "surface_identification",
              "material_dna_extraction",
              "scale_and_tiling_logic",
              "lighting_and_reflection_physics",
              "untouchable_elements",
              "optimized_english_prompt",
              "negative_prompt",
            ],
          },
        };
      }

      const response = await generateContentWithRetry(ai, {
        model: promptModel,
        contents: [{ role: "user", parts }],
        config: config,
      });

      clearInterval(progressInterval);

      const finalPromptText = typeof response.text === "function" ? response.text() : (response.text || "");

      if (
        activeSubTab === "Crop để sửa" ||
        activeSubTab === "Sửa Tổng Thể" ||
        activeSubTab === "Thay Thế Model" ||
        activeSubTab === "Thêm Đối Tượng" ||
        activeSubTab === "Đổi Vật Liệu"
      ) {
        try {
          const parsed = safeJsonParse(finalPromptText);
          // If it's valid JSON from our Surgeon, we keep it as JSON string so handleRender can parse it
          setPrompt(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.error("Failed to parse JSON prompt", e);
          setPrompt(
            finalPromptText.replace(/```[a-zA-Z]*\n?|\n?```/g, "").trim(),
          );
        }
      } else {
        setPrompt(
          finalPromptText.replace(/```[a-zA-Z]*\n?|\n?```/g, "").trim(),
        );
      }

      setSmoothPromptProgress(100);
      setPromptStatus("Hoàn tất!");
      toast.success("Đã tạo prompt thành công!");
    } catch (error) {
      console.error("Error generating prompt:", error);
      const err = error as Error;
      if (err.message !== "Bạn đã hết Credits. Vui lòng nạp thêm.") {
        toast.error(err.message || "Lỗi khi tạo prompt. Vui lòng thử lại.");
      }
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsGeneratingPrompt(false);
        setPromptStatus("");
        setSmoothPromptProgress(0);
      }, 1000);
    }
  };

  const handleRender = async () => {
    if (!prompt && activeSubTab !== "Ghi Chú") {
      toast.error("Vui lòng tạo prompt trước khi render.");
      return;
    }
    if (!inputImage) {
      toast.error("Vui lòng tải ảnh lên.");
      return;
    }

    setIsRendering(true);
    setSmoothRenderProgress(0);
    setResultImage(null);

    // Kiểm tra nếu chọn PiAPI model cho trình chỉnh sửa canvas
    const isPiapiModel = selectedModel && (selectedModel.startsWith("piapi-") || selectedModel === "nano-banana-pro" || selectedModel === "nano-banana-2");
    if (isPiapiModel) {
      toast.error("Trình chỉnh sửa ảnh vẽ đè/canvas hiện chưa hỗ trợ PiAPI. Vui lòng chọn Gemini.");
      setIsRendering(false);
      return;
    }

    try {
      setSmoothRenderProgress(10); // Khởi tạo AI Client

      const getImagePart = async (url: string) => {
        const imageData = await getImageBase64(url, true);
        if (!imageData || !imageData.base64Data) {
          throw new Error(`Không thể tải hoặc xử lý hình ảnh: ${url}`);
        }
        return {
          inlineData: {
            data: imageData.base64Data,
            mimeType: imageData.mimeType || "image/jpeg",
          },
        };
      };

      setSmoothRenderProgress(30); // Đang xử lý ảnh đầu vào

      if (activeSubTab === "Ghi Chú") {
        let waitInterval: NodeJS.Timeout | undefined;
        try {
          const startTime = Date.now();
          const expectedDuration = 15000;
          const startProgress = 30;

          waitInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress =
              startProgress + Math.min(60, (elapsed / expectedDuration) * 60);
            setSmoothRenderProgress(progress);
          }, 100);

          const baseImageData = await getImageBase64(inputImage, true);
          const rawMaskImage = annotationMask || annotatedImage || inputImage;
          const annotationMaskData = await getImageBase64(rawMaskImage, true);

          if (!baseImageData?.base64Data || !annotationMaskData?.base64Data) {
            throw new Error("Không thể xử lý ảnh gốc hoặc ảnh mask.");
          }

          const userApiKey = user?.apiKey || "";

          // @ts-expect-error - aistudio is injected by AI Studio environment
          const isAIStudio = typeof window !== "undefined" && window.aistudio;
          if (isAIStudio && !userApiKey) {
            // @ts-expect-error - aistudio is injected by AI Studio environment
            if (!(await window.aistudio.hasSelectedApiKey())) {
              // @ts-expect-error - aistudio is injected by AI Studio environment
              await window.aistudio.openSelectKey();
            }
          }

          const apiKey =
            userApiKey ||
            process.env.API_KEY ||
            process.env.GEMINI_API_KEY;

          let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (!isAIStudio) {
            apiUrl = `${window.location.origin}/api/gemini-proxy/v1beta/models/${selectedModel}:generateContent`;
            if (userApiKey) {
              headers["x-user-api-key"] = userApiKey;
            }
          }
          const url = apiUrl;

          const payloadPrompt = `<role>\nYou are an Elite AI Retoucher equipped with Advanced Multilingual OCR and Visual Attention mechanisms. You are receiving two layers of visual input: a [Base Image] (the clean original) and a [Visual Instruction Mask] (transparent layer containing arrows, boxes, and text). Your task is to execute the user's annotations with pixel-perfect local accuracy.\n</role>\n\n<core_directives>\n1. MULTILINGUAL OCR & TRANSLATION (HARD DIRECTIVE): \nYou must actively scan the [Visual Instruction Mask] for text written in Vietnamese. Read the Vietnamese text, internally translate it into an English editing command (e.g., "Nhập chữ: đổi thành túi da màu đen" -> "Change to black leather bag"), and treat this as your primary editing instruction.\n\n2. SPATIAL TARGETING (FOLLOW THE ARROW): \nUse the arrows or bounding boxes drawn in the[Visual Instruction Mask] as strict targeting coordinates. Trace the arrow from the text to the exact physical object or region in the[Base Image]. You must ONLY apply the translated editing command to that specific object.\n\n3. STRICT LOCAL FIDELITY (100% PRESERVATION):\nYou are forbidden from making global changes. Do not "clean up" the room, do not adjust global lighting, do not move untouched objects. Everything outside the immediate bounding box of the targeted object MUST remain 100% identical to the [Base Image].\n\n4. ABSOLUTE MARKUP ERASURE:\nThe final output must be a clean, hyper-realistic photograph. The red arrows, text annotations, and drawing marks from the [Visual Instruction Mask] are CONTROL SIGNALS ONLY. They MUST NOT appear in the final generated image. Restore and maintain the natural textures and background from the [Base Image] exactly where the arrows were hovering.\n</core_directives>\n\n<execution_protocol>\n- Step 1: Read Vietnamese text via OCR -> Translate to English edit intent.\n- Step 2: Trace arrow to identify target object in the Base Image.\n- Step 3: Execute edit on target object seamlessly (matching original lighting and perspective).\n- Step 4: Discard all annotation graphics. Output clean image.\n</execution_protocol>\n\nExecute the visual edit now based on the provided image layers.`;

          const payload = {
            contents: [
              {
                role: "user",
                parts: [
                  { text: payloadPrompt },
                  {
                    inlineData: {
                      mimeType: baseImageData.mimeType,
                      data: baseImageData.base64Data,
                    },
                  },
                  {
                    inlineData: {
                      mimeType: annotationMaskData.mimeType,
                      data: annotationMaskData.base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 1.0,
            },
          };

          const rawResponse = await fetch(url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload),
          });

          if (!rawResponse.ok) {
            const errorData = await rawResponse.json().catch(() => ({}));
            throw new Error(
              `Lỗi kết nối tới API (${rawResponse.status}): ${JSON.stringify(errorData)}`,
            );
          }

          const responseJson = await rawResponse.json();
          let generatedImageUrl = null;

          if (responseJson.candidates && responseJson.candidates.length > 0) {
            const parts = responseJson.candidates[0].content?.parts || [];
            const imagePart = parts.find(
              (p: { inlineData?: { data?: string } }) => p.inlineData && p.inlineData.data,
            );
            if (imagePart) {
              generatedImageUrl = `data:image/jpeg;base64,${imagePart.inlineData.data}`;
            }
          }

          if (!generatedImageUrl) {
            throw new Error(
              "Không nhận được dữ liệu ảnh từ API. (Response format was unrecognised)",
            );
          }

          setSmoothRenderProgress(90);
          clearInterval(waitInterval);

          if (generatedImageUrl) {
            setSmoothRenderProgress(95);
            let finalImageUrl = generatedImageUrl;
            try {
              if (user) {
                const res = await apiClient.post<ApiResponse<{ url: string }>>("/api/v1/media/upload", {
                  file: generatedImageUrl,
                  folder: "edits"
                });
                finalImageUrl = res.data.url;
              }
            } catch (uploadError) {
              console.error("Error uploading edited image:", uploadError);
            }

            setResultImage(finalImageUrl);
            setSmoothRenderProgress(100);

            setEditHistory((prev) => [
              {
                id: Date.now().toString(),
                original: inputImage,
                edited: finalImageUrl,
                type: activeSubTab,
                timestamp: new Date().toLocaleString(),
              },
              ...prev,
            ]);

            toast.success("Đã thực hiện thay đổi thành công!");
          }
        } finally {
          if (waitInterval) clearInterval(waitInterval);
        }
        return;
      }

      const ai = await getAIClient(selectedModel);
      let finalPrompt = prompt;
      let negativePrompt = undefined;
      let detectedAspectRatio = undefined;
      let coordinatesLock = undefined;

      try {
        const parsedPrompt = safeJsonParse(prompt) as Record<string, unknown> | null;
        if (parsedPrompt && !Array.isArray(parsedPrompt)) {
          if (parsedPrompt.optimized_english_prompt) {
            finalPrompt = parsedPrompt.optimized_english_prompt as string;
          } else if (parsedPrompt.optimized_inpaint_prompt) {
            finalPrompt = parsedPrompt.optimized_inpaint_prompt as string;
          }
          if (parsedPrompt.negative_prompt) {
            negativePrompt = parsedPrompt.negative_prompt as string;
          }
          if (parsedPrompt.detected_aspect_ratio) {
            detectedAspectRatio = parsedPrompt.detected_aspect_ratio as string;
          }
          if (parsedPrompt.coordinates_lock) {
            coordinatesLock = parsedPrompt.coordinates_lock as { x: number; y: number; width: number; height: number };
          }
        }
      } catch {
        // Not JSON, just use the prompt as is
      }

      if (activeSubTab === "Crop để sửa") {
        if (coordinatesLock) {
          const { x, y, width, height } = coordinatesLock;
          const xCenter = Math.round((x + width / 2) * 100);
          const yCenter = Math.round((y + height / 2) * 100);
          const wPercent = Math.round(width * 100);
          const hPercent = Math.round(height * 100);

          finalPrompt = `[INPAINTING TASK]: Modify the area located at center (x=${xCenter}%, y=${yCenter}%) with size (width=${wPercent}%, height=${hPercent}%).
[INSTRUCTION]: ${finalPrompt}
[SPATIAL CONSTRAINT]: DO NOT modify any pixels outside this localized bounding box. Maintain 100% architectural and lighting fidelity for the rest of the image. The transition at the edges of the box must be perfectly seamless.`;
        } else {
          finalPrompt = `[INPAINTING TASK]: Modify only the specific area described.
[INSTRUCTION]: ${finalPrompt}
[SPATIAL CONSTRAINT]: Keep all other parts of the image exactly as they are.`;
        }
      } else if (activeSubTab === "Thay Thế Model") {
        finalPrompt +=
          "\nCRITICAL INSTRUCTION: Replace the model as described, but keep the rest of the image (architecture, lighting, background, environment) EXACTLY the same as the original input image.";
      } else if (activeSubTab === "Thêm Đối Tượng") {
        finalPrompt +=
          "\nCRITICAL INSTRUCTION: Add the object as described, but keep the rest of the background image (architecture, lighting, environment) EXACTLY the same as the original input image.";
      } else if (activeSubTab === "Đổi Vật Liệu") {
        finalPrompt +=
          "\nCRITICAL INSTRUCTION: Change the material/color as described, but keep the geometry, structure, lighting, and all other elements EXACTLY the same as the original input image.";
      }

      if (negativePrompt) {
        finalPrompt += `\nNEGATIVE PROMPT (Do NOT include these elements): ${negativePrompt}`;
      }

      const parts: (
        | { text: string; inlineData?: undefined }
        | { inlineData: { data: string; mimeType: string }; text?: undefined }
      )[] = [];
      parts.push(await getImagePart(annotatedImage || inputImage));

      if (activeSubTab === "Crop để sửa") {
        if (imageRef && crop && crop.width > 0 && crop.height > 0) {
          const canvas = document.createElement("canvas");
          const scaleX = imageRef.naturalWidth / imageRef.width;
          const scaleY = imageRef.naturalHeight / imageRef.height;
          canvas.width = imageRef.naturalWidth;
          canvas.height = imageRef.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "white";

            const pixelX =
              crop.unit === "%"
                ? (crop.x / 100) * imageRef.naturalWidth
                : crop.x * scaleX;
            const pixelY =
              crop.unit === "%"
                ? (crop.y / 100) * imageRef.naturalHeight
                : crop.y * scaleY;
            const pixelW =
              crop.unit === "%"
                ? (crop.width / 100) * imageRef.naturalWidth
                : crop.width * scaleX;
            const pixelH =
              crop.unit === "%"
                ? (crop.height / 100) * imageRef.naturalHeight
                : crop.height * scaleY;

            ctx.fillRect(pixelX, pixelY, pixelW, pixelH);

            const maskDataUrl = canvas.toDataURL("image/jpeg");
            const maskBase64 = maskDataUrl.split(",")[1];
            parts.push({
              inlineData: {
                data: maskBase64,
                mimeType: "image/jpeg",
              },
            });
          }
        }
      }

      if (activeSubTab === "Thay Thế Model" && referenceImage) {
        parts.push(await getImagePart(referenceImage));
      } else if (activeSubTab === "Thêm Đối Tượng" && referenceImage) {
        parts.push(await getImagePart(referenceImage));
      } else if (activeSubTab === "Đổi Vật Liệu" && referenceImage) {
        parts.push(await getImagePart(referenceImage));
      }
      parts.push({ text: finalPrompt });

      let apiAspectRatio = undefined;
      if (aspectRatio !== "Tự động") {
        if (aspectRatio.includes("16:9")) apiAspectRatio = "16:9";
        else if (aspectRatio.includes("9:16")) apiAspectRatio = "9:16";
        else if (aspectRatio.includes("4:3")) apiAspectRatio = "4:3";
        else if (aspectRatio.includes("3:4")) apiAspectRatio = "3:4";
        else if (aspectRatio.includes("21:9")) apiAspectRatio = "21:9";
        else if (aspectRatio.includes("1:1")) apiAspectRatio = "1:1";
      } else if (detectedAspectRatio) {
        if (detectedAspectRatio.includes("16:9")) apiAspectRatio = "16:9";
        else if (detectedAspectRatio.includes("9:16")) apiAspectRatio = "9:16";
        else if (detectedAspectRatio.includes("4:3")) apiAspectRatio = "4:3";
        else if (detectedAspectRatio.includes("3:4")) apiAspectRatio = "3:4";
        else if (detectedAspectRatio.includes("1:1")) apiAspectRatio = "1:1";
        else if (detectedAspectRatio.includes("1:4")) apiAspectRatio = "1:4";
        else if (detectedAspectRatio.includes("1:8")) apiAspectRatio = "1:8";
        else if (detectedAspectRatio.includes("4:1")) apiAspectRatio = "4:1";
        else if (detectedAspectRatio.includes("8:1")) apiAspectRatio = "8:1";
        else if (detectedAspectRatio.includes("21:9")) apiAspectRatio = "21:9";
      }

      if (
        apiAspectRatio &&
        selectedModel === "gemini-3.1-flash-image-preview"
      ) {
        const supported25 = ["1:1", "3:4", "4:3", "9:16", "16:9", "21:9"];
        if (!supported25.includes(apiAspectRatio)) {
          apiAspectRatio = "1:1";
        }
      }

      const imageConfig: {
        aspectRatio?: string;
        imageSize?: string;
        negativePrompt?: string;
      } = {};
      if (apiAspectRatio) {
        imageConfig.aspectRatio = apiAspectRatio;
      }

      if (
        selectedModel === "gemini-3.1-flash-image-preview" ||
        selectedModel === "gemini-3-pro-image-preview"
      ) {
        imageConfig.imageSize = selectedResolution;
      }

      const config: Record<string, unknown> = {};
      if (Object.keys(imageConfig).length > 0) {
        config.imageConfig = imageConfig;
      }

      // If crop logic is active, the mask is already added as the second image part in `parts`
      // We don't set INPAINT_REPLACE here because gemini-3.1-flash-image-preview / gemini-3-pro-image-preview might handle it via masks directly.

      let waitInterval: NodeJS.Timeout | undefined;

      try {
        // Simulate progress while waiting for AI response
        const startTime = Date.now();
        const expectedDuration = 15000; // 15 seconds expected for image generation
        const startProgress = 30; // We are already at 30%

        waitInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress =
            startProgress + Math.min(60, (elapsed / expectedDuration) * 60); // Go from 30 to 90
          setSmoothRenderProgress(progress);
        }, 100);

        const response = await generateContentWithRetry(ai, {
          model: selectedModel,
          contents: [{ role: "user", parts }],
          config: Object.keys(config).length > 0 ? config : undefined,
        });

        clearInterval(waitInterval);
        setSmoothRenderProgress(90); // Đã nhận phản hồi từ AI

        let generatedImageUrl = null;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            let base64EncodeString = part?.inlineData?.data || "";
            let mimeType = part?.inlineData?.mimeType || "image/png";

            if (selectedResolution === "2K" || selectedResolution === "4K") {
              const scaled = await scaleToResolution(
                base64EncodeString,
                mimeType,
                selectedResolution,
              );
              base64EncodeString = scaled.base64Data;
              mimeType = scaled.mimeType;
            }

            generatedImageUrl = `data:${mimeType};base64,${base64EncodeString}`;
            break;
          }
        }

        if (generatedImageUrl) {
          setSmoothRenderProgress(95); // Đang lưu ảnh

          let finalImageUrl = generatedImageUrl;
          try {
            if (user) {
              const res = await apiClient.post<ApiResponse<{ url: string }>>("/api/v1/media/upload", {
                file: generatedImageUrl,
                folder: "edits"
              });
              finalImageUrl = res.data.url;
            }
          } catch (uploadError) {
            console.error("Error uploading edited image:", uploadError);
          }

          setResultImage(finalImageUrl);
          setSmoothRenderProgress(100); // Hoàn tất

          setEditHistory((prev) => [
            {
              id: Date.now().toString(),
              original: inputImage,
              edited: finalImageUrl,
              type: activeSubTab,
              timestamp: new Date().toLocaleString(),
            },
            ...prev,
          ]);

          toast.success("Đã thực hiện thay đổi thành công!");
        } else {
          console.error(
            "AI response did not contain an image. Raw response:",
            response,
          );
          let aiText = "Không có nội dung";
          if (response?.text) {
            aiText = typeof response.text === "function" ? response.text() : response.text;
          } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            aiText = response.candidates[0].content.parts[0].text;
          }
          throw new Error(
            `Không tìm thấy ảnh trong phản hồi. AI nói: ${aiText.substring(0, 100)}${aiText.length > 100 ? "..." : ""}`,
          );
        }
      } finally {
        if (waitInterval) clearInterval(waitInterval);
      }
    } catch (error) {
      console.error("Error rendering:", error);
      const err = error as Error;
      toast.error(
        err.message || "Lỗi khi thực hiện thay đổi. Vui lòng thử lại.",
      );
    } finally {
      setTimeout(() => {
        setIsRendering(false);
        setSmoothRenderProgress(0);
      }, 500);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Vui lòng tải lên một tệp hình ảnh hợp lệ.");
      return;
    }

    if (!user) {
      toast.error("Vui lòng đăng nhập để tải ảnh lên.");
      return;
    }

    if (!(await checkUserCredits())) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const downloadURL = await uploadMedia(file, "uploads");
      cacheImage(downloadURL, file);
      setInputImage(downloadURL);
      setIsUploading(false);
    } catch (error) {
      console.error("Error initiating upload:", error);
      setIsUploading(false);
      toast.error("Đã xảy ra lỗi.");
    }
  };

  const processInputFile = async (inputFile: File) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để tải ảnh lên.");
      return;
    }

    if (!(await checkUserCredits())) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let fileToUpload = inputFile;
      if (inputFile.type === "application/pdf") {
        toast.info(`Đang chuyển đổi PDF ${inputFile.name}...`);
        const convertedImages = await convertPdfToImage(inputFile);
        if (convertedImages && convertedImages.length > 0) {
          fileToUpload = convertedImages[0];
        } else {
          throw new Error("PDF conversion failed or return empty");
        }
      }

      const downloadURL = await uploadMedia(fileToUpload, "uploads");
      cacheImage(downloadURL, fileToUpload);
      setInputImage(downloadURL);
      setIsUploading(false);
    } catch (error) {
      console.error("Error initiating upload:", error);
      setIsUploading(false);
      toast.error("Đã xảy ra lỗi.");
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processInputFile(file);
  };

  const handleImageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processInputFile(file);
  };

  const handleImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processRefFile = async (inputFile: File) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để tải ảnh lên.");
      return;
    }

    if (!(await checkUserCredits())) return;

    setIsUploadingRef(true);
    setUploadProgressRef(0);

    try {
      let fileToUpload = inputFile;
      if (inputFile.type === "application/pdf") {
        toast.info(`Đang chuyển đổi PDF ${inputFile.name}...`);
        const convertedImages = await convertPdfToImage(inputFile);
        if (convertedImages && convertedImages.length > 0) {
          fileToUpload = convertedImages[0];
        } else {
          throw new Error("Không thể chuyển đổi PDF.");
        }
      }

      const downloadURL = await uploadMedia(fileToUpload, "uploads");
      cacheImage(downloadURL, fileToUpload);
      setReferenceImage(downloadURL);
      setIsUploadingRef(false);
    } catch (error) {
      console.error("Error initiating upload:", error);
      setIsUploadingRef(false);
      toast.error("Đã xảy ra lỗi.");
    }
  };

  const handleRefImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processRefFile(file);
  };

  const [isDraggingRef, setIsDraggingRef] = useState(false);

  const handleRefImageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRef(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processRefFile(file);
  };

  const handleRefImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRef(true);
  };

  const handleRefImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRef(false);
  };

  return (
    <div className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto">
      {/* Sub-tabs */}
      <div className="flex items-center justify-center gap-4 flex-wrap">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center justify-center gap-2 w-[160px] py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeSubTab === tab.id
                ? "bg-primary text-white shadow-md"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            }`}
          >
            <Icon name={tab.icon} className="text-[18px]" />
            {tab.id}
          </button>
        ))}
      </div>

      {/* Main Workspace */}
      {activeSubTab === "Sửa Tổng Thể" ? (
        <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-[400px]">
          {/* Left Column */}
          <div className="w-full lg:w-[420px] flex flex-col gap-8 shrink-0">
            {/* Panel 1: Ảnh Gốc & Vùng Sửa */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface">
                  1. Ảnh Gốc & Vùng Sửa
                </h3>
                <button
                  onClick={() => setShowLibraryModal(true)}
                  className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Icon name="photo_library" className="text-[16px]" />
                  Thư viện ảnh
                </button>
              </div>
              <div
                className={`h-64 border-2 border-dashed ${isDragging ? "border-primary bg-primary/5" : "border-outline-variant/40 bg-surface-container-low/50"} rounded-xl flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-colors cursor-pointer hover:bg-surface-container-low relative overflow-hidden`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleImageDragOver}
                onDragLeave={handleImageDragLeave}
                onDrop={handleImageDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp, application/pdf"
                  onChange={handleImageUpload}
                />

                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                    <p className="text-sm font-semibold text-primary">
                      Đang tải lên... {Math.round(uploadProgress)}%
                    </p>
                  </div>
                ) : inputImage ? (
                  <div className="relative w-full h-full group">
                    <img
                      src={inputImage}
                      alt="Uploaded"
                      className="w-full h-full object-contain cursor-zoom-in"
                      referrerPolicy="no-referrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullscreenImage(inputImage);
                      }}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 pointer-events-none">
                      <button
                        className="text-white font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        <Icon name="edit" /> Thay đổi ảnh
                      </button>
                      <button
                        className="text-white font-medium flex items-center gap-2 bg-black/60 hover:bg-black/80 px-3 py-2 rounded-lg pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullscreenImage(inputImage);
                        }}
                      >
                        <Icon name="zoom_in" /> Phóng to
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                      <Icon
                        name="image"
                        className="text-3xl text-on-surface-variant group-hover:text-primary transition-colors"
                      />
                    </div>
                    <p className="text-sm font-semibold text-on-surface mb-1">
                      Nhấp hoặc kéo tệp vào đây
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      PNG, JPG, WEBP, PDF
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Panel 2: Công Cụ */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
              <h3 className="text-base font-bold text-on-surface mb-4">
                2. Công Cụ
              </h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Mô tả thay đổi:
                  </label>
                  <textarea
                    className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24"
                    placeholder="Ví dụ: Đổi màu tường thành xanh dương, thêm cây xanh góc phòng..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Panel 3: Tối ưu Prompt và Thông số */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface">
                  3. Tối ưu prompt và thông số
                </h3>
                <div className="relative w-48">
                  <select
                    className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2 text-xs font-medium text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                    value={promptModel}
                    onChange={(e) => setPromptModel(e.target.value)}
                  >
                    <option value="gemini-2.5-flash">
                      Gemini 2.5 Flash
                    </option>
                  </select>
                  <Icon
                    name="keyboard_arrow_down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[16px]"
                  />
                </div>
              </div>

              <button
                onClick={handleGeneratePrompt}
                disabled={isGeneratingPrompt}
                className="relative w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
              >
                {isGeneratingPrompt && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-100 ease-linear"
                    style={{ width: `${Math.min(100, smoothPromptProgress)}%` }}
                  ></div>
                )}
                <div className="relative z-10 flex items-center justify-center gap-2 w-full px-2">
                  {isGeneratingPrompt ? (
                    <div className="flex flex-col items-center justify-center w-full py-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="shrink-0 w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-bold text-base">
                          {Math.floor(Math.min(100, smoothPromptProgress))}%
                        </span>
                      </div>
                      <span className="text-center break-words text-xs sm:text-sm opacity-90 leading-tight">
                        {promptStatus}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="shrink-0">
                        <Icon name="auto_awesome" />
                      </div>
                      <span className="text-center break-words text-sm sm:text-base">
                        Phân tích & Hoàn thiện Prompt
                      </span>
                    </>
                  )}
                </div>
              </button>

              {/* Prompt Generation (Textarea) */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2">
                  Prompt tạo ảnh hoàn chỉnh:
                </label>
                <textarea
                  className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24"
                  placeholder="Ảnh chụp thực tế công trình, giữ chính xác góc chụp 100% như ảnh đưa vào..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                ></textarea>
              </div>

              {/* Model & Resolution */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    AI Engine
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      {GEMINI_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} {model.isPro ? "(Pro)" : ""}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Độ phân giải
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedResolution}
                      onChange={(e) => setSelectedResolution(e.target.value)}
                    >
                      <option value="1K">1K (Tiêu chuẩn)</option>
                      <option value="2K">2K (Sắc nét)</option>
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Số lượng ảnh & Tỷ lệ khung hình */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Số lượng ảnh
                  </label>
                  <div className="flex bg-surface-container-low/50 border border-outline-variant/20 rounded-lg overflow-hidden p-1">
                    {[1, 2, 4].map((num) => (
                      <button
                        key={num}
                        onClick={() => setNumImages(num)}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${
                          numImages === num
                            ? "bg-primary text-white shadow-sm"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Tỷ lệ khung hình
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                    >
                      <option>Tự động</option>
                      <option>1:1 (Vuông)</option>
                      <option>16:9 (Ngang)</option>
                      <option>9:16 (Dọc)</option>
                      <option>4:3 (Ngang)</option>
                      <option>3:4 (Dọc)</option>
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Render Button */}
            <button
              onClick={handleRender}
              disabled={isRendering || !prompt || isUploading}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isRendering ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang xử lý ({Math.round(smoothRenderProgress)}%)...
                </>
              ) : (
                <>
                  <Icon name="auto_awesome" />
                  Thực Hiện Thay Đổi
                </>
              )}
            </button>
          </div>

          {/* Right Panel: Kết Quả */}
          <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
            <h3 className="text-base font-bold text-on-surface mb-4">
              Kết Quả
            </h3>
            <div className="flex-1 bg-surface-container-low/50 rounded-xl flex flex-col items-center justify-center text-center border border-outline-variant/10 overflow-hidden relative">
              {isRendering ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="relative w-24 h-24 mb-6">
                    <svg
                      className="w-full h-full transform -rotate-90"
                      viewBox="0 0 100 100"
                    >
                      <circle
                        className="text-outline-variant/30 stroke-current"
                        strokeWidth="8"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                      ></circle>
                      <circle
                        className="text-primary stroke-current transition-all duration-500 ease-out"
                        strokeWidth="8"
                        strokeLinecap="round"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - smoothRenderProgress / 100)}`}
                      ></circle>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">
                        {Math.round(smoothRenderProgress)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-primary">
                    AI đang xử lý hình ảnh...
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2">
                    Quá trình này có thể mất vài chục giây
                  </p>
                </div>
              ) : resultImage ? (
                <div className="relative w-full h-full group flex items-center justify-center p-2">
                  <div className="relative inline-flex max-w-full max-h-full rounded-xl">
                    <img
                      src={resultImage}
                      alt="Result"
                      className="max-w-full max-h-full object-contain cursor-zoom-in rounded-xl shadow-sm ring-1 ring-black/5"
                      onClick={() => setFullscreenImage(resultImage)}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={handleDownloadResult}
                        className="w-10 h-10 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors shadow-lg"
                        title="Tải xuống"
                      >
                        <Icon name="download" className="text-[20px]" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHistoryItem(
                            editHistory.find((h) => h.edited === resultImage)
                              ?.id || Date.now().toString(),
                            resultImage,
                          );
                        }}
                        className="w-10 h-10 bg-error/70 hover:bg-error backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors shadow-lg"
                        title="Xoá ảnh"
                      >
                        <Icon name="delete" className="text-[20px]" />
                      </button>
                    </div>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInputImage(resultImage);
                          toast.success("Đã chuyển ảnh sang phần chỉnh sửa");
                        }}
                        className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 whitespace-nowrap"
                      >
                        Tiếp Tục Sửa Ảnh Này
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Icon
                    name="image"
                    className="text-4xl text-on-surface-variant/30 mb-4"
                  />
                  <p className="text-sm font-medium text-on-surface-variant/70">
                    Kết quả sẽ hiện ở đây
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : activeSubTab === "Crop để sửa" ? (
        <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-[400px]">
          {/* Left Panel: Chọn Vùng & Mô Tả */}
          <div className="w-full lg:w-[420px] flex flex-col gap-6 shrink-0">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface">
                  1. Chọn Vùng & Mô Tả
                </h3>
                <button
                  onClick={() => setShowLibraryModal(true)}
                  className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Icon name="photo_library" className="text-[16px]" />
                  Thư viện ảnh
                </button>
              </div>

              <div
                className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center group transition-colors cursor-pointer relative overflow-hidden ${inputImage ? "h-auto" : "h-64"} ${
                  isDragging
                    ? "border-primary bg-primary/10"
                    : "border-outline-variant/40 hover:border-primary/50 bg-surface-container-low/50 hover:bg-surface-container-low"
                }`}
                onClick={() => !inputImage && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleImageUpload}
                />

                {isUploading ? (
                  <div className="flex flex-col items-center p-8">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                    <p className="text-sm font-semibold text-primary">
                      Đang tải lên... {Math.round(uploadProgress)}%
                    </p>
                  </div>
                ) : inputImage ? (
                  <div
                    className="relative w-full h-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ReactCrop
                      crop={crop}
                      onChange={(pixelCrop, percentCrop) =>
                        setCrop(percentCrop)
                      }
                      className="max-w-full max-h-[50vh]"
                    >
                      <img
                        src={inputImage}
                        alt="Uploaded"
                        className="max-w-full max-h-[50vh] object-contain"
                        referrerPolicy="no-referrer"
                        onLoad={(e) => setImageRef(e.currentTarget)}
                      />
                    </ReactCrop>
                    <div className="absolute top-2 right-2 flex flex-col gap-2 z-10">
                      <button
                        onClick={() => setFullscreenImage(inputImage)}
                        className="bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-colors shadow-sm"
                        title="Xem toàn màn hình"
                      >
                        <Icon name="fullscreen" className="text-[16px]" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInputImage(null);
                          setCrop(undefined);
                        }}
                        className="bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-colors shadow-sm"
                        title="Ảnh khác"
                      >
                        <Icon name="delete" className="text-[16px]" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform mx-auto">
                      <Icon
                        name="image"
                        className="text-3xl text-on-surface-variant group-hover:text-primary transition-colors"
                      />
                    </div>
                    <p className="text-sm font-semibold text-on-surface mb-1">
                      Nhấp hoặc kéo tệp vào đây
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      PNG, JPG, WEBP
                    </p>
                  </div>
                )}
              </div>

              {inputImage && (
                <div className="mt-4">
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Mô tả thay đổi cho vùng đã chọn:
                  </label>
                  <textarea
                    className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24"
                    placeholder="Ví dụ: Đổi màu tường thành xanh dương, thêm cây xanh góc phòng..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  ></textarea>
                </div>
              )}
            </div>

            {/* Panel 2: Tối ưu Prompt và Thông số */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface">
                  2. Tối ưu Prompt và Thông số
                </h3>
                <div className="relative w-48">
                  <select
                    className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2 text-xs font-medium text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                    value={
                      promptModel
                    }
                    onChange={(e) => setPromptModel(e.target.value)}
                  >
                    <option value="gemini-2.5-flash">
                      Gemini 2.5 Flash
                    </option>
                  </select>
                  <Icon
                    name="keyboard_arrow_down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[16px]"
                  />
                </div>
              </div>

              <button
                onClick={handleGeneratePrompt}
                disabled={isGeneratingPrompt || !inputImage}
                className="relative w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
              >
                {isGeneratingPrompt && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-100 ease-linear"
                    style={{ width: `${Math.min(100, smoothPromptProgress)}%` }}
                  ></div>
                )}
                <div className="relative z-10 flex items-center justify-center gap-2 w-full px-2">
                  {isGeneratingPrompt ? (
                    <div className="flex flex-col items-center justify-center w-full py-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="shrink-0 w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-bold text-base">
                          {Math.floor(Math.min(100, smoothPromptProgress))}%
                        </span>
                      </div>
                      <span className="text-center break-words text-xs sm:text-sm opacity-90 leading-tight">
                        {promptStatus}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="shrink-0">
                        <Icon name="auto_awesome" />
                      </div>
                      <span className="text-center break-words text-sm sm:text-base">
                        Phân tích và hoàn thiện prompt
                      </span>
                    </>
                  )}
                </div>
              </button>

              {/* Prompt Generation (Textarea) */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2">
                  Prompt tạo ảnh hoàn chỉnh:
                </label>
                <textarea
                  className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24"
                  placeholder="Ảnh chụp thực tế công trình, giữ chính xác góc chụp 100% như ảnh đưa vào..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                ></textarea>
              </div>

              {/* Model & Resolution */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    AI Engine
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      <option value="gemini-3.1-flash-image-preview">
                        iGen 3.1 Flash Image Preview
                      </option>
                      <option value="gemini-3-pro-image-preview">
                        iGen 3 Pro Image Preview
                      </option>
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Độ phân giải
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedResolution}
                      onChange={(e) => setSelectedResolution(e.target.value)}
                    >
                      <option value="1K">1K (Tiêu chuẩn)</option>
                      <option value="2K">2K (Sắc nét)</option>
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleRender}
                disabled={
                  isRendering ||
                  !prompt ||
                  !inputImage ||
                  !crop?.width ||
                  !crop?.height
                }
                className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              >
                {isRendering ? (
                  <>
                    <div className="relative w-6 h-6 flex items-center justify-center">
                      <svg
                        className="w-full h-full transform -rotate-90"
                        viewBox="0 0 100 100"
                      >
                        <circle
                          className="text-white/30 stroke-current"
                          strokeWidth="12"
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                        ></circle>
                        <circle
                          className="text-white stroke-current transition-all duration-500 ease-out"
                          strokeWidth="12"
                          strokeLinecap="round"
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - smoothRenderProgress / 100)}`}
                        ></circle>
                      </svg>
                    </div>
                    <span>
                      Đang xử lý ({Math.round(smoothRenderProgress)}%)...
                    </span>
                  </>
                ) : (
                  <>
                    <Icon name="auto_awesome" />
                    Thực Hiện Thay Đổi
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Kết Quả */}
          <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
            <h3 className="text-base font-bold text-on-surface mb-4">
              3. Kết Quả
            </h3>
            <div className="flex-1 bg-surface-container-low/50 rounded-xl flex flex-col items-center justify-center text-center border border-outline-variant/10 overflow-hidden relative">
              {isRendering ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="relative w-24 h-24 mb-6">
                    <svg
                      className="w-full h-full transform -rotate-90"
                      viewBox="0 0 100 100"
                    >
                      <circle
                        className="text-outline-variant/30 stroke-current"
                        strokeWidth="8"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                      ></circle>
                      <circle
                        className="text-primary stroke-current transition-all duration-500 ease-out"
                        strokeWidth="8"
                        strokeLinecap="round"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - smoothRenderProgress / 100)}`}
                      ></circle>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">
                        {Math.round(smoothRenderProgress)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-primary">
                    AI đang xử lý hình ảnh...
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2">
                    Quá trình này có thể mất vài chục giây
                  </p>
                </div>
              ) : resultImage ? (
                <div className="relative w-full h-full group">
                  <img
                    src={resultImage}
                    alt="Result"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setFullscreenImage(resultImage)}
                      className="w-10 h-10 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors shadow-lg"
                      title="Xem toàn màn hình"
                    >
                      <Icon name="fullscreen" className="text-[20px]" />
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
                      className="w-10 h-10 bg-red-500/80 hover:bg-red-600 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors shadow-lg"
                      title="Xoá ảnh"
                    >
                      <Icon name="delete" className="text-[20px]" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Icon
                    name="image"
                    className="text-4xl text-on-surface-variant/30 mb-4"
                  />
                  <p className="text-sm font-medium text-on-surface-variant/70">
                    Kết quả sẽ hiện ở đây
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : activeSubTab === "Thay Thế Model" ? (
        <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-[400px]">
          {/* Left Column */}
          <div className="w-full lg:w-[420px] flex flex-col gap-8 shrink-0">
            {/* Panel 1: Tải Lên Ảnh & Chọn Vùng */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface">
                  1. Tải Lên Ảnh & Chọn Vùng
                </h3>
              </div>
              <div className="flex gap-4">
                {/* Ảnh Gốc */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-on-surface-variant">
                      Ảnh Gốc
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLibraryTarget("input");
                        setShowLibraryModal(true);
                      }}
                      className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Icon name="photo_library" className="text-[12px]" />
                      Thư viện ảnh
                    </button>
                  </div>
                  <div
                    className={`h-48 border-2 border-dashed ${isDragging ? "border-primary bg-primary/5" : "border-outline-variant/40 bg-surface-container-low/50"} rounded-xl flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-colors cursor-pointer hover:bg-surface-container-low relative overflow-hidden`}
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleImageDrop}
                    onDragOver={handleImageDragOver}
                    onDragLeave={handleImageDragLeave}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/png, image/jpeg, image/webp, application/pdf"
                      onChange={handleImageUpload}
                    />
                    {isUploading ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-sm font-semibold text-primary">
                          Đang tải lên... {Math.round(uploadProgress)}%
                        </p>
                      </div>
                    ) : inputImage ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={inputImage}
                          alt="Original"
                          className="w-full h-full object-contain p-2 cursor-zoom-in"
                          referrerPolicy="no-referrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFullscreenImage(inputImage);
                          }}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none">
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                          >
                            <Icon name="upload" className="text-sm" /> Tải lên
                            khác
                          </button>
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLibraryTarget("input");
                              setShowLibraryModal(true);
                            }}
                          >
                            <Icon name="photo_library" className="text-sm" /> Từ
                            thư viện
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                          <Icon
                            name="image"
                            className="text-2xl text-on-surface-variant group-hover:text-primary transition-colors"
                          />
                        </div>
                        <p className="text-sm font-semibold text-on-surface mb-1">
                          Tải ảnh gốc
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Ảnh Model Thay Thế */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-on-surface-variant">
                      Ảnh Model Thay Thế
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLibraryTarget("reference");
                        setShowLibraryModal(true);
                      }}
                      className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Icon name="photo_library" className="text-[12px]" />
                      Thư viện ảnh
                    </button>
                  </div>
                  <div
                    className={`h-48 border-2 border-dashed ${isDraggingRef ? "border-primary bg-primary/5" : "border-outline-variant/40 bg-surface-container-low/50"} rounded-xl flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-colors cursor-pointer hover:bg-surface-container-low relative overflow-hidden`}
                    onClick={() => refInputRef.current?.click()}
                    onDrop={handleRefImageDrop}
                    onDragOver={handleRefImageDragOver}
                    onDragLeave={handleRefImageDragLeave}
                  >
                    <input
                      type="file"
                      ref={refInputRef}
                      className="hidden"
                      accept="image/png, image/jpeg, image/webp, application/pdf"
                      onChange={handleRefImageUpload}
                    />
                    {isUploadingRef ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-sm font-semibold text-primary">
                          Đang tải lên... {Math.round(uploadProgressRef)}%
                        </p>
                      </div>
                    ) : referenceImage ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={referenceImage}
                          alt="Reference Model"
                          className="w-full h-full object-contain p-2 cursor-zoom-in"
                          referrerPolicy="no-referrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFullscreenImage(referenceImage);
                          }}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none">
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              refInputRef.current?.click();
                            }}
                          >
                            <Icon name="upload" className="text-sm" /> Tải lên
                            khác
                          </button>
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLibraryTarget("reference");
                              setShowLibraryModal(true);
                            }}
                          >
                            <Icon name="photo_library" className="text-sm" /> Từ
                            thư viện
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                          <Icon
                            name="view_in_ar"
                            className="text-2xl text-on-surface-variant group-hover:text-primary transition-colors"
                          />
                        </div>
                        <p className="text-sm font-semibold text-on-surface mb-1">
                          Tải ảnh model
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 2: Mô Tả Thay Thế */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
              <h3 className="text-base font-bold text-on-surface mb-4">
                2. Mô Tả Thay Thế
              </h3>
              <textarea
                className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24 mb-4"
                placeholder="(Ví dụ 1): Thay bộ bàn ăn hiện tại sang bộ bàn ăn ở ảnh đính kèm.&#10;(Ví dụ 2): Chọn các gợi ý biên dưới ↓"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
              <div className="flex flex-wrap gap-2">
                {[
                  "Thay thế cái ghế này bằng cái ghế trong ảnh tham chiếu",
                  "Thay thế cái bàn hiện tại thành cái bàn trong ảnh đính kèm",
                  "Thay thế chiếc xe ô tô bằng mẫu xe trong ảnh",
                  "Thay thế chậu cây trang trí bằng chậu cây mẫu",
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setDescription(suggestion)}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/20 rounded-full text-xs text-on-surface-variant transition-colors text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel 3: Tối ưu Prompt và Thông số */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface">
                  3. Tối ưu prompt và Thông số
                </h3>
                <div className="relative w-48">
                  <select
                    className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2 text-xs font-medium text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                    value={promptModel}
                    onChange={(e) => setPromptModel(e.target.value)}
                  >
                    <option value="gemini-2.5-flash">
                      Gemini 2.5 Flash
                    </option>
                  </select>
                  <Icon
                    name="keyboard_arrow_down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[16px]"
                  />
                </div>
              </div>

              <button
                onClick={handleGeneratePrompt}
                disabled={isGeneratingPrompt || !inputImage || !referenceImage}
                className="relative w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
              >
                {isGeneratingPrompt && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-100 ease-linear"
                    style={{ width: `${Math.min(100, smoothPromptProgress)}%` }}
                  ></div>
                )}
                <div className="relative z-10 flex items-center justify-center gap-2 w-full px-2">
                  {isGeneratingPrompt ? (
                    <div className="flex flex-col items-center justify-center w-full py-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="shrink-0 w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-bold text-base">
                          {Math.floor(Math.min(100, smoothPromptProgress))}%
                        </span>
                      </div>
                      <span className="text-center break-words text-xs sm:text-sm opacity-90 leading-tight">
                        {promptStatus}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="shrink-0">
                        <Icon name="auto_awesome" />
                      </div>
                      <span className="text-center break-words text-sm sm:text-base">
                        Phân tích và hoàn thiện prompt
                      </span>
                    </>
                  )}
                </div>
              </button>

              {/* Prompt Generation (Textarea) */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2">
                  Prompt tạo ảnh hoàn chỉnh:
                </label>
                <textarea
                  className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24"
                  placeholder="Ảnh chụp thực tế công trình, giữ chính xác góc chụp 100% như ảnh đưa vào..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                ></textarea>
              </div>

              {/* Model & Resolution */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    AI Engine
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      {GEMINI_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} {model.isPro ? "(Pro)" : ""}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Độ phân giải
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedResolution}
                      onChange={(e) => setSelectedResolution(e.target.value)}
                    >
                      {RESOLUTIONS.map((res) => (
                        <option key={res.id} value={res.id}>
                          {res.name}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Số lượng ảnh & Tỷ lệ khung hình */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Số lượng ảnh
                  </label>
                  <div className="flex bg-surface-container-low/50 border border-outline-variant/20 rounded-lg overflow-hidden p-1">
                    {[1, 2, 4].map((num) => (
                      <button
                        key={num}
                        onClick={() => setNumImages(num)}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${
                          numImages === num
                            ? "bg-primary text-white shadow-sm"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Tỷ lệ khung hình
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                    >
                      <option>Tự động</option>
                      <option>1:1 (Vuông)</option>
                      <option>16:9 (Ngang)</option>
                      <option>9:16 (Dọc)</option>
                      <option>4:3 (Ngang)</option>
                      <option>3:4 (Dọc)</option>
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Render Button */}
            <button
              onClick={handleRender}
              disabled={
                isRendering || !prompt || !inputImage || !referenceImage
              }
              className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isRendering ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Icon name="auto_awesome" />
                  Thay Thế Model
                </>
              )}
            </button>
          </div>

          {/* Right Panel: Kết Quả */}
          <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
            <h3 className="text-base font-bold text-on-surface mb-4">
              4. Kết Quả
            </h3>
            <div className="flex-1 bg-surface-container-low/50 rounded-xl flex flex-col items-center justify-center text-center border border-outline-variant/10 overflow-hidden relative">
              {isRendering ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium text-primary">
                    AI đang xử lý hình ảnh...
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2">
                    Quá trình này có thể mất vài chục giây
                  </p>
                </div>
              ) : resultImage ? (
                <div className="relative w-full h-full group">
                  <img
                    src={resultImage}
                    alt="Result"
                    className="w-full h-full object-contain cursor-zoom-in"
                    onClick={() => setFullscreenImage(resultImage)}
                  />
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
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Icon
                    name="image"
                    className="text-4xl text-on-surface-variant/30 mb-4"
                  />
                  <p className="text-sm font-medium text-on-surface-variant/70">
                    Kết quả sẽ hiện ở đây
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : activeSubTab === "Thêm Đối Tượng" ? (
        <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-[400px]">
          {/* Left Column */}
          <div className="w-full lg:w-[420px] flex flex-col gap-8 shrink-0">
            {/* Panel 1: Tải Lên Ảnh & Chọn Vùng */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface">
                  1. Tải Lên Ảnh & Chọn Vùng
                </h3>
              </div>
              <div className="flex gap-4">
                {/* Ảnh Nền */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-on-surface-variant">
                      Ảnh Nền
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLibraryTarget("input");
                        setShowLibraryModal(true);
                      }}
                      className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Icon name="photo_library" className="text-[12px]" />
                      Thư viện ảnh
                    </button>
                  </div>
                  <div
                    className={`h-48 border-2 border-dashed ${isDragging ? "border-primary bg-primary/5" : "border-outline-variant/40 bg-surface-container-low/50"} rounded-xl flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-colors cursor-pointer hover:bg-surface-container-low relative overflow-hidden`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files?.[0])
                        handleImageUpload({
                          target: { files: e.dataTransfer.files },
                        } as unknown as React.ChangeEvent<HTMLInputElement>);
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/png, image/jpeg, image/webp, application/pdf"
                      onChange={handleImageUpload}
                    />
                    {isUploading ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-sm font-semibold text-primary">
                          Đang tải lên... {Math.round(uploadProgress)}%
                        </p>
                      </div>
                    ) : inputImage ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={inputImage}
                          alt="Background"
                          className="w-full h-full object-contain p-2 cursor-zoom-in"
                          referrerPolicy="no-referrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFullscreenImage(inputImage);
                          }}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none">
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                          >
                            <Icon name="upload" className="text-sm" /> Tải lên
                            khác
                          </button>
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLibraryTarget("input");
                              setShowLibraryModal(true);
                            }}
                          >
                            <Icon name="photo_library" className="text-sm" /> Từ
                            thư viện
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                          <Icon
                            name="image"
                            className="text-2xl text-on-surface-variant group-hover:text-primary transition-colors"
                          />
                        </div>
                        <p className="text-sm font-semibold text-on-surface">
                          {isDragging ? "Thả ảnh vào đây" : "Tải ảnh nền"}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Ảnh Đối Tượng */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-on-surface-variant">
                      Ảnh Đối Tượng
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLibraryTarget("reference");
                        setShowLibraryModal(true);
                      }}
                      className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Icon name="photo_library" className="text-[12px]" />
                      Thư viện ảnh
                    </button>
                  </div>
                  <div
                    className={`h-48 border-2 border-dashed ${isDraggingRef ? "border-primary bg-primary/5" : "border-outline-variant/40 bg-surface-container-low/50"} rounded-xl flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-colors cursor-pointer hover:bg-surface-container-low relative overflow-hidden`}
                    onClick={() => refInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingRef(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingRef(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingRef(false);
                      if (e.dataTransfer.files?.[0])
                        handleRefImageUpload({
                          target: { files: e.dataTransfer.files },
                        } as unknown as React.ChangeEvent<HTMLInputElement>);
                    }}
                  >
                    <input
                      type="file"
                      ref={refInputRef}
                      className="hidden"
                      accept="image/png, image/jpeg, image/webp, application/pdf"
                      onChange={handleRefImageUpload}
                    />
                    {isUploadingRef ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-sm font-semibold text-primary">
                          Đang tải lên... {Math.round(uploadProgressRef)}%
                        </p>
                      </div>
                    ) : referenceImage ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={referenceImage}
                          alt="Object"
                          className="w-full h-full object-contain p-2 cursor-zoom-in"
                          referrerPolicy="no-referrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFullscreenImage(referenceImage);
                          }}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none">
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              refInputRef.current?.click();
                            }}
                          >
                            <Icon name="upload" className="text-sm" /> Tải lên
                            khác
                          </button>
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLibraryTarget("reference");
                              setShowLibraryModal(true);
                            }}
                          >
                            <Icon name="photo_library" className="text-sm" /> Từ
                            thư viện
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                          <Icon
                            name="add_photo_alternate"
                            className="text-2xl text-on-surface-variant group-hover:text-primary transition-colors"
                          />
                        </div>
                        <p className="text-sm font-semibold text-on-surface">
                          {isDraggingRef
                            ? "Thả ảnh vào đây"
                            : "Tải ảnh đối tượng"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 2: Mô Tả Vị Trí */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
              <h3 className="text-base font-bold text-on-surface mb-4">
                2. Mô Tả Vị Trí
              </h3>
              <textarea
                className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24 mb-4"
                placeholder="(Ví dụ 1): Thêm người phụ nữ đang ngồi đọc sách trên sofa.&#10;(Ví dụ 2): Chọn một trong các câu gợi ý mẫu biên dưới ↓"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
              <div className="flex flex-wrap gap-2">
                {[
                  "(Gợi ý mẫu): Thêm con chó vào bãi cỏ phía trước nhà",
                  "(Gợi ý mẫu): Đặt chiếc ghế sofa này vào góc phòng khách",
                  "(Gợi ý mẫu): Thêm người đang đi bộ trên vỉa hè",
                  "(Gợi ý mẫu): Thêm chiếc xe hơi đậu ở gara",
                  "(Gợi ý mẫu): Đặt lọ hoa này lên bàn ăn",
                  "(Gợi ý mẫu): Thêm một con mèo đang nằm ngủ trên ghế",
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setDescription(suggestion)}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/20 rounded-full text-xs text-on-surface-variant transition-colors text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel 3: Tối ưu Prompt và Thông số */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface">
                  3. Tối ưu prompt và Thông số
                </h3>
                <div className="relative w-48">
                  <select
                    className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2 text-xs font-medium text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                    value={promptModel}
                    onChange={(e) => setPromptModel(e.target.value)}
                  >
                    <option value="gemini-2.5-flash">
                      Gemini 2.5 Flash
                    </option>
                  </select>
                  <Icon
                    name="keyboard_arrow_down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[16px]"
                  />
                </div>
              </div>

              <button
                onClick={handleGeneratePrompt}
                disabled={isGeneratingPrompt || !inputImage || !referenceImage}
                className="relative w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
              >
                {isGeneratingPrompt && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-100 ease-linear"
                    style={{ width: `${Math.min(100, smoothPromptProgress)}%` }}
                  ></div>
                )}
                <div className="relative z-10 flex items-center justify-center gap-2 w-full px-2">
                  {isGeneratingPrompt ? (
                    <div className="flex flex-col items-center justify-center w-full py-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="shrink-0 w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-bold text-base">
                          {Math.floor(Math.min(100, smoothPromptProgress))}%
                        </span>
                      </div>
                      <span className="text-center break-words text-xs sm:text-sm opacity-90 leading-tight">
                        {promptStatus}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="shrink-0">
                        <Icon name="auto_awesome" />
                      </div>
                      <span className="text-center break-words text-sm sm:text-base">
                        Phân tích và hoàn thiện prompt
                      </span>
                    </>
                  )}
                </div>
              </button>

              {/* Prompt Generation (Textarea) */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2">
                  Prompt tạo ảnh hoàn chỉnh:
                </label>
                <textarea
                  className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24"
                  placeholder="Ảnh chụp thực tế công trình, giữ chính xác góc chụp 100% như ảnh đưa vào..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                ></textarea>
              </div>

              {/* Model & Resolution */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    AI Engine
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      {GEMINI_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} {model.isPro ? "(Pro)" : ""}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Độ phân giải
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedResolution}
                      onChange={(e) => setSelectedResolution(e.target.value)}
                    >
                      {RESOLUTIONS.map((res) => (
                        <option key={res.id} value={res.id}>
                          {res.name}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Số lượng ảnh & Tỷ lệ khung hình */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Số lượng ảnh
                  </label>
                  <div className="flex bg-surface-container-low/50 border border-outline-variant/20 rounded-lg overflow-hidden p-1">
                    {[1, 2, 4].map((num) => (
                      <button
                        key={num}
                        onClick={() => setNumImages(num)}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${
                          numImages === num
                            ? "bg-primary text-white shadow-sm"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Tỷ lệ khung hình
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                    >
                      <option>Tự động</option>
                      <option>1:1 (Vuông)</option>
                      <option>16:9 (Ngang)</option>
                      <option>9:16 (Dọc)</option>
                      <option>4:3 (Ngang)</option>
                      <option>3:4 (Dọc)</option>
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Render Button */}
            <button
              onClick={handleRender}
              disabled={
                isRendering || !prompt || !inputImage || !referenceImage
              }
              className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isRendering ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Icon name="auto_awesome" />
                  Thêm Đối Tượng
                </>
              )}
            </button>
          </div>

          {/* Right Panel: Kết Quả */}
          <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
            <h3 className="text-base font-bold text-on-surface mb-4">
              4. Kết Quả
            </h3>
            <div className="flex-1 bg-surface-container-low/50 rounded-xl flex flex-col items-center justify-center text-center border border-outline-variant/10 overflow-hidden relative">
              {isRendering ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium text-primary">
                    AI đang xử lý hình ảnh...
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2">
                    Quá trình này có thể mất vài chục giây
                  </p>
                </div>
              ) : resultImage ? (
                <div className="relative w-full h-full group">
                  <img
                    src={resultImage}
                    alt="Result"
                    className="w-full h-full object-contain cursor-zoom-in"
                    onClick={() => setFullscreenImage(resultImage)}
                  />
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
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Icon
                    name="image"
                    className="text-4xl text-on-surface-variant/30 mb-4"
                  />
                  <p className="text-sm font-medium text-on-surface-variant/70">
                    Kết quả sẽ hiện ở đây
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : activeSubTab === "Đổi Vật Liệu" ? (
        <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-[400px]">
          {/* Left Column */}
          <div className="w-full lg:w-[420px] flex flex-col gap-8 shrink-0">
            {/* Panel 1: Tải Lên Ảnh & Chọn Vùng */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface">
                  1. Tải Lên Ảnh & Chọn Vùng
                </h3>
              </div>
              <div className="flex gap-4">
                {/* Ảnh Gốc */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-on-surface-variant">
                      Ảnh Gốc
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLibraryTarget("input");
                        setShowLibraryModal(true);
                      }}
                      className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Icon name="photo_library" className="text-[12px]" />
                      Thư viện ảnh
                    </button>
                  </div>
                  <div
                    className={`h-48 border-2 border-dashed ${isDragging ? "border-primary bg-primary/5" : "border-outline-variant/40 bg-surface-container-low/50"} rounded-xl flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-colors cursor-pointer hover:bg-surface-container-low relative overflow-hidden`}
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleImageDrop}
                    onDragOver={handleImageDragOver}
                    onDragLeave={handleImageDragLeave}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/png, image/jpeg, image/webp, application/pdf"
                      onChange={handleImageUpload}
                    />
                    {isUploading ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-sm font-semibold text-primary">
                          Đang tải lên... {Math.round(uploadProgress)}%
                        </p>
                      </div>
                    ) : inputImage ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={inputImage}
                          alt="Original"
                          className="w-full h-full object-contain p-2 cursor-zoom-in"
                          referrerPolicy="no-referrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFullscreenImage(inputImage);
                          }}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none">
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                          >
                            <Icon name="upload" className="text-sm" /> Tải lên
                            khác
                          </button>
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLibraryTarget("input");
                              setShowLibraryModal(true);
                            }}
                          >
                            <Icon name="photo_library" className="text-sm" /> Từ
                            thư viện
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                          <Icon
                            name="image"
                            className="text-2xl text-on-surface-variant group-hover:text-primary transition-colors"
                          />
                        </div>
                        <p className="text-sm font-semibold text-on-surface">
                          {isDragging ? "Thả ảnh vào đây" : "Tải ảnh gốc"}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Ảnh Tham Khảo */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-on-surface-variant">
                      Ảnh Tham Khảo (Tùy chọn)
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLibraryTarget("reference");
                        setShowLibraryModal(true);
                      }}
                      className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Icon name="photo_library" className="text-[12px]" />
                      Thư viện ảnh
                    </button>
                  </div>
                  <div
                    className={`h-48 border-2 border-dashed ${isDraggingRef ? "border-primary bg-primary/5" : "border-outline-variant/40 bg-surface-container-low/50"} rounded-xl flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-colors cursor-pointer hover:bg-surface-container-low relative overflow-hidden`}
                    onClick={() => refInputRef.current?.click()}
                    onDrop={handleRefImageDrop}
                    onDragOver={handleRefImageDragOver}
                    onDragLeave={handleRefImageDragLeave}
                  >
                    <input
                      type="file"
                      ref={refInputRef}
                      className="hidden"
                      accept="image/png, image/jpeg, image/webp, application/pdf"
                      onChange={handleRefImageUpload}
                    />
                    {isUploadingRef ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-sm font-semibold text-primary">
                          Đang tải lên... {Math.round(uploadProgressRef)}%
                        </p>
                      </div>
                    ) : referenceImage ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={referenceImage}
                          alt="Reference"
                          className="w-full h-full object-contain p-2 cursor-zoom-in"
                          referrerPolicy="no-referrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFullscreenImage(referenceImage);
                          }}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none">
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              refInputRef.current?.click();
                            }}
                          >
                            <Icon name="upload" className="text-sm" /> Tải lên
                            khác
                          </button>
                          <button
                            className="text-white text-xs font-medium flex items-center gap-2 bg-primary/80 hover:bg-primary px-3 py-2 rounded-lg pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLibraryTarget("reference");
                              setShowLibraryModal(true);
                            }}
                          >
                            <Icon name="photo_library" className="text-sm" /> Từ
                            thư viện
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                          <Icon
                            name="texture"
                            className="text-2xl text-on-surface-variant group-hover:text-primary transition-colors"
                          />
                        </div>
                        <p className="text-sm font-semibold text-on-surface">
                          {isDraggingRef ? "Thả ảnh vào đây" : "Tải tham khảo"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 2: Mô Tả */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
              <h3 className="text-base font-bold text-on-surface mb-4">
                2. Mô Tả Vật Liệu
              </h3>
              <textarea
                className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24 mb-4"
                placeholder="(Ví dụ 1): Thay đổi chất liệu ghế sofa sang vải nỉ màu xám.&#10;(Ví dụ 2): Chọn một trong các câu gợi ý bên dưới ↓"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
              <div className="flex flex-wrap gap-2">
                {[
                  "(Gợi ý mẫu): Đổi màu sơn tường thành màu xanh dương",
                  "(Gợi ý mẫu): Đổi vật liệu sàn gạch thành sàn gỗ óc chó",
                  "(Gợi ý mẫu): Ốp gạch mặt tiền bằng vật liệu đá marble trắng",
                  "(Gợi ý mẫu): Đổi mái ngói màu xám thành mái ngói màu đỏ",
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setDescription(suggestion)}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/20 rounded-full text-xs text-on-surface-variant transition-colors text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel 3: Tối ưu Prompt và Thông số */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface">
                  3. Tối ưu prompt và Thông số
                </h3>
                <div className="relative w-48">
                  <select
                    className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2 text-xs font-medium text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                    value={promptModel}
                    onChange={(e) => setPromptModel(e.target.value)}
                  >
                    <option value="gemini-2.5-flash">
                      Gemini 2.5 Flash
                    </option>
                  </select>
                  <Icon
                    name="keyboard_arrow_down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[16px]"
                  />
                </div>
              </div>

              <button
                onClick={handleGeneratePrompt}
                disabled={isGeneratingPrompt || !inputImage}
                className="relative w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
              >
                {isGeneratingPrompt && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-100 ease-linear"
                    style={{ width: `${Math.min(100, smoothPromptProgress)}%` }}
                  ></div>
                )}
                <div className="relative z-10 flex items-center justify-center gap-2 w-full px-2">
                  {isGeneratingPrompt ? (
                    <div className="flex flex-col items-center justify-center w-full py-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="shrink-0 w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-bold text-base">
                          {Math.floor(Math.min(100, smoothPromptProgress))}%
                        </span>
                      </div>
                      <span className="text-center break-words text-xs sm:text-sm opacity-90 leading-tight">
                        {promptStatus}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="shrink-0">
                        <Icon name="auto_awesome" />
                      </div>
                      <span className="text-center break-words text-sm sm:text-base">
                        Phân tích và hoàn thiện prompt
                      </span>
                    </>
                  )}
                </div>
              </button>

              {/* Prompt Generation (Textarea) */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2">
                  Prompt tạo ảnh hoàn chỉnh:
                </label>
                <textarea
                  className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24"
                  placeholder="Ảnh chụp thực tế công trình, giữ chính xác góc chụp 100% như ảnh đưa vào..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                ></textarea>
              </div>

              {/* Model & Resolution */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    AI Engine
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      {GEMINI_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} {model.isPro ? "(Pro)" : ""}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Độ phân giải
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedResolution}
                      onChange={(e) => setSelectedResolution(e.target.value)}
                    >
                      {RESOLUTIONS.map((res) => (
                        <option key={res.id} value={res.id}>
                          {res.name}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Số lượng ảnh & Tỷ lệ khung hình */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Số lượng ảnh
                  </label>
                  <div className="flex bg-surface-container-low/50 border border-outline-variant/20 rounded-lg overflow-hidden p-1">
                    {[1, 2, 4].map((num) => (
                      <button
                        key={num}
                        onClick={() => setNumImages(num)}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${
                          numImages === num
                            ? "bg-primary text-white shadow-sm"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Tỷ lệ khung hình
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                    >
                      <option>Tự động</option>
                      <option>1:1 (Vuông)</option>
                      <option>16:9 (Ngang)</option>
                      <option>9:16 (Dọc)</option>
                      <option>4:3 (Ngang)</option>
                      <option>3:4 (Dọc)</option>
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Render Button */}
            <button
              onClick={handleRender}
              disabled={isRendering || !prompt || !inputImage}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isRendering ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Icon name="auto_awesome" />
                  Đổi Vật Liệu / Màu Sơn
                </>
              )}
            </button>
          </div>

          {/* Right Panel: Kết Quả */}
          <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
            <h3 className="text-base font-bold text-on-surface mb-4">
              Kết Quả
            </h3>
            <div className="flex-1 bg-surface-container-low/50 rounded-xl flex flex-col items-center justify-center text-center border border-outline-variant/10 overflow-hidden relative">
              {isRendering ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium text-primary">
                    AI đang xử lý hình ảnh...
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2">
                    Quá trình này có thể mất vài chục giây
                  </p>
                </div>
              ) : resultImage ? (
                <div className="relative w-full h-full group">
                  <img
                    src={resultImage}
                    alt="Result"
                    className="w-full h-full object-contain cursor-zoom-in"
                    onClick={() => setFullscreenImage(resultImage)}
                  />
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
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Icon
                    name="swap_horiz"
                    className="text-4xl text-on-surface-variant/30 mb-4"
                  />
                  <p className="text-sm font-medium text-on-surface-variant/70">
                    Kết quả thay đổi vật liệu sẽ xuất hiện ở đây.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : activeSubTab === "Ghi Chú" ? (
        <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-[400px]">
          {/* Left Column */}
          <div className="w-full lg:w-[420px] flex flex-col gap-8 shrink-0">
            {/* Panel 1: Ảnh Gốc & Ghi Chú */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface">
                  1. Ảnh Gốc & Ghi Chú
                </h3>
                <button
                  onClick={() => {
                    setLibraryTarget("input");
                    setShowLibraryModal(true);
                  }}
                  className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Icon name="photo_library" className="text-[16px]" />
                  Thư viện ảnh
                </button>
              </div>

              {/* Image Upload Area */}
              <div
                className={`relative flex-1 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 min-h-[200px] transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : inputImage
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant/30 hover:border-primary/50 cursor-pointer bg-surface-container-low/50"
                }`}
                onClick={() => !inputImage && fileInputRef.current?.click()}
                onDrop={handleImageDrop}
                onDragOver={handleImageDragOver}
                onDragLeave={handleImageDragLeave}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp, application/pdf"
                  onChange={handleImageUpload}
                />
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                    <p className="text-sm font-semibold text-primary">
                      Đang tải lên... {Math.round(uploadProgress)}%
                    </p>
                  </div>
                ) : inputImage ? (
                  <div className="relative w-full h-full group">
                    <img
                      src={annotatedImage || inputImage}
                      alt="Original"
                      className="w-full h-full object-contain rounded-lg"
                    />

                    <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-lg">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsAnnotating(true);
                        }}
                        className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors"
                      >
                        <Icon name="edit" className="text-[18px]" />
                        Bắt Đầu Ghi Chú
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInputImage(null);
                          setAnnotatedImage(null);
                        }}
                        className="bg-white text-error px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-100 transition-colors"
                      >
                        <Icon name="delete" className="text-[18px]" />
                        Ảnh Khác
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Icon
                      name="add_photo_alternate"
                      className="text-4xl text-on-surface-variant/50 mb-4 pointer-events-none"
                    />
                    <p className="text-sm font-medium text-on-surface-variant mb-2 pointer-events-none">
                      Kéo thả ảnh vào đây
                    </p>
                    <p className="text-xs text-on-surface-variant/70 mb-4 pointer-events-none">
                      hoặc
                    </p>
                    <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors pointer-events-none">
                      Tải ảnh lên
                    </button>
                  </>
                )}
              </div>

              {/* Render Button */}
              <button
                onClick={handleRender}
                disabled={isRendering || !inputImage}
                className="relative w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 overflow-hidden"
              >
                {isRendering && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-100 ease-linear"
                    style={{ width: `${Math.min(100, smoothRenderProgress)}%` }}
                  ></div>
                )}
                <div className="relative z-10 flex items-center justify-center gap-2 w-full px-2">
                  {isRendering ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Đang xử lý... {Math.round(smoothRenderProgress)}%
                    </>
                  ) : (
                    <>
                      <Icon name="auto_awesome" />
                      Thực Hiện Chỉnh Sửa
                    </>
                  )}
                </div>
              </button>

              {/* Model & Resolution */}
              <div className="grid grid-cols-2 gap-4 pt-4 mt-6 border-t border-outline-variant/20">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    AI Engine
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      {GEMINI_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} {model.isPro ? "(Pro)" : ""}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    Độ phân giải
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                      value={selectedResolution}
                      onChange={(e) => setSelectedResolution(e.target.value)}
                    >
                      {RESOLUTIONS.map((res) => (
                        <option key={res.id} value={res.id}>
                          {res.name}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="keyboard_arrow_down"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Kết Quả */}
          <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
            <h3 className="text-base font-bold text-on-surface mb-4">
              2. Kết Quả
            </h3>
            <div className="flex-1 bg-surface-container-low/50 rounded-xl flex flex-col items-center justify-center text-center border border-outline-variant/10 overflow-hidden relative">
              {isRendering ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium text-primary">
                    AI đang xử lý hình ảnh...
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2">
                    Quá trình này có thể mất vài chục giây
                  </p>
                </div>
              ) : resultImage ? (
                <div className="relative w-full h-full group">
                  <img
                    src={resultImage}
                    alt="Result"
                    className="w-full h-full object-contain cursor-zoom-in"
                    onClick={() => setFullscreenImage(resultImage)}
                  />
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
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Icon
                    name="image"
                    className="text-4xl text-on-surface-variant/30 mb-4"
                  />
                  <p className="text-sm font-medium text-on-surface-variant/70">
                    Kết quả sẽ hiện ở đây
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-[400px]">
          <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col items-center justify-center p-6 shadow-sm">
            <Icon
              name="construction"
              className="text-6xl text-on-surface-variant/30 mb-4"
            />
            <p className="text-lg font-bold text-on-surface">
              Tính năng đang phát triển
            </p>
            <p className="text-sm text-on-surface-variant">
              Vui lòng quay lại sau.
            </p>
          </div>
        </div>
      )}

      {/* History Panel */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 flex flex-col min-h-[120px] shadow-sm">
        <h3 className="text-base font-bold text-on-surface mb-4">
          Lịch Sử Chỉnh Sửa
        </h3>
        {editHistory.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {editHistory.slice(0, 20).map((item) => (
              <div
                key={item.id}
                className="w-48 shrink-0 bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 relative group"
              >
                <div
                  className="aspect-video bg-black/5 rounded-lg mb-3 overflow-hidden cursor-zoom-in relative"
                  onClick={() => setResultImage(item.edited)}
                >
                  <img
                    src={item.edited}
                    alt="History"
                    className="w-full h-full object-contain hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullscreenImage(item.edited);
                      }}
                      className="w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors shadow-sm"
                      title="Xem toàn màn hình"
                    >
                      <Icon name="fullscreen" className="text-[16px]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteHistoryItem(item.id, item.edited);
                      }}
                      className="w-8 h-8 bg-error/70 hover:bg-error backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors shadow-sm"
                      title="Xoá ảnh"
                    >
                      <Icon name="delete" className="text-[16px]" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-on-surface">
                    {item.type}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    {item.timestamp.split(" ")[1]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm font-medium text-on-surface-variant/70 flex items-center gap-2">
              <Icon name="history" className="text-lg" />
              Chưa có lịch sử chỉnh sửa.
            </p>
          </div>
        )}
      </div>

      <ImageLibraryModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        onSelectImages={(urls) => {
          if (urls.length > 0) {
            if (libraryTarget === "input") {
              setInputImage(urls[0]);
              setAnnotatedImage(null);
            } else if (libraryTarget === "reference") {
              setReferenceImage(urls[0]);
            }
          }
        }}
      />

      {isAnnotating && inputImage && (
        <ImageAnnotator
          imageUrl={annotatedImage || inputImage}
          onSave={(dataUrl, maskUrl) => {
            setAnnotatedImage(dataUrl);
            if (maskUrl) setAnnotationMask(maskUrl);
            setIsAnnotating(false);
          }}
          onCancel={() => setIsAnnotating(false)}
        />
      )}

      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-50"
            onClick={() => setFullscreenImage(null)}
          >
            <Icon name="close" className="text-2xl" />
          </button>

          <div
            className="relative max-w-full max-h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {activeSubTab === "Crop để sửa" &&
            fullscreenImage === inputImage ? (
              <ReactCrop
                crop={crop}
                onChange={(pixelCrop, percentCrop) => setCrop(percentCrop)}
                className="max-w-full max-h-[90vh]"
              >
                <img
                  src={fullscreenImage}
                  alt="Fullscreen"
                  className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                  onLoad={(e) => setImageRef(e.currentTarget)}
                />
              </ReactCrop>
            ) : (
              <img
                src={fullscreenImage}
                alt="Fullscreen"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const LayoutTabContent: React.FC = () => {
  const { user } = useAuth();
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [presentationStyle, setPresentationStyle] = useState(
    "Minimalist (Tối giản)",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState<{
    toolName: string;
    progress: number;
    status: string;
  } | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isGenerating) {
      interval = setInterval(() => {
        setGeneratingStatus((prev) => {
          if (!prev) return prev;
          if (prev.progress >= 99) return prev;
          
          let increment: number;
          if (prev.progress < 30) increment = 0.5;
          else if (prev.progress < 80) increment = 0.2;
          else increment = 0.05;

          return { ...prev, progress: Math.min(99, prev.progress + increment) };
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const [generatedImages, setGeneratedImages] = useState<
    { url: string; toolName: string; timestamp: string; storagePath?: string }[]
  >(() => {
    const saved = localStorage.getItem("iGen_layoutGeneratedImages");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(
      "iGen_layoutGeneratedImages",
      JSON.stringify(generatedImages.slice(0, 20)),
    );
  }, [generatedImages]);
  const [isDragging, setIsDragging] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error("Vui lòng đăng nhập để tải ảnh lên.");
      return;
    }

    if (!(await checkUserCredits())) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const downloadURL = await uploadMedia(file, "uploads");
      cacheImage(downloadURL, file);
      setInputImage(downloadURL);
      setIsUploading(false);
    } catch (error) {
      console.error("Error initiating upload:", error);
      setIsUploading(false);
      toast.error("Đã xảy ra lỗi.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Vui lòng tải lên một tệp hình ảnh hợp lệ.");
      return;
    }

    if (!user) {
      toast.error("Vui lòng đăng nhập để tải ảnh lên.");
      return;
    }

    if (!(await checkUserCredits())) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const downloadURL = await uploadMedia(file, "uploads");
      cacheImage(downloadURL, file);
      setInputImage(downloadURL);
      setIsUploading(false);
    } catch (error) {
      console.error("Error initiating upload:", error);
      setIsUploading(false);
      toast.error("Đã xảy ra lỗi.");
    }
  };

  const handleGenerate = async (toolName: string) => {
    if (!inputImage) {
      toast.error("Vui lòng tải ảnh công trình lên trước.");
      return;
    }

    setIsGenerating(true);
    setGeneratingStatus({
      toolName,
      progress: 10,
      status: "Đang chuẩn bị dữ liệu...",
    });

    let requestContents: unknown = null;
    let requestConfig: Record<string, unknown> | null = null;

    try {
      const ai = await getAIClient(selectedModel);
      let imageData = await getImageBase64(inputImage);
      // Downscale to 2K to ensure Gemini never throws INVALID_ARGUMENT due to oversized inputs
      imageData = await scaleToResolution(
        imageData.base64Data,
        imageData.mimeType,
        "2K",
      );

      setGeneratingStatus({
        toolName,
        progress: 30,
        status: "Đang chờ AI xử lý (có thể mất vài chục giây)...",
      });

      let prompt = `Create a professional architectural presentation board based on the provided image. The presentation style should be ${presentationStyle}. `;
      const apiAspectRatio = "3:4";
      requestContents = null;
      requestConfig = null;

      const styleMapper: Record<string, string> = {
        "Minimalist (Tối giản)":
          "Bố cục tối giản sạch sẽ, nhiều khoảng trắng tinh tế, phông chữ sans-serif sắc nét, bảng màu đơn sắc với các điểm nhấn nhẹ nhàng",
        "Technical Blueprint (Bản vẽ kỹ thuật)":
          "Phong cách bản vẽ kỹ thuật cổ điển, nền xanh lam cyan, nét vẽ màu trắng, nền lưới kỹ thuật đo đạc, thẩm mỹ phác thảo thi công",
        "Watercolor Sketch (Màu nước)":
          "Phong cách phác thảo màu nước vẽ tay nghệ thuật, nét cọ biểu cảm, nền giấy thô nhám có vân, đường nét bút marker kiến trúc phóng khoáng đầy sáng tạo",
        "Photorealistic (Thực tế)":
          "Phong cách brochure quảng cáo bất động sản cao cấp, kết xuất ảnh render siêu thực chân thực, kiểu chữ serif thanh lịch, bố cục tạp chí bóng bẩy sang trọng",
        "Diagrammatic (Sơ đồ khối)":
          "Phong cách sơ đồ trừu tượng trực quan, màu sắc phẳng tối giản, đường viền dày nổi bật, đồ họa thông tin axonometric, phong cách sơ đồ kiến trúc BIG (Bjarke Ingels Group)",
        "Monochrome (Đen trắng)":
          "Phong cách đen trắng tương phản cao, nét vẽ mực kiến trúc tinh xảo, độ dày nét vẽ kiến trúc đa dạng rõ ràng, ánh sáng tương phản ấn tượng mạnh mẽ",
      };
      const selectedStyle =
        styleMapper[presentationStyle as keyof typeof styleMapper] ||
        presentationStyle;

      if (toolName === "Presentation Board") {
        const systemInstruction = `BẠN LÀ CHUYÊN GIA THIẾT KẾ ĐỒ HỌA KIẾN TRÚC BẬC THẦY.
CỰC KỲ QUAN TRỌNG: Tất cả thông tin phân tích, mô tả, nội dung văn bản bộc lộ trên bản thiết kế, chú thích, và nội dung kết quả đầu ra PHẢI viết hoàn toàn bằng TIẾNG VIỆT 100%. Tuyệt đối không sử dụng tiếng Anh trong mô tả, tiêu đề, phân tích hoặc kết quả đầu ra. Giữ nguyên các thuật ngữ kỹ thuật bắt buộc (nếu có), nhưng ưu tiên diễn đạt bằng tiếng Việt.
Nhiệm vụ của bạn là chuyển đổi hình ảnh tham khảo của tòa nhà được cung cấp thành một bố cục "Bảng Thuyết Trình Ý Tưởng Thiết Kế Kiến Trúc" cỡ A1 hoàn chỉnh, chuyên nghiệp.`;

        prompt = `<core_directives>\n1. ĐỒNG BỘ PHONG CÁCH HOÀN TOÀN: Toàn bộ bảng thuyết trình, bao gồm hình ảnh chính, hình nền, sơ đồ phân tích và phông chữ chú ý, BẮT BUỘC phải tuân thủ nghiêm ngặt phong cách thẩm mỹ sau: [${selectedStyle}]. Bản render ảnh thực tế ban đầu phải được chuyển đổi hoàn toàn và vẽ lại theo đúng phong cách yêu cầu này.\n\n2. BỐ CỤC TẬP TRUNG VÀO CHỦ THỂ HERO: Trọng tâm trung tâm của bảng thuyết trình phải là "GÓC PHỐI CẢNH CHÍNH" (tòa nhà được cung cấp), chiếm khoảng 50-60% diện tích không gian trung tâm.\n\n3. SƠ ĐỒ PHÂN TÍCH VÀ CÁC CHI TIẾT SÁNG TẠO: Bao quanh hình ảnh phối cảnh chính bằng các yếu tố kiến trúc bổ trợ được sắp xếp logic, đồng điệu với cấu hình hình học của tòa nhà. Bạn PHẢI tạo ra cảnh quan xung quanh bao gồm:\n- Một Bản Đồ Quy Hoạch Tổng Thể Mặt Bằng Vị Trí (Góc trên bên trái).\n- Một bản nghiên cứu Mặt Đứng hoặc Mặt Cắt Kiến Trúc (Góc trên bằng phải).\n- Một phối cảnh cận cảnh chi tiết Vật Liệu hoặc Chi Tiết Cấu Tạo (Góc dưới bên phải).\n- Một Mặt Bằng Bố Trí Tầng Trệt (Góc dưới bên trái).\n- Một sơ đồ biểu diễn Hướng Nắng hoặc Đặc Tính Bền Vững của dự án.\n\n4. CHỮ VÀ CHÚ THÍCH THẬT CHỮ NGHĨA (PHẢI VIẾT BẰNG TIẾNG VIỆT 100%): Bạn phải kết xuất các đoạn văn bản kiến trúc rõ ràng, dễ đọc bằng tiếng Việt hoàn toàn.\n- Sử dụng các tiêu đề viết hoa sắc nét: "Ý TƯỞNG THIẾT KẾ", "PHÂN TÍCH KHU ĐẤT", "MẶT ĐỨNG PHÍA ĐÔNG", "SƠ ĐỒ PHÂN TÍCH VẬT LIỆU", "GIẢI PHÁP TIẾT KIỆM NĂNG LƯỢNG", "MẶT BẰNG TẦNG TRỆT".\n- Đối với các khối văn bản đoạn văn, hãy kết xuất chữ diễn giải kiến trúc chuyên nghiệp bằng tiếng Việt dễ đọc, kiểu như: "Thiết kế kiến trúc hài hòa tinh tế với bối cảnh khu vực, ứng dụng các giải pháp thông gió tự nhiên thông minh và đón sáng hiệu quả. Bảng vật liệu ưu tiên tôn vinh các kết cấu bản địa ấm áp và thẩm mỹ bền vững giúp nâng cao trải nghiệm sống."\n- Thêm các đường kích thước đo đạc rõ, thước tỷ lệ biểu diễn, và các đường chỉ dẫn leader chỉ vào tòa nhà kèm theo chú thích tiếng Việt như "Đón Gió Tự Nhiên", "Mái Xanh Thân Thiện", "Gỗ Tự Nhiên Bản Địa".\n</core_directives>\n\n<output_formatting>\nTạo ra một bản thuyết trình ý tưởng kiến trúc tổng thể duy nhất có độ phân giải siêu cao, bố cục hoàn mỹ. Thiết kế gọn gàng, căn lề chuẩn xác, phông chữ đồng điệu đồng nhất, tuân thủ nghiêm khắc tinh thần thẩm mỹ của phong cách [${selectedStyle}] viết hoàn toàn bằng tiếng Việt 100%.\n</output_formatting>`;

        requestContents = [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: imageData.mimeType,
                  data: imageData.base64Data,
                },
              },
            ],
          },
        ];

        requestConfig = {
          systemInstruction: systemInstruction,
          imageConfig: {
            aspectRatio: apiAspectRatio,
            imageSize: "1K",
          },
        };
      } else if (toolName === "Overall") {
        prompt = `<role>\nYou are an Elite Architectural Editorial Designer. Your task is to transform the provided reference image into a stunning, high-end "Overall Architectural Board". \n</role>\n\n<core_directives>\n1. FULL-BLEED BACKGROUND & STYLE OVERRIDE: The original building must be adapted to the EXACT visual style of:[${selectedStyle}]. The building and its surrounding environment (sky, landscape) MUST fill the entire canvas edge-to-edge (Full-bleed composition). There are no white outer margins. \n\n2. EDITORIAL TYPOGRAPHY (TOP CENTER): Do not generate long paragraphs. In the upper center of the image (typically in the sky or negative space), generate a large, elegant, perfectly legible English title: "THE WOODLAND TERRACES" (or a similar majestic architectural name). Right below it, generate a smaller, elegant subtitle: "OVERALL PERSPECTIVE VIEW". Use clean serif or sans-serif fonts.\n\n3. HALLUCINATED INSET IMAGES (PICTURE-IN-PICTURE): At the bottom right/center of the canvas, hovering OVER the main background, you MUST hallucinate and generate exactly TWO small rectangular inset images. \n- Inset 1 (Left): A minimal site integration diagram or massing model matching the main building.\n- Inset 2 (Right): A zoomed-in functional diagram (e.g., showing a terrace or facade detail).\n- Both insets must have a thin, crisp white border to separate them from the background.\n\n4. INSET LABELS & FOOTERS: \n- Directly beneath the two inset images, generate tiny, crisp text labels (e.g., "SITE INTEGRATION DIAGRAM" and "TERRACE FUNCTIONALITY DIAGRAM").\n- In the absolute bottom-left corner of the board, generate the text: "OVERALL BOARD".\n- In the absolute bottom-right corner, generate a mock timestamp: "17:59:21".\n</core_directives>\n\n<output_formatting>\nGenerate a single, ultra-high-resolution landscape architectural board. Ensure the text is perfectly spelled, the inset images are logically derived from the main building's geometry, and the ${selectedStyle} is applied uniformly to the entire composition.\n</output_formatting>`;

        requestContents = [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: imageData.mimeType,
                  data: imageData.base64Data,
                },
              },
            ],
          },
        ];

        requestConfig = {
          temperature: 0.4,
          responseMimeType: "image/jpeg",
          imageConfig: {
            aspectRatio: "16:9",
          },
        };
      } else if (toolName === "Layout") {
        prompt = `<role>\nYou are an Elite Architectural Competition Board Designer. Your task is to analyze the provided building image and deconstruct it into a highly technical, professional Landscape (16:9) Competition Layout Board.\n</role>\n\n<core_directives>\n1. STRICT SWISS GRID LAYOUT (MODULAR DESIGN): The board MUST be organized using a rigorous "Swiss Grid" system. Divide the landscape canvas into clean, strictly aligned rectangular columns and rows. There must be distinct margins and gutters. NO messy overlapping of elements. Every diagram and text block must sit perfectly inside its own invisible bounding box.\n\n2. THE HERO ELEMENT - VERTICAL EXPLODED AXONOMETRIC: The central and most prominent element (taking up at least 40% of the board) MUST be a highly detailed, hallucinated Vertical Exploded Axonometric diagram of the exact building in the reference image.\n- Lift the roof straight up.\n- Suspend the intermediate floor slabs and walls in mid-air.\n- Keep the foundation/ground floor at the bottom.\n- Connect these vertically exploded layers with crisp, dashed vertical drafting lines.\n\n3. SECONDARY GRID ELEMENTS: Fill the remaining grid boxes with the following hallucinated elements, all mathematically aligned:\n- "MAIN RENDER": A small but high-quality inset image of the original building perspective.\n- "MASSING EVOLUTION": A sequence of 3 small diagrams showing the volumetric process (box -> carved -> final form).\n- "SPATIAL SECTION": A clean, orthogonal architectural cross-section.\n- "CONTEXT MAP": A minimal, abstract site map.\n\n4. TYPOGRAPHY & TEXT BLOCKS: Use precise, minimalist sans-serif typography. \n- Above each grid element, place a crisp English heading (e.g., "EXPLODED AXONOMETRIC", "MASSING STRATEGY", "TRANSVERSAL SECTION").\n- Generate justified, structured blocks of realistic architectural text (e.g., describing structural integrity, programmatic distribution, and spatial flow) to fill the text-designated grid cells.\n\n5. UNIFIED STYLE OVERRIDE: The entire board, including the exploded diagram, sections, and the render inset, MUST be completely unified under this exact visual aesthetic:[${selectedStyle}].\n</core_directives>\n\n<output_formatting>\nGenerate a single, ultra-high-resolution landscape board. Prioritize the alignment of the Swiss grid, the structural logic of the exploded view, and the overall professional competition-level aesthetic.\n</output_formatting>`;

        requestContents = [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: imageData.mimeType,
                  data: imageData.base64Data,
                },
              },
            ],
          },
        ];

        requestConfig = {
          temperature: 0.5,
          responseMimeType: "image/jpeg",
          imageConfig: {
            aspectRatio: "16:9",
          },
        };
      } else if (toolName === "Interior Moodboard") {
        prompt = `<role>\nYou are an Elite Interior Design Art Director. Your task is to transform the provided interior reference image into a high-end, professional "Interior Moodboard" layout.\n</role>\n\n<core_directives>\n1. DIGITAL EDITORIAL GRID COMPOSITION: Organize the landscape board using a clean, flat, modern digital grid system. Use generous whitespace/negative space. The layout must feel like a premium design catalogue. The overall aesthetic of the board and all elements must strictly adhere to this style:[${selectedStyle}].\n\n2. THE HERO PERSPECTIVE: The largest element on the board MUST be a high-quality restyled render of the provided interior room, occupying about 40-50% of the layout.\n\n3. OPTICAL MATERIAL EXTRACTION (PALETTE GRID): Visually analyze the materials, textures, and colors present in the reference room. Generate a neat, mathematically aligned row or grid of 4 to 5 "Material Swatches" (perfectly shaped circles or squares). These swatches MUST visually represent the exact DNA of the room (e.g., the specific wood grain of the floor, the fabric of the sofa, the metal of the fixtures, the wall paint color). \n\n4. 3D ISOMETRIC CUTAWAY (DOLLHOUSE VIEW): In a designated grid section, hallucinate and generate a 3D isometric top-down cutaway diagram of the exact same room. It must show the spatial layout of the furniture and soft, realistic lighting, matching the hero image's color palette.\n\n5. FLOATING FURNITURE CUTOUTS: Break the grid slightly by hallucinating 1 or 2 isolated furniture pieces from the room (e.g., an accent chair, a coffee table, or a pendant light). Render them as "cutouts" with no background, floating elegantly in the negative space to add depth and catalog-style aesthetics.\n\n6. EDITORIAL TYPOGRAPHY: Generate crisp, legible English headings above the respective sections. Use titles like: "INTERIOR MOODBOARD", "MATERIAL PALETTE", "SPATIAL ISOMETRIC", "KEY PIECES". Keep text minimal and highly professional.\n</core_directives>\n\n<output_formatting>\nOutput a single, ultra-high-resolution interior presentation board. Ensure the swatches accurately reflect the hero image, the isometric view is logically consistent, and the layout remains strictly organized within the digital grid aesthetic.\n</output_formatting>`;

        requestContents = [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: imageData.mimeType,
                  data: imageData.base64Data,
                },
              },
            ],
          },
        ];

        requestConfig = {
          temperature: 0.4,
          responseMimeType: "image/jpeg",
          imageConfig: {
            aspectRatio: "16:9",
          },
        };
      } else if (toolName === "Advanced Layout") {
        const projectName = "ARCHITECTURAL PRESENTATION";
        prompt = `<role>\nYou are an Elite Architectural Portfolio Designer. Your task is to transform the provided reference building image into a highly dense, comprehensive, and perfectly structured Portrait (3:4) "Advanced Architectural Presentation Board".\n</role>\n\n<core_directives>\n1. UNIFIED AESTHETIC & STYLE: The ENTIRE board, including the main image, all hallucinated diagrams, and background, MUST strictly adhere to this visual style:[${selectedStyle}]. All generated drawings must be fully rendered (colored, textured, soft lighting) to match the hero image, NOT flat CAD lines.\n\n2. STRICT 3-COLUMN PORTRAIT GRID: The layout must be a highly disciplined, dense vertical board divided into 3 distinct columns. Do not overlap elements. Ensure consistent white space between boxes.\n\n3. HEADER (TOP ROW): Generate a large, elegant headline spanning the top: "[${projectName}] - ARCHITECTURAL PRESENTATION".\n\n4. LEFT COLUMN (CONCEPT & MASSING EVOLUTION):\n- Top left: A dense text block titled "CONCEPT" with realistic architectural paragraphs.\n- Below the text: A vertical sequence of exactly 4 to 5 "Step-by-Step Isometric Massing Diagrams" showing the volumetric evolution of the building (from a simple box to the final carved form). Connect these steps with downward-pointing arrows and labels like "STEP 1 - MASSING", "STEP 2", etc.\n\n5. CENTER COLUMN (HERO & CORE STRUCTURE):\n- Top center: The restyled Hero Image (the original building perspective).\n- Middle center: A hallucinated 3D Axonometric or Isometric view of the building.\n- Below that: Two structured text blocks titled "MATERIALS" and "DESIGN".\n- Bottom center: A rendered Front Elevation of the building.\n\n6. RIGHT COLUMN (SPATIAL & INTERIOR DETAILS):\n- Top right: A hallucinated rendered Interior View matching the building's style.\n- Middle right: A grid of 4 rendered Floor Plans (e.g., Ground Plan, First Floor, Roof Terrace).\n- Bottom right: A hallucinated rendered Cross Section of the building, and another small interior perspective.\n\n7. TYPOGRAPHY & FOOTER: \n- Use crisp, highly legible architectural sans-serif or serif fonts for all titles and text blocks.\n- Generate a dark footer bar at the absolute bottom with the text "ADVANCED LAYOUT" aligned left, and a timestamp (e.g., "17:57:47") aligned right.\n</core_directives>\n\n<output_formatting>\nOutput a single, ultra-high-resolution portrait presentation board. The grid must be exceptionally clean, mimicking a professional university architecture thesis board. Maximize the information density while maintaining perfect stylistic cohesion.\n</output_formatting>`;

        requestContents = [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: imageData.mimeType,
                  data: imageData.base64Data,
                },
              },
            ],
          },
        ];

        requestConfig = {
          temperature: 0.45,
          responseMimeType: "image/jpeg",
          imageConfig: {
            aspectRatio: "3:4",
          },
        };
      } else {
        switch (toolName) {
          case "Presentation Board":
            prompt += `This should be a comprehensive presentation board. Include the main perspective, some conceptual diagrams, and a clean, professional layout structure.`;
            break;
          default:
            prompt += `Include appropriate architectural presentation elements that fit the concept of a ${toolName}. The layout should be clean, well-composed, and visually striking.`;
        }

        requestContents = [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: imageData.base64Data,
                  mimeType: imageData.mimeType,
                },
              },
              { text: prompt },
            ],
          },
        ];

        requestConfig = {
          imageConfig: {
            aspectRatio: apiAspectRatio,
            imageSize: "1K",
          },
        };
      }

      const response = await generateContentWithRetry(ai, {
        model: selectedModel,
        contents: requestContents,
        config: requestConfig,
      });

      setGeneratingStatus({
        toolName,
        progress: 80,
        status: "Đang xử lý ảnh...",
      });

      let generatedImageUrl = null;
      if (
        response.candidates &&
        response.candidates.length > 0 &&
        response.candidates[0].content &&
        response.candidates[0].content.parts
      ) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            generatedImageUrl = `data:${part?.inlineData?.mimeType || "image/png"};base64,${part?.inlineData?.data}`;
            break;
          }
        }
      }

      if (generatedImageUrl) {
        let finalUrl = generatedImageUrl;
        let storagePath = undefined;

        if (user) {
          try {
            setGeneratingStatus({
              toolName,
              progress: 85,
              status: "Đang tải ảnh lên lưu trữ...",
            });
            const res = await apiClient.post<ApiResponse<{ url: string }>>("/api/v1/media/upload", {
              file: generatedImageUrl,
              folder: "canvas"
            });
            setGeneratingStatus({
              toolName,
              progress: 100,
              status: "Hoàn tất!",
            });

            finalUrl = res.data.url;
            storagePath = finalUrl;
          } catch (uploadError) {
            console.error("Error uploading generated image:", uploadError);
            // Fallback to base64 if upload fails
          }
        }

        const now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
        setGeneratedImages((prev) => [
          { url: finalUrl, toolName, timestamp, storagePath },
          ...prev,
        ]);
        toast.success("Tạo dàn trang thành công!");
      } else {
        throw new Error("Không tìm thấy ảnh trong phản hồi.");
      }
    } catch (error) {
      console.error("Error generating layout:", error);
      const err = error as Error;
      const contentsLen = Array.isArray(requestContents) ? requestContents.length : 0;
      const partsInfo = Array.isArray(requestContents)
        ? (requestContents as { parts?: Record<string, unknown>[] }[])[0]?.parts?.map((p) => Object.keys(p))
        : [];
      toast.error(`Error 400 Payload: ${JSON.stringify({ 
        model: selectedModel, 
        contentsLen, 
        parts: partsInfo,
        config: requestConfig
      })}\n\nError: ${err.message}`);
    } finally {
      setIsGenerating(false);
      setGeneratingStatus(null);
    }
  };

  const handleDeleteImage = async (index: number, storagePath?: string) => {
    if (storagePath) {
      await deleteCloudinaryMedia(storagePath);
    }
    setGeneratedImages((prev) => prev.filter((_, i) => i !== index));
    toast.success("Đã xoá ảnh thành công.");
  };

  const tools = [
    {
      name: "Presentation Board",
      description:
        "Tạo dàn trang kiến trúc hoàn chỉnh với phối cảnh chính, biểu đồ và layout chuyên nghiệp.",
      icon: "view_quilt",
    },
    {
      name: "Overall",
      description:
        "Tạo bảng trình bày tổng thể A1 (tỷ lệ 3:4) với phong cách tối giản, giữ nguyên thiết kế công trình.",
      icon: "view_in_ar",
    },
    {
      name: "Layout",
      description:
        "Tạo bảng dàn trang chi tiết theo bố cục competition (Massing, Exploded, Text, Map, Section, Render).",
      icon: "dashboard_customize",
    },
    {
      name: "Interior Moodboard",
      description:
        "Tạo bảng moodboard nội thất cao cấp với bảng vật liệu, phối cảnh và mặt bằng chi tiết.",
      icon: "home",
    },
    {
      name: "Advanced Layout",
      description:
        "Bảng trình bày kiến trúc chi tiết với sơ đồ khối, mặt cắt, mặt đứng và diễn giải ý tưởng.",
      icon: "open_in_full",
    },
  ];

  return (
    <div className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto">
      <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-[600px] items-start">
        {/* Left Sidebar */}
        <div className="w-full lg:w-[380px] flex flex-col gap-6 shrink-0">
          {/* 1. Tải Lên Ảnh Công Trình */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Icon name="image" className="text-primary" />
                1. Tải Lên Ảnh Công Trình
              </h3>
              <button
                onClick={() => setShowLibraryModal(true)}
                className="text-primary text-sm font-semibold hover:underline flex items-center gap-1"
              >
                <Icon name="photo_library" className="text-[16px]" /> Thư viện
              </button>
            </div>

            <div
              className={`relative aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant/30 bg-surface-container-low/50 hover:bg-surface-container-low"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isUploading ? (
                <div className="flex flex-col items-center justify-center p-6 w-full">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium text-primary mb-2">
                    Đang tải ảnh lên...
                  </p>
                  <div className="w-full max-w-[200px] bg-surface-container-highest rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : inputImage ? (
                <div className="relative w-full h-full group">
                  <img
                    src={inputImage}
                    alt="Input"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <label className="bg-white text-on-surface px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-100 transition-colors flex items-center gap-2">
                      <Icon name="edit" className="text-[18px]" />
                      Thay ảnh
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  <Icon
                    name="add_photo_alternate"
                    className="text-4xl text-on-surface-variant/50 mb-4"
                  />
                  <p className="text-sm font-medium text-on-surface-variant mb-2">
                    Kéo thả hoặc nhấp để tải ảnh công trình
                  </p>
                  <p className="text-xs text-on-surface-variant/70 mb-4">
                    Dùng ảnh phối cảnh hoặc sketch
                  </p>
                  <label className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors">
                    Tải ảnh lên
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </label>
                </>
              )}
            </div>
          </div>

          {/* 2. Công Cụ Tạo Board */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
            <h3 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
              <Icon name="brush" className="text-primary" />
              2. Công Cụ Tạo Board
            </h3>

            {/* Phong cách trình bày */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-on-surface-variant mb-2">
                Phong cách trình bày
              </label>
              <div className="relative">
                <select
                  className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                  value={presentationStyle}
                  onChange={(e) => setPresentationStyle(e.target.value)}
                >
                  <option value="Minimalist (Tối giản)">
                    Minimalist (Tối giản)
                  </option>
                  <option value="Technical Blueprint (Bản vẽ kỹ thuật)">
                    Technical Blueprint (Bản vẽ kỹ thuật)
                  </option>
                  <option value="Watercolor Sketch (Màu nước)">
                    Watercolor Sketch (Màu nước)
                  </option>
                  <option value="Photorealistic (Thực tế)">
                    Photorealistic (Thực tế)
                  </option>
                  <option value="Diagrammatic (Sơ đồ khối)">
                    Diagrammatic (Sơ đồ khối)
                  </option>
                  <option value="Monochrome (Đen trắng)">
                    Monochrome (Đen trắng)
                  </option>
                </select>
                <Icon
                  name="keyboard_arrow_down"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                />
              </div>
            </div>

            {/* Model Selection */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-on-surface-variant mb-2">
                AI Engine
              </label>
              <div className="relative">
                <select
                  className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {GEMINI_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} {model.isPro ? "(Pro)" : ""}
                    </option>
                  ))}
                </select>
                <Icon
                  name="keyboard_arrow_down"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                />
              </div>
            </div>

            {/* Tools list */}
            <div className="flex flex-col gap-4">
              {tools.map((tool, idx) => (
                <div
                  key={idx}
                  className="bg-surface-container-low/50 border border-outline-variant/20 rounded-xl p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <Icon
                        name={tool.icon}
                        className="text-primary text-[18px]"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-on-surface">
                        {tool.name}
                      </h4>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleGenerate(tool.name)}
                    disabled={isGenerating || !inputImage}
                    className={`relative w-full font-bold py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm overflow-hidden ${
                      generatingStatus?.toolName === tool.name
                        ? "bg-primary text-white"
                        : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                    }`}
                  >
                    {generatingStatus?.toolName === tool.name ? (
                      <div className="flex items-center gap-2 z-10">
                        <div className="relative w-4 h-4">
                          <svg
                            className="w-full h-full animate-spin"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="text-white/30"
                              strokeWidth="3"
                              stroke="currentColor"
                              fill="transparent"
                              r="10"
                              cx="12"
                              cy="12"
                            />
                            <circle
                              className="text-white transition-all duration-300 ease-in-out"
                              strokeWidth="3"
                              strokeDasharray={62.83}
                              strokeDashoffset={
                                62.83 -
                                (62.83 * generatingStatus.progress) / 100
                              }
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="transparent"
                              r="10"
                              cx="12"
                              cy="12"
                            />
                          </svg>
                        </div>
                        <span>{Math.round(generatingStatus.progress)}%</span>
                      </div>
                    ) : (
                      <>
                        <Icon name="auto_awesome" className="text-[16px]" />
                        Tạo Ngay
                      </>
                    )}
                    {generatingStatus?.toolName === tool.name && (
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300 ease-in-out"
                        style={{ width: `${generatingStatus.progress}%` }}
                      />
                    )}
                  </button>
                  {generatingStatus?.toolName === tool.name && (
                    <p className="text-[10px] text-center text-primary mt-1 animate-pulse">
                      {generatingStatus.status}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Thư Viện Đã Tạo */}
        <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm min-h-[600px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <Icon name="auto_awesome" className="text-primary" />
              Thư Viện Đã Tạo
            </h3>
            <span className="text-xs font-medium text-on-surface-variant">
              {generatedImages.length} kết quả
            </span>
          </div>

          <div className="flex-1 bg-surface-container-low/50 rounded-xl border border-outline-variant/10 overflow-hidden relative p-4 flex flex-col">
            {isGenerating && generatedImages.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-surface-container-low/50 z-10">
                <div className="relative w-16 h-16 mb-4">
                  <svg
                    className="w-full h-full animate-spin"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="text-primary/20"
                      strokeWidth="2"
                      stroke="currentColor"
                      fill="transparent"
                      r="10"
                      cx="12"
                      cy="12"
                    />
                    <circle
                      className="text-primary transition-all duration-300 ease-in-out"
                      strokeWidth="2"
                      strokeDasharray={62.83}
                      strokeDashoffset={
                        62.83 -
                        (62.83 * (generatingStatus?.progress || 0)) / 100
                      }
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="10"
                      cx="12"
                      cy="12"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">
                      {Math.round(generatingStatus?.progress || 0)}%
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-primary">
                  Đang tạo {generatingStatus?.toolName || "hình ảnh"}...
                </p>
                <p className="text-xs text-on-surface-variant mt-2 animate-pulse">
                  {generatingStatus?.status ||
                    "Quá trình này có thể mất vài chục giây"}
                </p>
              </div>
            ) : generatedImages.length > 0 || isGenerating ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar pr-2 pb-2">
                {isGenerating && (
                  <div className="relative rounded-xl overflow-hidden border border-outline-variant/20 bg-surface-container-lowest flex flex-col items-center justify-center p-6 min-h-[200px]">
                    <div className="relative w-12 h-12 mb-3">
                      <svg
                        className="w-full h-full animate-spin"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="text-primary/20"
                          strokeWidth="2"
                          stroke="currentColor"
                          fill="transparent"
                          r="10"
                          cx="12"
                          cy="12"
                        />
                        <circle
                          className="text-primary transition-all duration-300 ease-in-out"
                          strokeWidth="2"
                          strokeDasharray={62.83}
                          strokeDashoffset={
                            62.83 -
                            (62.83 * (generatingStatus?.progress || 0)) / 100
                          }
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                          r="10"
                          cx="12"
                          cy="12"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">
                          {Math.round(generatingStatus?.progress || 0)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-primary text-center">
                      {generatingStatus?.toolName || "Đang tạo..."}
                    </p>
                    <p className="text-[10px] text-on-surface-variant mt-1 text-center animate-pulse">
                      {generatingStatus?.status || "Vui lòng chờ..."}
                    </p>
                  </div>
                )}
                {generatedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-xl overflow-hidden group border border-outline-variant/20 bg-surface-container-lowest"
                  >
                    <img
                      src={img.url}
                      alt={`Generated ${idx}`}
                      className="w-full h-auto object-contain"
                    />

                    {/* Overlay info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-3 flex justify-between items-center">
                      <span className="text-white text-xs font-bold uppercase tracking-wider">
                        {img.toolName}
                      </span>
                      <span className="text-white/60 text-[10px]">
                        {img.timestamp}
                      </span>
                    </div>

                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const imageData = await getImageBase64(img.url);
                            const byteCharacters = atob(imageData.base64Data);
                            const byteNumbers = new Array(
                              byteCharacters.length,
                            );
                            for (let i = 0; i < byteCharacters.length; i++) {
                              byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], {
                              type: imageData.mimeType,
                            });
                            const blobUrl = window.URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = blobUrl;
                            link.download = `canvas_${img.toolName}_${Date.now()}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(blobUrl);
                          } catch (error) {
                            console.error("Error downloading image:", error);
                            toast.error("Có lỗi xảy ra khi tải ảnh.");
                          }
                        }}
                        className="w-10 h-10 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors"
                        title="Tải xuống"
                      >
                        <Icon name="download" className="text-[20px]" />
                      </button>
                      <button
                        onClick={() => setFullscreenImage(img.url)}
                        className="w-10 h-10 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors"
                        title="Xem toàn màn hình"
                      >
                        <Icon name="fullscreen" className="text-[20px]" />
                      </button>
                      <button
                        onClick={() => handleDeleteImage(idx, img.storagePath)}
                        className="w-10 h-10 bg-red-500 hover:bg-red-600 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors shadow-lg"
                        title="Xoá ảnh"
                      >
                        <Icon name="delete" className="text-[20px]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                <Icon
                  name="grid_view"
                  className="text-6xl text-on-surface-variant/20 mb-4"
                />
                <p className="text-sm font-medium text-on-surface-variant/70">
                  Chưa có nội dung nào được tạo.
                </p>
                <p className="text-xs text-on-surface-variant/50 mt-1">
                  Chọn một công cụ bên trái để bắt đầu.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            onClick={() => setFullscreenImage(null)}
          >
            <Icon name="close" className="text-2xl" />
          </button>
          <img
            src={fullscreenImage}
            alt="Fullscreen"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <ImageLibraryModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        onSelectImages={(urls) => {
          if (urls.length > 0) {
            setInputImage(urls[0]);
          }
          setShowLibraryModal(false);
        }}
        target="input"
      />
    </div>
  );
};


const UtilitiesTabContent: React.FC = () => {
  const { user } = useAuth();
  const [activeUtility, setActiveUtility] = useState<string | null>(null);
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [inputImage2, setInputImage2] = useState<string | null>(null);
  const [utilityModel, setUtilityModel] = useState(
    "gemini-3-pro-image-preview",
  );
  const [utilityResolution, setUtilityResolution] = useState("1K");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress] = useState(0);

  const [moodProgress, setMoodProgress] = useState(0);
  const [moodResults, setMoodResults] = useState<
    { url: string; storagePath: string; timestamp?: string }[]
  >([]);
  const [moodHistory, setMoodHistory] = useState<
    { url: string; storagePath: string; timestamp: string }[]
  >(() => {
    const saved = localStorage.getItem("iGen_moodHistory");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(
      "iGen_moodHistory",
      JSON.stringify(moodHistory.slice(0, 20)),
    );
  }, [moodHistory]);

  const [googleMapHistory, setGoogleMapHistory] = useState<
    { url: string; storagePath: string; timestamp: string }[]
  >(() => {
    const saved = localStorage.getItem("iGen_googleMapHistory");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(
      "iGen_googleMapHistory",
      JSON.stringify(googleMapHistory.slice(0, 20)),
    );
  }, [googleMapHistory]);

  const handleDeleteGoogleMapHistory = async (
    index: number,
    storagePath: string,
  ) => {
    if (!confirm("Bạn có chắc chắn muốn xoá ảnh này?")) return;
    await deleteCloudinaryMedia(storagePath);
    setGoogleMapHistory((prev) => prev.filter((_, i) => i !== index));
    toast.success("Đã xoá ảnh thành công.");
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isProcessing && activeUtility === "mood") {
      interval = setInterval(() => {
        setMoodProgress((prev) => {
          if (prev >= 99) return prev;
          let increment: number;
          if (prev < 30) increment = 0.5;
          else if (prev < 80) increment = 0.2;
          else increment = 0.05;
          return Math.min(99, prev + increment);
        });
      }, 100);
    } else {
      setTimeout(() => {
        setMoodProgress(0);
      }, 0);
    }
    return () => clearInterval(interval);
  }, [isProcessing, activeUtility]);

  const handleDeleteMoodImage = async (
    index: number,
    storagePath: string,
    isHistory: boolean,
  ) => {
    if (!confirm("Bạn có chắc chắn muốn xoá ảnh này?")) return;
    await deleteCloudinaryMedia(storagePath);

    if (isHistory) {
      setMoodHistory((prev) => prev.filter((_, i) => i !== index));
    } else {
      setMoodResults((prev) => prev.filter((_, i) => i !== index));
      // Optionally also remove it from history if it's there
      setMoodHistory((prev) => prev.filter((item) => item.storagePath !== storagePath));
    }
    toast.success("Đã xoá ảnh thành công.");
  };

  const [showLibraryModalUtility, setShowLibraryModalUtility] = useState(false);
  const [isDraggingUtility, setIsDraggingUtility] = useState(false);
  const [fullscreenImageUtility, setFullscreenImageUtility] = useState<
    string | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const utilities = [
    {
      id: "mood",
      title: "Tạo Mood Cho Render",
      description:
        "Tải lên ảnh sketch, AI sẽ tự động tạo 4 phiên bản render với các mood ánh sáng khác nhau (sáng, trưa, chiều, tối).",
      icon: "lightbulb",
    },
    
    {
      id: "google-map",
      title: "Google Map sang Phối Cảnh 3D",
      description:
        "Tải lên ảnh chụp màn hình Google Map, AI sẽ biến nó thành phối cảnh 3D trên không.",
      icon: "fit_screen",
    },
    {
      id: "insert-building",
      title: "Chèn công trình vào hiện trạng",
      description:
        "Tải lên ảnh hiện trạng và ảnh công trình, AI sẽ tự động ghép chúng lại một cách chân thực.",
      icon: "home",
    },
    {
      id: "virtual-tour",
      title: "Tham Quan Ảo",
      description:
        "Tải lên ảnh render 3D và di chuyển camera (pan, zoom, orbit) để khám phá không gian.",
      icon: "ads_click",
    },
    {
      id: "merge-interior",
      title: "Ghép Nội Thất",
      description:
        "Tải lên ảnh phòng trống và ảnh đồ nội thất, AI sẽ ghép chúng lại chân thực.",
      icon: "chair",
    },
    {
      id: "colorize-floorplan",
      title: "Đổ màu Floorplan",
      description:
        "Tô màu và thêm chất liệu cho bản vẽ mặt bằng đen trắng theo các phong cách khác nhau.",
      icon: "edit",
    },
  ];

  const processInputFile = async (inputFile: File, target: 1 | 2 = 1) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để tải ảnh lên.");
      return;
    }

    setIsUploading(true);
    try {
      let fileToUpload = inputFile;
      if (inputFile.type === "application/pdf") {
        toast.info(`Đang chuyển đổi PDF ${inputFile.name}...`);
        const convertedImages = await convertPdfToImage(inputFile);
        if (convertedImages && convertedImages.length > 0) {
          fileToUpload = convertedImages[0];
        } else {
          throw new Error("PDF conversion failed or return empty");
        }
      }

      const downloadURL = await uploadMedia(fileToUpload, "utilities");
      cacheImage(downloadURL, fileToUpload);
      if (target === 1) setInputImage(downloadURL);
      else setInputImage2(downloadURL);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Tải ảnh lên thất bại.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    target: 1 | 2 = 1,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processInputFile(file, target);
  };

  const handleImageDrop = (
    e: React.DragEvent<HTMLDivElement>,
    target: 1 | 2 = 1,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingUtility(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processInputFile(file, target);
  };

  const handleImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingUtility(true);
  };

  const handleImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingUtility(false);
  };

  const handleProcess = async () => {
    if (!inputImage) {
      toast.error("Vui lòng tải lên ảnh yêu cầu.");
      return;
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const modelToUse =
        activeUtility === "mood"
          ? utilityModel
          : "gemini-3.1-flash-image-preview";
      const ai = await getAIClient(modelToUse);
      const imageData = await getImageBase64(inputImage, true);

      let systemInstruction = "";
      let userPrompt = "";
      let _numImages = 1;

      switch (activeUtility) {
        case "mood":
          systemInstruction = `BẠN LÀ CHUYÊN GIA THIẾT KẾ ÁNH SÁNG KIẾN TRÚC.
CỰC KỲ QUAN TRỌNG: Tất cả nội dung prompt được tạo phải được viết hoàn toàn bằng TIẾNG VIỆT 100%. Tuyệt đối không sử dụng tiếng Anh trong mô tả hoặc kết quả đầu ra. Giữ nguyên các thuật ngữ kỹ thuật bắt buộc (nếu có), nhưng ưu tiên diễn đạt bằng tiếng Việt.
Hãy phân tích bản phác thảo/ảnh render đầu vào và tạo ra 4 prompt render kiến trúc khác nhau, cao cấp và chi tiết hoàn toàn viết bằng tiếng Việt ứng với 4 trạng thái thời gian.
          
          ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
          Bạn CHỈ ĐƯỢC PHÉP trả về duy nhất một đối tượng JSON với các khóa chính xác sau: "morning", "noon", "afternoon", "night".
          Tuyệt đối không bao gồm bất kỳ lời dẫn chuyện, định dạng markdown hay giải thích nào bên ngoài khối JSON.
          
          Cấu trúc:
          {"morning": "...", "noon": "...", "afternoon": "...", "night": "..."}
          
          Nội dung các prompt tiếng Việt cần tập trung bộc tả:
          - morning: khoảnh khắc bình minh dịu mát, ánh sáng ban mai tươi mới trong trẻo, bóng đổ mềm mại, pha lẫn sắc xanh nhạt tinh khôi của bầu trời sớm.
          - noon: ánh nắng đứng bóng buổi trưa rực rỡ, độ tương phản cao, bóng đổ sắc nét chân thực, ánh sáng trắng trung tính chiếu sáng toàn bộ kiến trúc.
          - afternoon: giờ vàng hoàng hôn, những chiếc bóng đổ xiên dài ấm áp, kết hợp với các tone màu vàng cam, rực rỡ lãng mạn phủ lên bề mặt công trình.
          - night: ánh sáng đèn nhân tạo lung linh, giờ xanh huyền ảo blue hour, ánh điện phát ra từ các khung cửa sổ ấm áp, ánh sáng bối cảnh đường phố điện ảnh.
          
          Bảo toàn cấu trúc hình học nguyên bản chi tiết một cách hoàn hảo nhất.`;
          userPrompt = "Tạo 4 prompt không gian ánh sáng dạng JSON cho căn phòng này viết hoàn toàn bằng tiếng Việt.";
          _numImages = 4;
          break;
        case "google-map":
          systemInstruction =
            "Bạn là một Nhà Quy Hoạch Đô Thị Bậc Thầy. Hãy biến đổi bản đồ 2D này thành một phối cảnh kiến trúc từ trên cao (drone shot) có chiều sâu điện ảnh 3D rực rỡ. Tạo dựng nhà cửa đô thị chân thực sinh động, thảm thực vật cây xanh trù phú, phong cách render Unreal Engine 5.4 tuyệt mỹ viết hoàn toàn bằng tiếng Việt. Bảo toàn tuyệt đối đường đi lối lại giao thông gốc của bản đồ.";
          userPrompt = prompt || "Hãy biến đổi bản đồ này thành phối cảnh kiến trúc 3D tuyệt đẹp. Góc nhìn từ trên cao sống động (drone shot), tiêu cự sắc nét, có bối cảnh bến cảng cạnh biển, núi non trập trùng phía sau hắt ánh sáng mây mờ dịu mát phủ lên cảnh quan viết hoàn toàn bằng tiếng Việt.";
          break;
        case "insert-building":
          if (!inputImage2) {
            toast.error("Vui lòng tải lên ảnh công trình (ảnh thứ 2).");
            setIsProcessing(false);
            return;
          }
          systemInstruction =
            "Bạn là một chuyên gia ghép cảnh kiến trúc chuyên nghiệp. Hãy tích hợp liền mạch và hoàn hảo tòa nhà công trình từ bức ảnh thứ 2 vào đúng vị trí bối cảnh khu đất trống có sẵn trong bức ảnh thứ 1. Đồng bộ hoàn hảo hướng sáng, bóng đổ của công trình, màu sắc và góc phối cảnh máy ảnh viết hoàn toàn bằng tiếng Việt.";
          userPrompt = "Ghép tòa nhà từ ảnh thứ 2 vào khu đất trống của ảnh thứ 1 một cách sắc nét, đồng bộ hài hòa viết hoàn toàn bằng tiếng Việt.";
          break;
        case "colorize-floorplan":
          systemInstruction =
            "Bạn là một Kiến Trúc Sư Nội Thất xuất sắc. Hãy phủ màu và chất liệu kết cấu thực tế lên bản vẽ mặt bằng đen trắng thô ráp này (chất liệu vân gỗ, gạch men đá, thảm dệt ấm áp). Thêm chiều sâu 3D bằng những nét đổ bóng mềm tự nhiên tinh xảo. Phong cách trình bày ý đồ thiết kế chuyên nghiệp viết hoàn toàn bằng tiếng Việt.";
          userPrompt = "Hãy phủ màu sắc và chất liệu nội thất chuyên nghiệp chân thực cho bản vẽ mặt bằng này viết hoàn toàn bằng tiếng Việt.";
          break;
        case "virtual-tour":
          systemInstruction =
            "Bạn là một Nhiếp Ảnh Gia Chụp Ảnh Toàn Cảnh 360 Độ chuyên nghiệp. Hãy tạo ra một bức ảnh toàn cảnh VR panorama 360 độ equirectangular có độ phân giải siêu cao cho không gian này. Đảm bảo căn lề ngang liền mạch hoàn hảo không tỳ vết, không bị lỗi ghép nối nét, ánh sáng trong không gian chân thực sống động viết hoàn toàn bằng tiếng Việt.";
          userPrompt =
            "Tạo một ảnh toàn cảnh panorama 360 độ equirectangular tuyệt đẹp cho không gian này viết hoàn toàn bằng tiếng Việt.";
          break;
        case "merge-interior":
          if (!inputImage2) {
            toast.error("Vui lòng tải lên ảnh nội thất mẫu (ảnh thứ 2).");
            setIsProcessing(false);
            return;
          }
          systemInstruction =
            "Bạn là một chuyên gia thiết kế kiến trúc nội thất tài năng. Hãy bố trí và bày biện đầy đủ đồ nội thất cho căn phòng trống ở bức ảnh thứ 1 với phong cách thiết kế, chất liệu và tông màu đồng hài hòa với bức ảnh nội thất mẫu thứ 2. Đảm bảo bố trí đồ dùng hợp lý, đúng tỷ lệ xích và đồng bộ ánh sáng tự nhiên viết hoàn toàn bằng tiếng Việt.";
          userPrompt = "Bày biện toàn bộ nội thất căn phòng này một cách lộng lẫy và ăn nhập phong cách ảnh mẫu viết hoàn toàn bằng tiếng Việt.";
          break;
        default:
          toast.error("Tính năng này đang được phát triển.");
          setIsProcessing(false);
          return;
      }

      setProcessStatus("Đang phân tích và xử lý...");

      if (!imageData || !imageData.base64Data) {
        throw new Error("Dữ liệu ảnh gốc không hợp lệ.");
      }

      const parts: (
        | { inlineData: { data: string; mimeType: string }; text?: undefined }
        | { text: string; inlineData?: undefined }
      )[] = [
        {
          inlineData: {
            data: imageData.base64Data,
            mimeType: imageData.mimeType || "image/jpeg",
          },
        },
      ];

      if (inputImage2) {
        const imageData2 = await getImageBase64(inputImage2, true);
        if (!imageData2 || !imageData2.base64Data) {
          throw new Error("Dữ liệu ảnh mẫu không hợp lệ.");
        }
        parts.push({
          inlineData: {
            data: imageData2.base64Data,
            mimeType: imageData2.mimeType || "image/jpeg",
          },
        });
      }

      parts.push({ text: userPrompt });

      if (activeUtility === "mood") {
        setMoodResults([]);
        const now = new Date();
        const timestampStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

        const getAspectRatio = (width: number, height: number): string => {
          const ratio = width / height;
          if (ratio > 1.7) return "16:9";
          if (ratio > 1.2) return "4:3";
          if (ratio > 0.8 && ratio <= 1.2) return "1:1";
          if (ratio > 0.6) return "3:4";
          return "9:16";
        };

        const imgDim = await new Promise<{width: number, height: number}>((resolve) => {
           const img = new Image();
           img.onload = () => resolve({width: img.width, height: img.height});
           img.onerror = () => resolve({width: 1, height: 1});
           img.src = inputImage!;
        });
        const autoAspectRatio = getAspectRatio(imgDim.width, imgDim.height);

        const moodPrompts = [
          `<role>Elite Architectural Lighting Artist.</role>\n<core_directive>Transform the provided reference image (whether it is a line sketch, clay model, or draft render) into a hyper-realistic photograph. Strictly preserve the spatial geometry and camera angle. If the input lacks materials, hallucinate high-end modern interior textures.</core_directive>\n<lighting_mood_morning>\n- Natural Light: Soft, cool, diffused early morning sunlight gently entering through the windows.\n- Window View: Crisp, clear light blue morning sky.\n- Artificial Light: Turned OFF. Let the natural daylight illuminate the room.\n- Atmosphere: Fresh, airy, calm, realistic global illumination, soft subtle shadows.\n</lighting_mood_morning>\n<render_specs>Photorealistic, 8k resolution, Corona Render style, architectural photography.</render_specs>`,
          `<role>Elite Architectural Lighting Artist.</role>\n<core_directive>Transform the provided reference image into a hyper-realistic photograph. Preserve exact geometry. Auto-texture high-end materials if the input is a raw sketch.</core_directive>\n<lighting_mood_noon>\n- Natural Light: Bright, harsh, intense midday sun shining directly into the space.\n- Shadows: Sharp, high-contrast, hard-edged cast shadows on the floor and furniture.\n- Window View: Deep vibrant blue sky, perhaps a few fluffy white clouds.\n- Artificial Light: Turned OFF. The room is flooded with overwhelming natural daylight.\n- Atmosphere: Energetic, highly illuminated, vivid colors, realistic ray-tracing.\n</lighting_mood_noon>\n<render_specs>Photorealistic, 8k resolution, Unreal Engine 5 daylight, architectural photography.</render_specs>`,
          `<role>Elite Architectural Lighting Artist.</role>\n<core_directive>Transform the provided reference image into a hyper-realistic photograph. Preserve exact geometry. Auto-texture high-end materials if the input is a raw sketch.</core_directive>\n<lighting_mood_sunset>\n- Natural Light: Golden Hour. Low-angle, warm, rich amber and orange sunlight stretching deep into the room.\n- Color Bleed: Allow the intense orange/golden light to naturally bleed and reflect onto the furniture and walls (realistic color physics).\n- Window View: Dramatic sunset sky with gradients of orange, pink, and purple.\n- Artificial Light: PARTIALLY ON. Accent lights, table lamps, or LED strips are turned on, emitting a warm 3000K glow that complements the sunset.\n- Shadows: Long, stretched, dramatic cinematic shadows.\n</lighting_mood_sunset>\n<render_specs>Photorealistic, 8k resolution, V-Ray sunset render, cinematic lighting.</render_specs>`,
          `<role>Elite Architectural Lighting Artist.</role>\n<core_directive>Transform the provided reference image into a hyper-realistic photograph. Preserve exact geometry. Auto-texture high-end materials if the input is a raw sketch.</core_directive>\n<lighting_mood_night>\n- Natural Light: NONE. The exterior is completely dark.\n- Window View: Pitch black night sky, perhaps distant city lights or subtle moonlight.\n- Artificial Light: FULLY ILLUMINATED. This is the primary light source. Turn on all ceiling lights, chandeliers, spotlights, cove lights, and table lamps. Emphasize warm interior lighting (2700K - 3000K).\n- Atmosphere: Cozy, luxurious, moody. Strong contrast between the dark unlit corners and the glowing warm artificial light sources. High-end real estate evening photography.\n</lighting_mood_night>\n<render_specs>Photorealistic, 8k resolution, architectural night photography, glowing LEDs, cinematic.</render_specs>`
        ];

        setProcessStatus(`Đang tạo 4 Mẫu Render Mood song song...`);

        const promises = moodPrompts.map(async (currentMoodPrompt, i) => {
          const imgResponse = await generateContentWithRetry(ai, {
            model: "gemini-3.1-flash-image-preview",
            contents: [
              {
                role: "user",
                parts: [
                  { text: currentMoodPrompt },
                  {
                    inlineData: {
                      data: imageData.base64Data,
                      mimeType: imageData.mimeType || "image/jpeg",
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              imageConfig: {
                aspectRatio: autoAspectRatio as "1:1" | "16:9" | "4:3" | "3:4" | "9:16",
                imageSize: utilityResolution,
              },
            },
          });

          let base64 = "";
          if (imgResponse.candidates?.[0]?.content?.parts) {
            for (const part of imgResponse.candidates[0].content.parts) {
              if (part?.inlineData?.data) {
                base64 = part.inlineData.data;
                break;
              }
            }
          }

          if (!base64) {
            const candidate = imgResponse.candidates?.[0] as Record<string, unknown> | undefined;
            const finishReason = candidate?.finishReason;
            console.error(
              `Mood ${i} image extraction failed. Full Response:`,
              JSON.stringify(imgResponse, null, 2),
            );
            const safetyRatings = (candidate?.safetyRatings || []) as { blocked?: boolean; probability?: string }[];
            const blockedBySafety = safetyRatings.some(
              (r: { blocked?: boolean; probability?: string }) =>
                r.blocked === true ||
                r.probability === "HIGH" ||
                r.probability === "MEDIUM",
            );
            if (blockedBySafety) {
              throw new Error("❌ Không thể tạo ảnh do chính sách an toàn.");
            }
            throw new Error(`Ảnh trả về rỗng. Vui lòng thử lại. Lỗi: ${finishReason}`);
          }

          const res = await apiClient.post<ApiResponse<{ url: string }>>("/api/v1/media/upload", {
            file: `data:image/png;base64,${base64}`,
            folder: "utilities"
          });
          const resultUrl = res.data.url;
          return { url: resultUrl, storagePath: resultUrl, timestamp: timestampStr };
        });

        const resultsData = await Promise.all(promises);
        setMoodResults(resultsData);
        setMoodHistory((prev) => [...resultsData, ...prev].slice(0, 20));
      } else {
        // Single image generation
        const imgResponse = await generateContentWithRetry(ai, {
          model: "gemini-3.1-flash-image-preview",
          contents: [{ role: "user", parts }],
          systemInstruction: systemInstruction + " Always output an image.",
          generationConfig: {
            imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
          },
        });

        let base64 = "";
        if (imgResponse.candidates?.[0]?.content?.parts) {
          for (const part of imgResponse.candidates[0].content.parts) {
            if (part?.inlineData?.data) {
              base64 = part.inlineData.data;
              break;
            }
          }
        }

        if (!base64) {
          const candidate = imgResponse.candidates?.[0] as Record<string, unknown> | undefined;
          const finishReason = candidate?.finishReason;
          const aiText = typeof imgResponse.text === "function" ? imgResponse.text() : (imgResponse.text || "");
          console.error(
            "Utility image extraction failed. Full Response:",
            JSON.stringify(imgResponse, null, 2),
          );

          // Check safety ratings and prompt feedback
          const safetyRatings =
            (candidate?.safetyRatings || []) as { blocked?: boolean; probability?: string }[];
          const blockedBySafety = safetyRatings.some(
            (r: { blocked?: boolean; probability?: string }) =>
              r.blocked === true ||
              r.probability === "HIGH" ||
              r.probability === "MEDIUM",
          );
          const promptBlocked =
            imgResponse.promptFeedback?.blockReason ||
            (imgResponse.promptFeedback?.safetyRatings?.some(
              (r: { blocked?: boolean }) => r.blocked === true,
            )
              ? "SAFETY"
              : null);

          if (finishReason === "SAFETY" || blockedBySafety || promptBlocked) {
            throw new Error(
              "Phản hồi bị chặn do vi phạm quy tắc an toàn. Vui lòng thử lại với nội dung khác.",
            );
          }
          if (aiText) {
            throw new Error(
              `AI không tạo ảnh mà phản hồi bằng văn bản: "${aiText.substring(0, 100)}...". Vui lòng điều chỉnh yêu cầu.`,
            );
          }
          if (imgResponse.candidates?.length === 0) {
            throw new Error(
              "AI trả về kết quả trống. Vui lòng thử lại với mô tả chi tiết hơn.",
            );
          }
          throw new Error(
            "Không thể trích xuất dữ liệu ảnh từ phản hồi AI. Vui lòng thử lại.",
          );
        }

        const res = await apiClient.post<ApiResponse<{ url: string }>>("/api/v1/media/upload", {
          file: `data:image/png;base64,${base64}`,
          folder: "utilities"
        });
        const url = res.data.url;
        setResults([url]);
        
        if (activeUtility === "google-map") {
          const now = new Date();
          const timestampStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
          setGoogleMapHistory(prev => [{ url, storagePath: url, timestamp: timestampStr }, ...prev].slice(0, 20));
        }
      }

      toast.success("Xử lý thành công!");
    } catch (error) {
      console.error("Utility process error:", error);
      toast.error("Có lỗi xảy ra khi xử lý.");
    } finally {
      setIsProcessing(false);
      setProcessStatus("");
    }
  };

  const renderUtilityContent = () => {
    const utility = utilities.find((u) => u.id === activeUtility);
    if (!utility) return null;

    if (activeUtility === "mood") {
      return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                setActiveUtility(null);
                setInputImage(null);
                setInputImage2(null);
                setResults([]);
                setMoodResults([]);
              }}
              className="flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <Icon name="reply" className="scale-x-[-1] text-lg" />
              Quay Lại Danh Sách
            </button>
            <h2 className="text-lg font-bold text-on-surface">
              Tạo Mood Cho Render
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
            {/* Input Section */}
            <div className="space-y-4">
              <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-on-surface">
                    1. Tải Lên Ảnh Sketch
                  </h3>
                  <div className="flex items-center gap-2">
                    {inputImage && (
                      <button
                        onClick={() => setFullscreenImageUtility(inputImage)}
                        className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors"
                        title="Phóng to"
                      >
                        <Icon name="zoom_out_map" className="text-lg" />
                      </button>
                    )}
                    <button
                      onClick={() => setShowLibraryModalUtility(true)}
                      className="text-primary hover:bg-primary/10 text-xs font-bold px-3 py-1.5 rounded-lg border border-primary/20 transition-colors flex items-center gap-1.5"
                    >
                      <Icon name="photo_library" className="text-sm" />
                      Thư viện
                    </button>
                  </div>
                </div>

                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  onDrop={(e) => handleImageDrop(e, 1)}
                  onDragOver={handleImageDragOver}
                  onDragLeave={handleImageDragLeave}
                  className={`aspect-[2/1] rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden relative ${
                    isDraggingUtility
                      ? "border-primary bg-primary/10"
                      : "border-primary/40 hover:border-primary bg-surface-container-low/30"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleImageUpload(e, 1)}
                  />
                  {inputImage ? (
                    <img
                      src={inputImage}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <>
                      <Icon
                        name="ads_click"
                        className="text-2xl text-on-surface-variant mb-2"
                      />
                      <p className="text-sm font-medium text-on-surface-variant">
                        Nhấp hoặc kéo tệp vào đây
                      </p>
                      <p className="text-xs text-on-surface-variant/70 mt-1">
                        PNG, JPG, WEBP, PDF
                      </p>
                    </>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-surface/80 flex items-center justify-center backdrop-blur-sm z-10 transition-all opacity-100 duration-300">
                      <div className="relative flex items-center justify-center w-16 h-16">
                        <div className="absolute w-full h-full border-4 border-primary/20 rounded-full"></div>
                        <div className="absolute w-full h-full border-4 border-primary/80 rounded-full border-t-transparent animate-spin"></div>
                        <span className="absolute text-xs font-bold text-primary">
                          {Math.round(uploadProgress)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      AI Engine
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={utilityModel}
                        onChange={(e) => setUtilityModel(e.target.value)}
                      >
                        {GEMINI_MODELS.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                      <Icon
                        name="expand_more"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      Độ phân giải
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={utilityResolution}
                        onChange={(e) => setUtilityResolution(e.target.value)}
                      >
                        {RESOLUTIONS.map((res) => (
                          <option key={res.id} value={res.id}>
                            {res.name}
                          </option>
                        ))}
                      </select>
                      <Icon
                        name="expand_more"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleProcess}
                disabled={isProcessing || !inputImage || isUploading}
                className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">
                      {processStatus || "Đang xử lý..."}{" "}
                      {Math.round(moodProgress)}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xl group-hover:scale-110 transition-transform">
                      ✨
                    </span>
                    <span className="text-base">Tạo 4 Moods</span>
                  </>
                )}
              </button>
            </div>

            {/* Result Section */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-5 shadow-sm flex flex-col min-h-[400px]">
              <h3 className="text-sm font-bold text-on-surface mb-4">
                2. Kết Quả
              </h3>

              {isProcessing ? (
                <div className="flex flex-col items-center justify-center flex-1 py-12">
                  <div className="relative flex items-center justify-center w-24 h-24 mb-6">
                    <div className="absolute w-full h-full border-[6px] border-primary/20 rounded-full"></div>
                    <div className="absolute w-full h-full border-[6px] border-primary rounded-full border-t-transparent animate-spin"></div>
                    <span className="text-lg font-bold text-primary">
                      {Math.round(moodProgress)}%
                    </span>
                  </div>
                  <p className="text-sm font-medium text-on-surface-variant flex items-center gap-2">
                    <Icon
                      name="auto_awesome"
                      className="text-primary animate-pulse"
                    />
                    {processStatus || "Đang tạo 4 Mẫu Render Mood..."}
                  </p>
                </div>
              ) : moodResults.length > 0 ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  {moodResults.map((item, idx) => (
                    <div
                      key={idx}
                      className="relative group aspect-video rounded-xl overflow-hidden border border-outline-variant/20"
                    >
                      <img
                        src={item.url}
                        className="w-full h-full object-contain bg-black/20"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => setFullscreenImageUtility(item.url)}
                          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors"
                          title="Phóng to"
                        >
                          <Icon name="zoom_out_map" />
                        </button>
                        <button
                          onClick={() => window.open(item.url, "_blank")}
                          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors"
                          title="Mở trong thẻ mới"
                        >
                          <Icon name="visibility" />
                        </button>
                        <button
                          onClick={() => handleDownload([item.url])}
                          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors"
                          title="Tải xuống"
                        >
                          <Icon name="download" />
                        </button>
                        {item.storagePath && (
                          <button
                            onClick={() =>
                              handleDeleteMoodImage(idx, item.storagePath, false)
                            }
                            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-error flex items-center justify-center hover:bg-error/30 transition-colors"
                            title="Xoá ảnh"
                          >
                            <Icon name="delete" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant/60">
                  <Icon name="light_mode" className="text-4xl mb-4" />
                  <p className="text-sm font-medium">
                    4 kết quả render sẽ xuất hiện ở đây.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* History Section */}
          <div className="mt-2 bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-5">
            <div className="flex items-center justify-between mb-4 text-on-surface">
              <div className="flex items-center gap-2">
                <Icon name="history" className="text-xl" />
                <h3 className="text-sm font-bold">Lịch Sử Tiện Ích</h3>
              </div>
              <span className="text-xs font-medium text-on-surface-variant">
                {moodHistory.length} / 20
              </span>
            </div>
            
            {moodHistory.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {moodHistory.map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-2">
                    <div className="relative group aspect-square rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm">
                      <img
                        src={item.url}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap items-center justify-center content-center gap-2 p-2">
                        <button
                          onClick={() => setFullscreenImageUtility(item.url)}
                          className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors"
                          title="Phóng to"
                        >
                          <Icon name="zoom_out_map" className="text-sm" />
                        </button>
                        <button
                          onClick={() => handleDownload([item.url])}
                          className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors"
                          title="Tải xuống"
                        >
                          <Icon name="download" className="text-sm" />
                        </button>
                        {item.storagePath && (
                          <button
                            onClick={() => handleDeleteMoodImage(idx, item.storagePath, true)}
                            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-error flex items-center justify-center hover:bg-error/30 transition-colors"
                            title="Xoá"
                          >
                            <Icon name="delete" className="text-sm" />
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-on-surface-variant/70 text-center">
                      {item.timestamp || "Vừa xong"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center items-center py-8">
                <p className="text-sm text-on-surface-variant/60">
                  Chưa có lịch sử tiện ích.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    } else if (activeUtility === "google-map") {
      return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                setActiveUtility(null);
                setInputImage(null);
                setResults([]);
                setPrompt("");
              }}
              className="flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <Icon name="reply" className="scale-x-[-1] text-lg" />
              Quay Lại Danh Sách
            </button>
            <h2 className="text-lg font-bold text-on-surface">
              Google Map sang Phối Cảnh 3D
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
            {/* Input Section */}
            <div className="flex flex-col gap-4">
              <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/10">
                <h3 className="text-sm font-bold text-on-surface mb-4">
                  1. Tải Lên Ảnh Chụp Google Map
                </h3>
  
                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  onDrop={(e) => handleImageDrop(e, 1)}
                  onDragOver={handleImageDragOver}
                  onDragLeave={handleImageDragLeave}
                  className={`aspect-[2/1] rounded-xl border border-dashed transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden relative ${
                    isDraggingUtility
                      ? "border-primary bg-primary/10"
                      : "border-outline-variant/30 hover:border-primary bg-surface-container-low/20 hover:bg-surface-container-low/40"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 1)}
                  />
                  {inputImage ? (
                    <img
                      src={inputImage}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <>
                      <p className="text-sm font-medium text-on-surface-variant">
                        Nhấp hoặc kéo tệp vào đây
                      </p>
                      <p className="text-xs text-on-surface-variant/70 mt-1">
                        PNG, JPG, WEBP
                      </p>
                    </>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-surface/80 flex items-center justify-center backdrop-blur-sm z-10 transition-all opacity-100 duration-300">
                      <div className="relative flex items-center justify-center w-16 h-16">
                        <div className="absolute w-full h-full border-4 border-primary/20 rounded-full"></div>
                        <div className="absolute w-full h-full border-4 border-primary/80 rounded-full border-t-transparent animate-spin"></div>
                        <span className="absolute text-xs font-bold text-primary">
                          {Math.round(uploadProgress)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/10">
                <h3 className="text-sm font-bold text-on-surface mb-4">
                  2. Tùy Chỉnh (Tùy chọn)
                </h3>
                <textarea
                  className="w-full bg-surface-container-low/50 border border-outline-variant/20 rounded-xl p-4 text-xs lg:text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary outline-none transition-colors min-h-[90px] resize-none"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Dynamic aerial landscape (drone shot), perspective view, sharp focus, harbor by the sea, mountains in the background, soft overcast light."
                ></textarea>
              </div>

              <button
                onClick={handleProcess}
                disabled={isProcessing || !inputImage || isUploading}
                className="w-full bg-[#414E6E] text-white font-bold py-3 rounded-lg hover:bg-[#4d5b7f] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">
                      Đang xử lý...
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-lg group-hover:scale-110 transition-transform">
                      ✨
                    </span>
                    <span className="text-sm">Tạo Phối Cảnh 3D</span>
                  </>
                )}
              </button>
            </div>

            {/* Result Section */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-5 shadow-sm flex flex-col min-h-[400px]">
              <h3 className="text-sm font-bold text-on-surface mb-4">
                3. Kết Quả
              </h3>

              {isProcessing ? (
                <div className="flex flex-col items-center justify-center flex-1 py-12">
                  <div className="relative flex items-center justify-center w-24 h-24 mb-6">
                    <div className="absolute w-full h-full border-[2px] border-error/50 rounded-full"></div>
                    <div className="absolute w-full h-full border-[2px] border-error rounded-full border-t-transparent animate-spin"></div>
                  </div>
                </div>
              ) : results.length > 0 ? (
                <div className="flex-1 grid grid-cols-1 gap-4">
                  <div className="relative group rounded-xl overflow-hidden bg-surface-container-low flex items-center justify-center">
                    <img
                      src={results[0]}
                      className="w-full h-full object-contain max-h-[600px] cursor-zoom-in"
                      referrerPolicy="no-referrer"
                      onClick={() => setFullscreenImageUtility(results[0])}
                    />
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setFullscreenImageUtility(results[0])}
                        className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-primary transition-colors backdrop-blur-md"
                        title="Phóng to"
                      >
                        <Icon name="zoom_out_map" className="text-lg" />
                      </button>
                      <a
                        href={results[0]}
                        download="igen_google_map_3d.png"
                        className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-primary transition-colors backdrop-blur-md"
                        title="Tải xuống"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="download" className="text-lg" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 rounded-xl flex flex-col items-center justify-center px-4 py-12">
                  <div className="flex items-center justify-center mb-4 text-on-surface-variant/40 gap-4">
                    <Icon name="open_in_full" className="text-[40px] font-light" />
                  </div>
                  <p className="text-xs text-on-surface-variant/60 font-medium">
                    Kết quả phối cảnh 3D sẽ xuất hiện ở đây.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Lịch Sử Tiện Ích */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-5 shadow-sm flex flex-col mt-2">
            <div className="flex items-center justify-between mb-4 text-on-surface">
              <div className="flex items-center gap-2">
                <Icon name="history" className="text-xl" />
                <h3 className="text-sm font-bold">Lịch Sử Tiện Ích</h3>
              </div>
              <span className="text-xs font-medium text-on-surface-variant">
                {googleMapHistory.length} / 20
              </span>
            </div>
            
            {googleMapHistory.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {googleMapHistory.map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-2">
                    <div className="relative group aspect-square rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm">
                      <img
                        src={item.url}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap items-center justify-center content-center gap-2 p-2">
                        <button
                          onClick={() => setFullscreenImageUtility(item.url)}
                          className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors"
                          title="Phóng to"
                        >
                          <Icon name="zoom_out_map" className="text-sm" />
                        </button>
                        <a
                          href={item.url}
                          download={`igen_google_map_3d_history_${idx}.png`}
                          className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors"
                          title="Tải xuống"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Icon name="download" className="text-sm" />
                        </a>
                        <button
                          onClick={() => handleDeleteGoogleMapHistory(idx, item.storagePath)}
                          className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-error flex items-center justify-center hover:bg-error/30 transition-colors"
                          title="Xoá"
                        >
                          <Icon name="delete" className="text-sm" />
                        </button>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-on-surface-variant/70 text-center">
                      {item.timestamp || "Vừa xong"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center items-center py-8">
                <p className="text-sm text-on-surface-variant/60">
                  Chưa có lịch sử tiện ích.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => {
              setActiveUtility(null);
              setInputImage(null);
              setInputImage2(null);
              setResults([]);
              setMoodResults([]);
            }}
            className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-surface-container-high transition-colors"
          >
            <Icon name="arrow_back" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-on-surface">
              {utility.title}
            </h2>
            <p className="text-sm text-on-surface-variant">
              {utility.description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-sm">
              <h3 className="text-base font-bold text-on-surface mb-4">
                1. Tải lên dữ liệu
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-outline-variant/30 hover:border-primary/50 transition-all cursor-pointer flex flex-col items-center justify-center bg-surface-container-low/30 overflow-hidden relative"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 1)}
                  />
                  {inputImage ? (
                    <img
                      src={inputImage}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <>
                      <Icon
                        name="add_photo_alternate"
                        className="text-3xl text-on-surface-variant/50 mb-2"
                      />
                      <p className="text-xs font-medium text-on-surface-variant">
                        Ảnh chính (Sketch/Map/Site)
                      </p>
                    </>
                  )}
                </div>

                {(activeUtility === "insert-building" ||
                  activeUtility === "merge-interior") && (
                  <div
                    onClick={() => fileInputRef2.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-outline-variant/30 hover:border-primary/50 transition-all cursor-pointer flex flex-col items-center justify-center bg-surface-container-low/30 overflow-hidden relative"
                  >
                    <input
                      type="file"
                      ref={fileInputRef2}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 2)}
                    />
                    {inputImage2 ? (
                      <img
                        src={inputImage2}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <>
                        <Icon
                          name="add_photo_alternate"
                          className="text-3xl text-on-surface-variant/50 mb-2"
                        />
                        <p className="text-xs font-medium text-on-surface-variant">
                          Ảnh phụ (Building/Furniture)
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleProcess}
              disabled={isProcessing || !inputImage || isUploading}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{processStatus || "Đang xử lý..."}</span>
                </>
              ) : (
                <>
                  <Icon name="auto_awesome" />
                  <span>Bắt đầu xử lý AI</span>
                </>
              )}
            </button>
          </div>

          {/* Result Section */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-sm flex flex-col">
            <h3 className="text-base font-bold text-on-surface mb-4">
              2. Kết quả xử lý
            </h3>

            {results.length > 0 ? (
              <div
                className={`grid gap-4 ${results.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {results.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-outline-variant/20"
                  >
                    <img
                      src={url}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => window.open(url, "_blank")}
                        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors"
                      >
                        <Icon name="visibility" />
                      </button>
                      <button
                        onClick={() => handleDownload([url])}
                        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors"
                      >
                        <Icon name="download" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant/40 py-12">
                <Icon
                  name="auto_fix_high"
                  className="text-6xl mb-4 opacity-20"
                />
                <p className="text-sm font-medium">
                  Kết quả sẽ xuất hiện tại đây sau khi xử lý.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-surface flex flex-col">
      {activeUtility ? (
        renderUtilityContent()
      ) : (
        <div className="w-full">
          <h2 className="text-lg font-bold mb-4 text-on-surface text-left border-b border-outline-variant/20 pb-4">
            Danh Sách Tiện Ích
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {utilities.map((utility) => (
              <button
                key={utility.id}
                onClick={() => setActiveUtility(utility.id)}
                className={`flex flex-col items-center justify-center text-center p-8 rounded-2xl border transition-all duration-200 min-h-[200px] group ${
                  activeUtility === utility.id
                    ? "bg-primary/5 border-primary text-primary shadow-sm"
                    : "bg-surface-container-lowest border-outline-variant/20 text-on-surface hover:bg-surface-container-low hover:border-outline-variant/40"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
                    activeUtility === utility.id
                      ? "bg-primary/10 text-primary"
                      : "bg-surface-container-low text-on-surface-variant group-hover:bg-surface-container"
                  }`}
                >
                  <Icon name={utility.icon} className="text-3xl" />
                </div>
                <h3
                  className={`text-lg font-bold mb-3 ${activeUtility === utility.id ? "text-primary" : "text-on-surface"}`}
                >
                  {utility.title}
                </h3>
                <p
                  className={`text-sm ${activeUtility === utility.id ? "text-primary/80" : "text-on-surface-variant"}`}
                >
                  {utility.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <ImageLibraryModal
        isOpen={showLibraryModalUtility}
        onClose={() => setShowLibraryModalUtility(false)}
        onSelectImages={([url]) => {
          if (url) {
            setInputImage(url);
          }
          setShowLibraryModalUtility(false);
        }}
      />

      {fullscreenImageUtility && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setFullscreenImageUtility(null)}
        >
          <button
            className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-[51]"
            onClick={() => setFullscreenImageUtility(null)}
          >
            <Icon name="close" />
          </button>
          <img
            src={fullscreenImageUtility}
            className="max-w-full max-h-full object-contain contain-layout relative z-50"
            alt="Fullscreen"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
};

