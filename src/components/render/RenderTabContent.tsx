import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Icon } from "../Icon";
import { toast } from "sonner";
import { useAuth } from "../../context/useAuth";
import { apiClient, ApiResponse } from "../../services/apiClient";
import { ImageLibraryModal } from "./ImageLibraryModal";
import { getAIClient, safeJsonParse, checkUserCredits, generateContentWithRetry, getImageBase64, handleDownload, cacheImage, uploadMedia } from "../../lib/renderUtils";
import { convertPdfToImage } from "../../lib/pdfUtils";

interface RenderJob {
  _id?: string;
  id?: string;
  type?: string;
  status: string;
  progress?: number;
  statusMessage?: string;
  createdAt?: string | { toMillis?: () => number } | null;
  inputImageUrls?: string[];
  outputImageUrls?: string[];
  settings?: {
    prompt?: string;
    numImages?: number;
    aspectRatio?: string;
    model?: string;
    resolution?: string;
  };
}

const MODELS = [
  {
    id: "gemini-3-pro-image",
    name: "iGen 3 Pro Image",
    isPro: true,
  },
  {
    id: "gemini-3.1-flash-image",
    name: "iGen 3.1 Flash Image",
    isPro: false,
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro (PiAPI)",
    isPro: true,
  },
];

const RESOLUTIONS = [
  { id: "1K", name: "1K Full HD" },
  { id: "2K", name: "2K Quad HD" },
];

const subTabs = [
  { id: "Render Ngoại Thất", icon: "home" },
  { id: "Render Nội Thất", icon: "chair" },
  { id: "Render VR 360", icon: "lock", isLocked: true },
  { id: "Floorplan to 3D", icon: "view_in_ar" },
  { id: "Floorplan to 3D Floorplan", icon: "grid_view" },
  { id: "Masterplan to 3D", icon: "map" },
];

interface RenderTabContentProps {
  isAdmin: boolean;
}

export const RenderTabContent: React.FC<RenderTabContentProps> = ({ isAdmin: _isAdmin }) => {
  const [activeSubTab, setActiveSubTab] = useState("Render Ngoại Thất");
  const [numImages, setNumImages] = useState(1);

  const [inputImages, setInputImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRendering, setIsRendering] = useState(false);

  // Form states
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("Ảnh chụp thực tế công trình");
  const [context, setContext] = useState("");
  const [lighting, setLighting] = useState("");
  const [colorTone, setColorTone] = useState("");
  const [roomType, setRoomType] = useState("");
  const [interiorStyle, setInteriorStyle] = useState("");
  const [buildingStyle, setBuildingStyle] = useState("Căn hộ");
  const [cameraAngleStyle, setCameraAngleStyle] = useState(
    "Phối cảnh Trục đo (Isometric)",
  );
  const [aspectRatio, setAspectRatio] = useState("Tự động");
  const [cameraAngle, setCameraAngle] = useState("");
  const [customCameraAngle, setCustomCameraAngle] = useState("");

  const [prompt, setPrompt] = useState("");
  const [promptModel, setPromptModel] = useState("gemini-2.5-flash");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptProgress, setPromptProgress] = useState(0);
  const [promptStatus, setPromptStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingRef, setIsDraggingRef] = useState(false);

  const [selectedModel, setSelectedModel] = useState(
    "gemini-3-pro-image",
  );
  const [selectedResolution, setSelectedResolution] = useState("1K");

  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [showVRModal, setShowVRModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<"input" | "reference">(
    "input",
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [uploadProgressRef, setUploadProgressRef] = useState(0);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<RenderJob | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [smoothProgress, setSmoothProgress] = useState<{
    [jobId: string]: number;
  }>({});
  const [smoothPromptProgress, setSmoothPromptProgress] = useState(0);
  const [smoothRenderProgress, setSmoothRenderProgress] = useState(0);
  const [sessionStartTimeMs] = useState(() => Date.now());

  const isCurrentSession = (job: RenderJob) => {
    if (!job.createdAt) return true;
    const jobTimeMs = (typeof job.createdAt === "object" && job.createdAt && "toMillis" in job.createdAt && typeof job.createdAt.toMillis === "function")
      ? job.createdAt.toMillis()
      : new Date(job.createdAt as string).getTime();
    return jobTimeMs >= sessionStartTimeMs;
  };

  useEffect(() => {
    // Reset states when switching sub-tabs
    setTimeout(() => {
      setInputImages([]);
      setReferenceImages([]);
      setPrompt("");
      setDescription("");
      setContext("");
      setLighting("");
      setColorTone("");
      setRoomType("");
      setInteriorStyle("");
      setCameraAngle("");
      setCustomCameraAngle("");
      setAspectRatio("Tự động");

      // Set defaults based on activeSubTab
      if (activeSubTab === "Render Ngoại Thất") {
        setStyle("Ảnh chụp thực tế công trình");
      } else if (activeSubTab === "Render Nội Thất") {
        setStyle("Ảnh chụp thực tế nội thất");
      } else if (activeSubTab === "Render VR 360") {
        setStyle("Ảnh Panorama 360 độ");
        setAspectRatio("21:9 (Panorama)");
      } else if (activeSubTab === "Floorplan to 3D") {
        setStyle("Phối cảnh thực tế");
        setCameraAngleStyle("Ảnh cầm tay ngang tầm mắt");
      } else if (activeSubTab === "Floorplan to 3D Floorplan") {
        setStyle("Ảnh phối cảnh 3D mặt bằng");
        setInteriorStyle("Hiện đại");
        setLighting("Có nắng");
        setBuildingStyle("Căn hộ");
        setCameraAngleStyle("Phối cảnh Trục đo (Isometric)");
      } else if (activeSubTab === "Masterplan to 3D") {
        setStyle("Ảnh phối cảnh 3D tổng thể");
        setPrompt(
          "Ảnh chụp thực tế công trình. Biến bản vẽ mặt bằng tổng thể này thành ảnh phối cảnh 3D thực tế từ trên cao.",
        );
      }
    }, 0);
  }, [activeSubTab]);

  // Reset prompt when core parameters change to encourage re-analysis and ensure output matches selected options
  useEffect(() => {
    if (prompt && !prompt.includes("Biến bản vẽ mặt bằng tổng thể")) {
      setTimeout(() => setPrompt(""), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    style,
    context,
    lighting,
    colorTone,
    description,
    cameraAngle,
    customCameraAngle,
    activeSubTab,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSmoothProgress((prev) => {
        const next = { ...prev };
        let changed = false;
        renderJobs.forEach((job) => {
          if (job.status === "pending" || job.status === "processing") {
            const target = job.progress || 10;
            const current = prev[job.id] || 0;
            if (current < target) {
              next[job.id] = current + 1;
              changed = true;
            } else if (current < 95 && current >= target) {
              next[job.id] = current + 0.1;
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });

      setSmoothPromptProgress((prev) => {
        if (!isGeneratingPrompt) return 0;
        const target = promptProgress;
        if (prev < target) {
          return prev + 2; // Fast catch up
        } else if (prev < 95 && prev >= target) {
          return prev + 0.2; // Slow progress while waiting
        }
        return prev;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [renderJobs, isGeneratingPrompt, promptProgress]);

  const handleDeleteInputImage = async (
    urlToDelete: string,
    index: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setInputImages((prev) => prev.filter((_, i) => i !== index));
    if (urlToDelete.includes("cloudinary.com")) {
      try {
        await apiClient.delete("/api/v1/media", {
          body: { publicId: urlToDelete }
        });
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
      }
    }
  };

  const handleDeleteRefImage = async (
    urlToDelete: string,
    index: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
    if (urlToDelete.includes("cloudinary.com")) {
      try {
        await apiClient.delete("/api/v1/media", {
          body: { publicId: urlToDelete }
        });
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
      }
    }
  };

  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      const imageData = await getImageBase64(url, false);
      const byteCharacters = atob(imageData.base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: imageData.mimeType });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Có lỗi xảy ra khi tải ảnh.");
    }
  };

  const handleDeleteJob = async (job: RenderJob) => {
    try {
      await apiClient.delete(`/api/v1/render-jobs/${job._id || job.id}`);

      if (job.outputImageUrls && job.outputImageUrls.length > 0) {
        for (const url of job.outputImageUrls) {
          if (url.includes("cloudinary.com")) {
            try {
              await apiClient.delete("/api/v1/media", {
                body: { publicId: url }
              });
            } catch (error) {
              console.error("Error deleting output image:", error);
            }
          }
        }
      }
      toast.success("Đã xóa render job.");
    } catch (error) {
      console.error("Error deleting job:", error);
      toast.error("Có lỗi xảy ra khi xóa. Vui lòng thử lại.");
    } finally {
      setJobToDelete(null);
    }
  };

  const { user, socket } = useAuth();

  useEffect(() => {
    if (!user) {
      setTimeout(() => setRenderJobs([]), 0);
      return;
    }

    const fetchJobs = async () => {
      try {
        const res = await apiClient.get<ApiResponse<RenderJob[]>>("/api/v1/render-jobs?limit=50");
        if (res.success && Array.isArray(res.data)) {
          setRenderJobs(res.data);
        }
      } catch (e) {
        console.error("Error fetching render jobs:", e);
      }
    };
    fetchJobs();
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    const handleJobUpdate = (updatedJob: RenderJob) => {
      setRenderJobs((prevJobs) => {
        const exists = prevJobs.some(j => (j._id || j.id) === (updatedJob._id || updatedJob.id));
        if (exists) {
          return prevJobs.map(j => (j._id || j.id) === (updatedJob._id || updatedJob.id) ? updatedJob : j);
        } else {
          return [updatedJob, ...prevJobs];
        }
      });
    };

    socket.on("renderJobUpdated", handleJobUpdate);
    return () => {
      socket.off("renderJobUpdated", handleJobUpdate);
    };
  }, [socket]);

  const handleGeneratePrompt = async () => {
    setIsGeneratingPrompt(true);
    setSmoothPromptProgress(0);
    setPromptProgress(10);
    setPromptStatus("Khởi tạo...");
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

      setPromptProgress(30);
      setPromptStatus("Đang xử lý ảnh đầu vào...");

      setPromptProgress(60);
      setPromptStatus("AI đang phân tích và tạo prompt...");

      if (activeSubTab === "Render Ngoại Thất") {
        if (inputImages.length > 0) {
          parts.push({
            text: "Đây là ảnh Reference Image (Bắt buộc giữ nguyên 100% cấu trúc):",
          });
          for (const url of inputImages) {
            parts.push(await getImagePart(url));
          }
          if (referenceImages.length > 0) {
            parts.push({ text: "Style Inspiration Images:" });
            for (const url of referenceImages) {
              parts.push(await getImagePart(url));
            }
          }
          parts.push({
            text: `Thông số UI từ iGen:
    - Style ảnh: ${style || "Ảnh chụp thực tế"}
    - Tone màu: ${colorTone || "Mặc định"}
    - Bối cảnh: ${context || "Mặc định"}
    - Ánh sáng: ${lighting || "Mặc định"}
    - Góc chụp: ${customCameraAngle || cameraAngle || "Bám sát ảnh gốc"}
    - Mô tả tuỳ chỉnh: ${description || "Tối ưu hóa vật liệu và cảnh quan."}`,
          });
        } else {
          parts.push({
            text: `Người dùng KHÔNG tải lên ảnh (State 2). Hãy tự thiết kế kiến trúc từ đầu dựa trên thông số sau:
    - Style ảnh: ${style || "Ảnh chụp thực tế"}
    - Tone màu: ${colorTone || "Mặc định"}
    - Bối cảnh: ${context || "Mặc định"}
    - Ánh sáng: ${lighting || "Mặc định"}
    - Góc chụp: ${customCameraAngle || cameraAngle || "Góc nhìn mắt người chuyên nghiệp"}
    - Mô tả tuỳ chỉnh: ${description || "Một ngôi nhà hiện đại tuyệt đẹp."}`,
          });
        }
      } else {
        if (inputImages.length > 0) {
          parts.push({
            text: "Reference Image (Structure/Layout to preserve):",
          });
          for (const url of inputImages) {
            parts.push(await getImagePart(url));
          }
        }

        if (referenceImages.length > 0) {
          parts.push({ text: "Style Inspiration Images:" });
          for (const url of referenceImages) {
            parts.push(await getImagePart(url));
          }
        }

        let floorplanStylePrompt = "";
        if (activeSubTab === "Floorplan to 3D") {
          if (style === "Phối cảnh thực tế") {
            floorplanStylePrompt = `- Kiểu chụp: Ảnh cầm tay ngang tầm mắt từ cửa phòng đi vào, không phải góc cao panorama.
- Tiêu điểm ảnh: giữ nguyên giường ngủ, tab đầu giường, bàn trang điểm bên trái, tủ áo gỗ bên phải, cửa kính ban công phía trước; che khuất nhà vệ sinh và các phòng phụ sau góc khuất camera.
- Bố cục: giữ nguyên 100% vị trí đồ đạc, tường ngăn, cửa và lối đi theo bản vẽ gốc; không thêm đồ đạc mới, không dịch chuyển nội thất.
`;
          } else if (style === "Phối cảnh 3D") {
            floorplanStylePrompt = `- Kiểu chụp: Góc nhìn trục đo isometric / dollhouse, tường cắt lửng và không có trần nhà để quan sát bố cục mặt bằng rõ ràng.
- Tiêu điểm ảnh: giữ nguyên vị trí tường, cửa, cầu thang, phòng và đồ nội thất theo bản vẽ, ưu tiên thể hiện cấu trúc không gian 3D.
- Bố cục: giữ nguyên 100% vị trí đồ đạc, tường ngăn và cửa theo mặt bằng; không thay đổi vị trí nội thất hoặc mở rộng không gian.
`;
          } else if (style === "Mô hình thu nhỏ") {
            floorplanStylePrompt = `- Kiểu chụp: Mô hình thu nhỏ tilt-shift, hiệu ứng sa bàn kiến trúc với nền mờ, sâu trường nhỏ, tỷ lệ thu nhỏ rõ rệt.
- Tiêu điểm ảnh: giữ nguyên vị trí đồ đạc theo bản vẽ, tôn trọng tường ngăn, và tạo cảm giác vật lý rõ ràng của sa bàn.
- Bố cục: tuyệt đối không di chuyển đồ đạc, không đặt đồ đạc xuyên tường, không thêm cửa hoặc phá vỡ mặt bằng.
`;
          }
        }

        const floorplanCleanupPrompt = `- Quy tắc làm sạch bản vẽ: chỉ dùng bản vẽ để suy luận bố cục không gian. PHẢI xóa hoàn toàn mọi chữ, nhãn phòng, số kích thước, hatch, nét đứt, ký hiệu CAD, mũi tên, khung tên, watermark và mọi dấu vết đồ họa 2D của bản vẽ gốc.
- Kết quả cuối: ảnh phối cảnh 3D sạch, không còn cảm giác ảnh bản vẽ được tô màu, không còn annotation hay text kỹ thuật.
`;

        const textPrompt = `
- Mô tả ý tưởng: ${description || "Không có"}
${activeSubTab === "Render Nội Thất"
            ? `
- Style ảnh: ${style || "Không có"}
- Chức năng phòng: ${roomType || "Không có"}
- Phong cách nội thất: ${interiorStyle || "Không có"}
- Ánh sáng: ${lighting || "Không có"}
- Tone màu: ${colorTone || "Không có"}
`
            : activeSubTab === "Floorplan to 3D"
              ? `
- Style render: ${style || "Không có"}
- Loại phòng: ${roomType || "Không có"}
- Phong cách: ${interiorStyle || "Không có"}
${floorplanStylePrompt}${floorplanCleanupPrompt}- Quy tắc bố cục: giữ nguyên 100% vị trí tường, cửa, cửa sổ, và đồ đạc theo bản vẽ. KHÔNG di chuyển giường, tủ áo, bàn trang điểm, rèm, hoặc cửa sổ. KHÔNG đổi vị trí nội thất hay làm lệch bố cục mặt bằng.
`
              : activeSubTab === "Floorplan to 3D Floorplan"
                ? `
- Loại ảnh: ảnh bản vẽ mặt bằng kỹ thuật 2D, KHÔNG PHẢI ảnh nội thất.
- CHÚ Ý: đây là bản vẽ floorplan 2D kỹ thuật với tường dày, cánh cửa, và ký hiệu phòng. KHÔNG chuyển sang kiểu ảnh chụp nội thất; chỉ dựng lại đúng cấu trúc mặt bằng sang phối cảnh 3D.
- Style công trình: ${buildingStyle || "Không có"}
- Phong cách: ${interiorStyle || "Không có"}
- Quy tắc nhận diện bản vẽ: dùng tường ngăn, vách ngăn, cửa và ký hiệu phòng để xác định vị trí chính xác của từng đồ đạc.
- Quy tắc làm sạch bản vẽ: phải xóa hoàn toàn chữ, nhãn phòng, số đo, hatch, nét CAD, mũi tên, khung tên và mọi dấu vết 2D không thuộc mô hình 3D cuối.
- Bố cục: giữ nguyên tuyệt đối vị trí tường, cửa, phòng và đồ đạc theo bản vẽ; không thêm cửa, không dịch chuyển hay mở rộng không gian.
- Nếu tủ áo nằm sau bức tường, tủ phải ở trong phòng tương ứng và KHÔNG được đặt xuyên qua tường.
`
                : `
- Style ảnh: ${style || "Không có"}
- Tone màu: ${colorTone || "Không có"}
- Bối cảnh: ${context || "Không có"}
- Ánh sáng: ${lighting || "Không có"}
`
          }
`;

        parts.push({ text: textPrompt });
      }

      const response = await generateContentWithRetry(ai, {
        model: promptModel,
        promptTemplateKey: "render_tab_prompt",
        promptTemplateInput: {
          activeSubTab,
          description,
          style,
          roomType,
          interiorStyle,
          lighting,
          colorTone,
          context,
          buildingStyle,
          cameraAngle,
          customCameraAngle,
          cameraAngleStyle,
          images: await Promise.all(
            inputImages.map(async (url) => {
              const imageData = await getImageBase64(url);
              return {
                data: imageData.base64Data,
                mimeType: imageData.mimeType,
              };
            }),
          ),
          referenceImages: await Promise.all(
            referenceImages.map(async (url) => {
              const imageData = await getImageBase64(url);
              return {
                data: imageData.base64Data,
                mimeType: imageData.mimeType,
              };
            }),
          ),
        },
      });

      try {
        const rawText = typeof response.text === "function" ? response.text() : response.text;
        const jsonStr = rawText?.trim() || "{}";
        const result = safeJsonParse(jsonStr);
        setPrompt(JSON.stringify(result, null, 2));
        setPromptProgress(100);
        setPromptStatus("Hoàn tất!");
      } catch (parseError) {
        console.error("Error parsing JSON response:", parseError);
        const rawText = typeof response.text === "function" ? response.text() : response.text;
        setPrompt(rawText || "");
        setPromptProgress(100);
        setPromptStatus("Hoàn tất!");
      }
    } catch (error) {
      console.error("Error generating prompt:", error);
      const err = error as Error;
      if (err.message !== "Bạn đã hết Credits. Vui lòng nạp thêm.") {
        toast.error("Đã xảy ra lỗi khi tạo prompt. Vui lòng thử lại.");
      }
    } finally {
      setTimeout(() => {
        setIsGeneratingPrompt(false);
        setPromptProgress(0);
        setPromptStatus("");
      }, 500);
    }
  };

  const handleRender = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để render.");
      return;
    }
    if (!prompt) {
      toast.error("Vui lòng tạo prompt hoàn chỉnh trước khi render.");
      return;
    }

    setIsRendering(true);
    setSmoothRenderProgress(15);
    let progress = 15;
    const progressInterval = setInterval(() => {
      progress += (90 - progress) * 0.05;
      setSmoothRenderProgress(Math.floor(progress));
    }, 300);

    try {
      const jobData = {
        userId: user._id,
        type: activeSubTab,
        inputImageUrls: inputImages,
        referenceImageUrls: referenceImages,
        status: "pending",
        progress: 10,
        statusMessage: "Khởi tạo...",
        createdAt: new Date().toISOString(),
        settings: {
          description,
          style,
          context,
          lighting,
          colorTone,
          prompt,
          numImages,
          aspectRatio,
          model: selectedModel,
          resolution: selectedResolution,
        },
      };

      const jobRes = await apiClient.post<ApiResponse<RenderJob>>("/api/v1/render-jobs", jobData);
      clearInterval(progressInterval);
      setSmoothRenderProgress(100);

      if (!jobRes.success || !jobRes.data) {
        throw new Error("Không thể khởi tạo render job trên server.");
      }

      if (jobRes.data && jobRes.data.status === "completed") {
        toast.success("Kết xuất thành công bằng Gemini!");
      } else {
        toast.success("Đã gửi yêu cầu kết xuất lên hàng đợi PiAPI!");
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Error creating render job:", error);
      toast.error("Đã xảy ra lỗi khi tạo yêu cầu render.");
    } finally {
      setTimeout(() => {
        setIsRendering(false);
        setSmoothRenderProgress(0);
      }, 500);
    }
  };


  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    if (!user) {
      toast.error("Vui lòng đăng nhập để tải ảnh lên.");
      return;
    }

    if (!(await checkUserCredits())) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const processedFilesNested = await Promise.all(
        files.map(async (file) => {
          if (file.type === "application/pdf") {
            try {
              toast.info(`Đang chuyển đổi PDF ${file.name}...`);
              return await convertPdfToImage(file);
            } catch (error) {
              console.error("Error converting PDF:", error);
              toast.error(`Không thể chuyển đổi file PDF ${file.name}`);
              return null;
            }
          }
          return file;
        }),
      );

      const processedFiles = processedFilesNested.flat();
      const validFiles = processedFiles.filter(
        (file): file is File => file !== null,
      );

      if (validFiles.length === 0) {
        setIsUploading(false);
        return;
      }

      const downloadURLs: string[] = [];
      let idx = 0;
      for (const file of validFiles) {
        setUploadProgress(Math.round((idx / validFiles.length) * 100));
        const url = await uploadMedia(file, "uploads");
        cacheImage(url, file);


        downloadURLs.push(url);
        idx++;
      }

      setInputImages((prev) => [...prev, ...downloadURLs]);
      setIsUploading(false);
    } catch (error) {
      console.error("Error initiating upload:", error);
      setIsUploading(false);
      toast.error("Đã xảy ra lỗi khi tải ảnh lên.");
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []) as File[];
    await processFiles(files);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    await processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRefImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []) as File[];
    await processRefFiles(files);
  };

  const handleDropRef = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingRef(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    await processRefFiles(files);
  };

  const handleDragOverRef = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingRef(true);
  };

  const handleDragLeaveRef = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingRef(false);
  };

  const processRefFiles = async (files: File[]) => {
    if (files.length === 0) return;

    if (!user) {
      toast.error("Vui lòng đăng nhập để tải ảnh lên.");
      return;
    }

    if (!(await checkUserCredits())) return;
    setIsUploadingRef(true);
    setUploadProgressRef(0);

    try {
      const downloadURLs: string[] = [];
      let idx = 0;
      for (const file of files) {
        setUploadProgressRef(Math.round((idx / files.length) * 100));
        const url = await uploadMedia(file, "uploads");
        cacheImage(url, file);


        downloadURLs.push(url);
        idx++;
      }

      setReferenceImages((prev) => [...prev, ...downloadURLs]);
      setIsUploadingRef(false);
    } catch (error) {
      console.error("Error initiating upload:", error);
      setIsUploadingRef(false);
      toast.error("Đã xảy ra lỗi khi tải ảnh lên.");
    }
  };

  const allResultItems = renderJobs
    .filter((job) => job.type === activeSubTab)
    .flatMap((job) => {
      const jobId = job._id || job.id;
      if (job.status === "pending" || job.status === "processing") {
        return [
          {
            id: `pending-${jobId}`,
            jobId: jobId,
            status: "pending",
            url: job.inputImageUrls?.[0] || "",
            type: job.type,
            createdAt: job.createdAt,
            job: job,
          },
        ];
      } else if (job.outputImageUrls && job.outputImageUrls.length > 0) {
        return job.outputImageUrls.map((url: string, index: number) => ({
          id: `completed-${jobId}-${index}`,
          jobId: jobId,
          status: "completed",
          url: url,
          type: job.type,
          createdAt: job.createdAt,
          job: job,
        }));
      } else {
        return [
          {
            id: `error-${jobId}`,
            jobId: jobId,
            status: "error",
            url: "",
            type: job.type,
            createdAt: job.createdAt,
            job: job,
          },
        ];
      }
    });

  const currentResultItems = allResultItems.filter((item) =>
    isCurrentSession(item.job),
  );
  const historyResultItems = allResultItems
    .filter((item) => !isCurrentSession(item.job))
    .slice(0, 20);

  const selectedItem =
    allResultItems.find((item) => item.id === selectedResultId) ||
    currentResultItems.find((item) => item.status === "completed") ||
    currentResultItems[0];

  return (
    <div className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto">
      {/* Sub-tabs */}
      <div className="flex items-center justify-center gap-2 w-full">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.isLocked || tab.id === "Render VR 360") {
                setShowVRModal(true);
              } else {
                setActiveSubTab(tab.id);
              }
            }}
            className={`flex items-center justify-center gap-1.5 w-[180px] py-2 rounded-full text-xs lg:text-[13px] font-semibold transition-all whitespace-nowrap ${
              tab.isLocked
                ? "opacity-60 text-on-surface-variant/70 hover:bg-surface-container-low"
                : activeSubTab === tab.id
                ? "bg-primary text-white shadow-md"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            }`}
          >
            <Icon name={tab.icon} className="text-[16px]" />
            {tab.id}
          </button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row gap-8 flex-1 min-h-[600px] items-start"
      >
        {/* Left Sidebar */}
        <div className="w-full lg:w-[380px] flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-on-surface">
                {activeSubTab.includes("Floorplan")
                  ? "1. Tải lên ảnh Floorplan"
                  : activeSubTab === "Masterplan to 3D"
                    ? "1. Tải Lên Masterplan"
                    : `1. Tải Lên Ảnh ${activeSubTab === "Render Nội Thất" ? "Nội Thất" : "Ngoại Thất"}`}
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
            <div
              className={`min-h-[12rem] max-h-[30rem] h-auto border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center group transition-colors cursor-pointer relative overflow-hidden ${isDragging
                  ? "border-primary bg-primary/10"
                  : "border-outline-variant/40 hover:border-primary/50 bg-surface-container-low/50 hover:bg-surface-container-low"
                }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/webp, application/pdf"
                multiple
                onChange={handleImageUpload}
              />

              {isUploading ? (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-sm font-semibold text-primary">
                    Đang tải lên... {Math.round(uploadProgress)}%
                  </p>
                </div>
              ) : inputImages.length > 0 ? (
                <div className="relative w-full h-full flex flex-wrap gap-2 p-2 overflow-y-auto">
                  {inputImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 rounded-lg overflow-hidden group/item cursor-zoom-in"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImageUrl(img);
                      }}
                    >
                      <img
                        src={img}
                        alt={`Uploaded ${idx}`}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        onClick={(e) => handleDeleteInputImage(img, idx, e)}
                        className="absolute top-1 right-1 bg-black/50 hover:bg-black/80 text-white rounded-full p-1 opacity-70 hover:opacity-100 transition-all"
                      >
                        <Icon name="close" className="text-[14px]" />
                      </button>
                    </div>
                  ))}
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed border-outline-variant/40 flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors cursor-pointer">
                    <Icon name="add" className="text-2xl" />
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
                    Kéo thả hoặc nhấp để tải ảnh lên
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    PNG, JPG, WEBP, PDF
                  </p>
                </>
              )}
            </div>
          </div>

          <motion.div layout className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
            <h3 className="text-base font-bold text-on-surface mb-4">
              {activeSubTab === "Floorplan to 3D Floorplan"
                ? "2. Tùy Chọn & Phân Tích"
                : "2. Mô Tả & Tùy Chọn"}
            </h3>

            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-on-surface-variant">
                    Ảnh tham khảo (Style/Structure)
                  </label>
                  <button
                    onClick={() => {
                      setLibraryTarget("reference");
                      setShowLibraryModal(true);
                    }}
                    className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Icon name="photo_library" className="text-[16px]" />
                    Thư viện ảnh
                  </button>
                </div>
                <div
                  className={`min-h-[5rem] max-h-[15rem] h-auto border border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors relative overflow-hidden group ${isDraggingRef
                      ? "border-primary bg-primary/10"
                      : "border-outline-variant/40 hover:border-primary/50 bg-surface-container-low/30 hover:bg-surface-container-low"
                    }`}
                  onClick={() => refInputRef.current?.click()}
                  onDrop={handleDropRef}
                  onDragOver={handleDragOverRef}
                  onDragLeave={handleDragLeaveRef}
                >
                  <input
                    type="file"
                    ref={refInputRef}
                    className="hidden"
                    accept="image/png, image/jpeg, image/webp"
                    multiple
                    onChange={handleRefImageUpload}
                  />
                  {isUploadingRef ? (
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-1"></div>
                      <p className="text-[10px] font-semibold text-primary">
                        {Math.round(uploadProgressRef)}%
                      </p>
                    </div>
                  ) : referenceImages.length > 0 ? (
                    <div className="relative w-full h-full flex flex-wrap gap-1 p-1 overflow-y-auto">
                      {referenceImages.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative w-16 h-16 rounded-md overflow-hidden group/item cursor-zoom-in"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImageUrl(img);
                          }}
                        >
                          <img
                            src={img}
                            alt={`Reference ${idx}`}
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            onClick={(e) => handleDeleteRefImage(img, idx, e)}
                            className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-black/80 text-white rounded-full p-0.5 opacity-70 hover:opacity-100 transition-all"
                          >
                            <Icon name="close" className="text-[10px]" />
                          </button>
                        </div>
                      ))}
                      <div className="w-16 h-16 rounded-md border border-dashed border-outline-variant/40 flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors cursor-pointer">
                        <Icon name="add" className="text-lg" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4">
                      <Icon
                        name="add_photo_alternate"
                        className="text-2xl text-on-surface-variant group-hover:text-primary transition-colors mb-2"
                      />
                      <span className="text-xs font-medium text-on-surface-variant group-hover:text-primary transition-colors">
                        Kéo thả hoặc tải ảnh tham khảo
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {activeSubTab === "Floorplan to 3D" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      Style render
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                      >
                        <option>Phối cảnh thực tế</option>
                        <option>Phối cảnh 3D</option>
                        <option>Mô hình thu nhỏ</option>
                      </select>
                      <Icon
                        name="keyboard_arrow_down"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-2">
                        Loại phòng
                      </label>
                      <div className="relative">
                        <select
                          className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 pr-10 text-sm text-on-surface appearance-none outline-none cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
                          value={roomType}
                          onChange={(e) => setRoomType(e.target.value)}
                        >
                          <option value="">Chọn phòng...</option>
                          <option>Phòng khách</option>
                          <option>Phòng ngủ</option>
                          <option>Nhà bếp</option>
                          <option>Phòng tắm / WC</option>
                          <option>Ban công</option>
                          <option>Phòng làm việc</option>
                          <option>Phòng ăn</option>
                          <option>Lối vào</option>
                        </select>
                        <Icon
                          name="keyboard_arrow_down"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-2">
                        Phong cách
                      </label>
                      <div className="relative">
                        <select
                          className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 pr-10 text-sm text-on-surface appearance-none outline-none cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
                          value={interiorStyle}
                          onChange={(e) => setInteriorStyle(e.target.value)}
                        >
                          <option value="">Chọn phong cách...</option>
                          <option>Hiện đại</option>
                          <option>Sang trọng (Luxury)</option>
                          <option>Tân cổ điển</option>
                          <option>Wabi-sabi</option>
                          <option>Tối giản (Minimalism)</option>
                          <option>Bắc Âu (Scandinavian)</option>
                          <option>Đông Dương (Indochine)</option>
                          <option>Công nghiệp (Industrial)</option>
                          <option>Bohemian</option>
                          <option>Vintage</option>
                          <option>Địa Trung Hải (Mediterranean)</option>
                          <option>Mộc mạc (Rustic)</option>
                          <option>Japandi</option>
                          <option>Modern Classic</option>
                          <option>Modern Minimalist</option>
                        </select>
                        <Icon
                          name="keyboard_arrow_down"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : activeSubTab === "Floorplan to 3D Floorplan" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      Style công trình
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={buildingStyle}
                        onChange={(e) => setBuildingStyle(e.target.value)}
                      >
                        <option>Nhà ở</option>
                        <option>Căn hộ</option>
                        <option>Công ty / Văn phòng</option>
                        <option>Trung tâm thương mại</option>
                      </select>
                      <Icon
                        name="keyboard_arrow_down"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      Style góc chụp
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={cameraAngleStyle}
                        onChange={(e) => setCameraAngleStyle(e.target.value)}
                      >
                        <option>Phối cảnh Trục đo (Isometric)</option>
                        <option>Top-down View</option>
                      </select>
                      <Icon
                        name="keyboard_arrow_down"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      Phong cách
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={interiorStyle}
                        onChange={(e) => setInteriorStyle(e.target.value)}
                      >
                        <option>Hiện đại</option>
                        <option>Sang trọng (Luxury)</option>
                        <option>Tân cổ điển</option>
                        <option>Wabi-sabi</option>
                        <option>Tối giản (Minimalism)</option>
                        <option>Bắc Âu (Scandinavian)</option>
                        <option>Đông Dương (Indochine)</option>
                        <option>Công nghiệp (Industrial)</option>
                        <option>Bohemian</option>
                        <option>Vintage</option>
                        <option>Địa Trung Hải (Mediterranean)</option>
                        <option>Mộc mạc (Rustic)</option>
                        <option>Japandi</option>
                        <option>Modern Classic</option>
                        <option>Modern Minimalist</option>
                      </select>
                      <Icon
                        name="keyboard_arrow_down"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      Ánh sáng
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={lighting}
                        onChange={(e) => setLighting(e.target.value)}
                      >
                        <option>Có nắng</option>
                        <option>Studio</option>
                        <option>Ban đêm có đánh đèn</option>
                        <option>Ánh sáng dịu</option>
                      </select>
                      <Icon
                        name="keyboard_arrow_down"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>
                </>
              ) : activeSubTab === "Render Nội Thất" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      Style ảnh
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                      >
                        <option>Ảnh chụp thực tế công trình</option>
                        <option>Ảnh render Vray</option>
                      </select>
                      <Icon
                        name="keyboard_arrow_down"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-2">
                        Chức năng phòng
                      </label>
                      <div className="relative">
                        <select
                          className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 pr-10 text-sm text-on-surface appearance-none outline-none cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
                          value={roomType}
                          onChange={(e) => setRoomType(e.target.value)}
                        >
                          <option value="">Chọn phòng...</option>
                          <option>Phòng khách</option>
                          <option>Phòng ngủ</option>
                          <option>Nhà bếp</option>
                          <option>Phòng tắm / WC</option>
                          <option>Ban công</option>
                          <option>Phòng làm việc</option>
                          <option>Phòng ăn</option>
                          <option>Lối vào</option>
                          <option>Khác (Tự nhập)...</option>
                        </select>
                        <Icon
                          name="keyboard_arrow_down"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-2">
                        Phong cách
                      </label>
                      <div className="relative">
                        <select
                          className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 pr-10 text-sm text-on-surface appearance-none outline-none cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
                          value={interiorStyle}
                          onChange={(e) => setInteriorStyle(e.target.value)}
                        >
                          <option value="">Chọn phong cách...</option>
                          <option>Hiện đại</option>
                          <option>Tối giản</option>
                          <option>Bắc Âu (Scandinavian)</option>
                          <option>Đông Dương (Indochine)</option>
                          <option>Wabi-sabi</option>
                          <option>Tân cổ điển</option>
                          <option>Sang trọng (Luxury)</option>
                          <option>Bohemian</option>
                          <option>Khác...</option>
                        </select>
                        <Icon
                          name="keyboard_arrow_down"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      Ánh sáng
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 pr-10 text-sm text-on-surface appearance-none outline-none cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
                        value={lighting}
                        onChange={(e) => setLighting(e.target.value)}
                      >
                        <option value="">Chọn ánh sáng...</option>
                        <option>Ánh sáng tự nhiên ban ngày</option>
                        <option>Ánh sáng vàng ấm buổi tối</option>
                        <option>Ánh sáng dịu (trời nhiều mây)</option>
                        <option>Ánh sáng studio</option>
                        <option>Ánh sáng bình minh</option>
                        <option>Ánh sáng neon</option>
                        <option>Khác...</option>
                      </select>
                      <Icon
                        name="keyboard_arrow_down"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>

                  <div>
                    <textarea
                      className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24"
                      placeholder="Thêm mô tả tùy chỉnh..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    ></textarea>
                  </div>
                </>
              ) : (
                <>
                  {activeSubTab !== "Masterplan to 3D" && (
                    <div>
                      <textarea
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24"
                        placeholder="Thêm mô tả tùy chỉnh (ví dụ: nhà 1 tầng, có gara...)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      ></textarea>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      Style ảnh
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                      >
                        <option>Ảnh chụp thực tế công trình</option>
                        <option>Ảnh render Vray</option>
                      </select>
                      <Icon
                        name="keyboard_arrow_down"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      Bối cảnh
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 pr-10 text-sm text-on-surface appearance-none outline-none cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                      >
                        <option value="">Chọn bối cảnh...</option>
                        <option>Trên một con phố ở Việt Nam</option>
                        <option>Tại vùng nông thôn Việt Nam</option>
                        <option>Trong khu đô thị cao cấp ở Việt Nam</option>
                        <option>Ở ngã 4 của đường phố Việt Nam</option>
                        <option>
                          Trong khu vườn nhiệt đới thuộc miền quê Việt Nam
                        </option>
                        <option>
                          Nằm cạnh con đường làng Việt Nam, bao quanh bởi cây
                          xanh hai bên ngôi nhà
                        </option>
                        <option>
                          Bên trong khu vườn kiểu châu Âu rộng rãi, sang trọng
                        </option>
                        <option>Trên vùng đồi núi có cảnh quan thơ mộng</option>
                      </select>
                      <Icon
                        name="keyboard_arrow_down"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-2">
                        Ánh sáng
                      </label>
                      <div className="relative">
                        <select
                          className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 pr-10 text-sm text-on-surface appearance-none outline-none cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
                          value={lighting}
                          onChange={(e) => setLighting(e.target.value)}
                        >
                          <option value="">Chọn ánh sáng...</option>
                          <option>
                            Ánh sáng hoàng hôn, đèn nội thất bên trong nhà sáng
                            nhẹ
                          </option>
                          <option>
                            Bầu trời u ám, ánh sáng overcast, không xuất hiện
                            bóng gắt
                          </option>
                          <option>
                            Trời vừa mưa xong, mặt đường còn ướt, không khí
                            trong lành
                          </option>
                          <option>
                            Bình minh buổi sáng với ánh sáng trong trẻo
                          </option>
                          <option>Ánh sáng ban đêm, trời có trăng sáng</option>
                          <option>
                            Ánh sáng tự nhiên ban ngày, buổi trưa nắng gắt
                          </option>
                          <option>
                            Sương mù dày vào buổi sáng sớm, mơ hồ và huyền ảo
                          </option>
                          <option>
                            Ánh sáng lúc hoàng hôn, đổ bóng kéo dài
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
                        Tone màu
                      </label>
                      <div className="relative">
                        <select
                          className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 pr-10 text-sm text-on-surface appearance-none outline-none cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
                          value={colorTone}
                          onChange={(e) => setColorTone(e.target.value)}
                        >
                          <option value="">Chọn tone...</option>
                          <option>Đen trắng (Monochrome)</option>
                          <option>Tone điện ảnh (Cinematic)</option>
                          <option>Tone tự nhiên - thực tế</option>
                          <option>Tone ấm áp (Warm & Cozy)</option>
                          <option>Tone lạnh hiện đại</option>
                          <option>Vintage / Retro</option>
                          <option>Tone pastel / mood board</option>
                          <option>Tone tương lai (Futuristic / Sci-fi)</option>
                          <option>Tone tạp chí thập niên 90</option>
                        </select>
                        <Icon
                          name="keyboard_arrow_down"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {activeSubTab !== "Floorplan to 3D Floorplan" && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
              <h3 className="text-base font-bold text-on-surface mb-4">
                3. Đổi Góc Chụp (Tùy chọn)
              </h3>
              <p className="text-xs text-on-surface-variant text-center mb-4">
                Sử dụng ảnh gốc bạn đã tải lên.
              </p>

              <div className="flex flex-col gap-4">
                <textarea
                  className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-20"
                  placeholder="Góc chụp từ trên cao nhìn xuống toàn bộ không gian phòng"
                  value={customCameraAngle}
                  onChange={(e) => setCustomCameraAngle(e.target.value)}
                ></textarea>

                <div className="relative">
                  <select
                    className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-3 pr-10 text-sm text-on-surface appearance-none outline-none cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
                    value={cameraAngle}
                    onChange={(e) => setCameraAngle(e.target.value)}
                  >
                    <option value="">Hoặc chọn một góc chụp có sẵn</option>
                    <option>Góc chụp trực diện toàn cảnh mặt tiền căn nhà</option>
                    <option>Góc chụp 3/4 bên trái, thể hiện cả mặt tiền và hông nhà</option>
                    <option>Góc chụp 3/4 bên phải, lấy được chiều sâu công trình</option>
                    <option>Góc chụp từ trên cao nhìn xuống (drone view) toàn cảnh khuôn viên</option>
                    <option>Góc chụp từ dưới lên (low angle), nhấn mạnh chiều cao và sự bề thế</option>
                    <option>Góc chụp cận cảnh chi tiết cửa chính và vật liệu mặt tiền</option>
                    <option>Góc chụp xuyên qua hàng cây/cảnh quan để tạo khung tự nhiên</option>
                    <option>Góc chụp từ trong nhà nhìn ra sân vườn hoặc cổng</option>
                    <option>Góc chụp ban đêm với ánh sáng nhân tạo, nhấn mạnh hệ thống đèn</option>
                    <option>Góc chụp panorama quét ngang, bao trọn bối cảnh và môi trường xung quanh</option>
                    <option>Góc chụp từ trên xuống (Top-down) như một bản vẽ mặt bằng kiến trúc</option>
                    <option>Góc chụp cận cảnh chi tiết vật liệu đặc trưng</option>
                    <option>Góc chụp phản chiếu công trình trên mặt nước</option>
                    <option>Góc chụp qua khung cửa sổ nhà đối diện</option>
                    <option>Góc chụp từ ban công nhà đối diện, có các chậu cây làm tiền cảnh</option>
                    <option>Góc chụp từ người ngồi uống cà phê bên kia đường</option>
                    <option>Close shot of this image</option>
                  </select>
                  <Icon
                    name="keyboard_arrow_down"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-on-surface">
                4. Tối ưu Prompt và Thông số
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
              className="relative w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/95 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
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

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-2">
                Prompt tạo ảnh hoàn chỉnh:
              </label>
              <textarea
                className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all outline-none resize-none h-24"
                placeholder="Ảnh chụp thực tế công trình, giữ chính xác góc chụp ..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              ></textarea>
            </div>

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
                    {MODELS.map((model) => (
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
                      className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${numImages === num
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
                    <option>21:9 (Panorama)</option>
                  </select>
                  <Icon
                    name="keyboard_arrow_down"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleRender}
            disabled={isRendering || !prompt || isUploading || isUploadingRef}
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
                {activeSubTab === "Floorplan to 3D"
                  ? "Tạo Ảnh 3D"
                  : activeSubTab === "Floorplan to 3D Floorplan"
                    ? "Tạo ảnh 3D Floorplan"
                    : activeSubTab === "Masterplan to 3D"
                      ? "Tạo Phối Cảnh Tổng Thể"
                      : "Tạo Ảnh Thực Tế"}
              </>
            )}
          </button>
        </div>

        {/* Right Panel: Kết Quả */}
        <motion.div layout className="flex-1 flex flex-col gap-6 min-w-0 lg:sticky lg:top-4 lg:h-[calc(100vh-32px)]">
          <motion.div layout className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm flex-1 min-h-0 overflow-hidden">
            <h3 className="text-base font-bold text-on-surface mb-4 shrink-0">
              Kết Quả Render
            </h3>

            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {isRendering ? (
                <div className="flex-1 bg-surface-container-low/50 rounded-xl flex flex-col items-center justify-center text-center border border-outline-variant/10 min-h-0 p-8 animate-fade-in">
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
              ) : currentResultItems.length === 0 && !selectedItem ? (
                <div className="flex-1 bg-surface-container-low/50 rounded-xl flex flex-col items-center justify-center text-center border border-outline-variant/10 min-h-0">
                  <Icon
                    name="image"
                    className="text-4xl text-on-surface-variant/30 mb-4"
                  />
                  <p className="text-sm font-medium text-on-surface-variant/70">
                    Kết quả render sẽ hiển thị ở đây
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-full flex-1 min-h-0 relative bg-surface-container-low/30 rounded-xl overflow-hidden border border-outline-variant/10 shadow-sm mb-4 flex items-center justify-center">
                    {selectedItem?.status === "pending" ? (
                      <>
                        {selectedItem.url && (
                          <img
                            src={selectedItem.url}
                            alt="Input"
                            className="w-full h-full object-contain opacity-50"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center bg-black/40 backdrop-blur-[2px]">
                          <div className="relative w-16 h-16 mb-4">
                            <svg
                              className="w-full h-full transform -rotate-90"
                              viewBox="0 0 100 100"
                            >
                              <circle
                                className="text-white/20 stroke-current"
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
                                strokeDashoffset={`${2 * Math.PI * 40 * (1 - (smoothProgress[selectedItem.job?.id] || selectedItem.job?.progress || 10) / 100)}`}
                              ></circle>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-sm font-bold">
                                {Math.floor(
                                  smoothProgress[selectedItem.job?.id] ||
                                  selectedItem.job?.progress ||
                                  10,
                                )}
                                %
                              </span>
                            </div>
                          </div>
                          <span className="text-sm font-medium drop-shadow-md">
                            {selectedItem.job?.statusMessage ||
                              "Đang xử lý tạo ảnh..."}
                          </span>
                        </div>
                      </>
                    ) : selectedItem?.status === "completed" ? (
                      <>
                        <img
                          src={selectedItem.url}
                          alt="Render Result"
                          className="w-full h-full object-contain cursor-zoom-in"
                          referrerPolicy="no-referrer"
                          onClick={() => setPreviewImageUrl(selectedItem.url)}
                        />

                        <div className="absolute top-4 right-4 flex flex-col gap-2">
                          {selectedItem.job?.outputImageUrls &&
                            selectedItem.job.outputImageUrls.length > 1 && (
                              <button
                                onClick={() =>
                                  handleDownload(
                                    selectedItem.job.outputImageUrls,
                                  )
                                }
                                className="h-8 px-3 bg-primary hover:bg-primary/90 backdrop-blur-md rounded-lg text-white flex items-center justify-center gap-2 transition-colors shadow-lg text-[10px] font-bold"
                                title="Tải xuống tất cả"
                              >
                                <Icon
                                  name="download_for_offline"
                                  className="text-[16px]"
                                />
                                Tải tất cả
                              </button>
                            )}
                          <button
                            onClick={() => {
                              localStorage.setItem(
                                "iGen_editReferenceImage",
                                selectedItem.url,
                              );
                              window.dispatchEvent(
                                new CustomEvent("igenNavigate", {
                                  detail: { tab: "Chỉnh sửa" },
                                }),
                              );
                            }}
                            className="w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                            title="Chỉnh sửa"
                          >
                            <Icon name="edit" className="text-[18px]" />
                          </button>
                          <button
                            onClick={() => {
                              setInputImages((prev) =>
                                prev.includes(selectedItem.url)
                                  ? prev
                                  : [...prev, selectedItem.url],
                              );
                              toast.success(
                                "Đã thêm ảnh vào mục tải lên ảnh gốc để chọn lại góc chụp!",
                              );
                            }}
                            className="w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                            title="Đổi góc chụp"
                          >
                            <Icon name="360" className="text-[18px]" />
                          </button>
                          <button
                            onClick={() => setPreviewImageUrl(selectedItem.url)}
                            className="w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                            title="Phóng to"
                          >
                            <Icon name="zoom_in" className="text-[18px]" />
                          </button>
                          <button
                            onClick={() =>
                              handleDownloadImage(
                                selectedItem.url,
                                `igen_render_${Date.now()}.png`,
                              )
                            }
                            className="w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                            title="Tải xuống"
                          >
                            <Icon name="download" className="text-[18px]" />
                          </button>
                          <button
                            onClick={() => setJobToDelete(selectedItem.job)}
                            className="w-8 h-8 bg-red-500/80 hover:bg-red-600 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                            title="Xóa"
                          >
                            <Icon name="delete" className="text-[18px]" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-error p-4 text-center">
                        <Icon name="error_outline" className="text-4xl mb-4" />
                        <span className="text-sm font-medium">Lỗi render</span>
                        <button
                          onClick={() => setJobToDelete(selectedItem?.job)}
                          className="mt-4 px-4 py-2 bg-error/10 text-error rounded-lg text-sm font-semibold hover:bg-error/20 transition-colors"
                        >
                          Xóa yêu cầu lỗi
                        </button>
                      </div>
                    )}
                  </div>

                  {currentResultItems.length > 0 && (
                    <div className="shrink-0 flex flex-wrap gap-2 overflow-y-auto custom-scrollbar pb-2 px-1 max-h-[30vh] min-h-[5rem]">
                      {currentResultItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedResultId(item.id)}
                          className={`relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${selectedItem?.id === item.id
                              ? "border-primary shadow-md scale-100"
                              : "border-transparent opacity-60 hover:opacity-100 hover:scale-105"
                            }`}
                        >
                          {item.status === "pending" ? (
                            <>
                              {item.url ? (
                                <img
                                  src={item.url}
                                  alt="Thumbnail"
                                  className="w-full h-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full bg-surface-container-highest"></div>
                              )}
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[1px]">
                                <span className="text-white text-xs font-bold mb-1">
                                  {Math.floor(
                                    smoothProgress[item.job?.id] ||
                                    item.job?.progress ||
                                    10,
                                  )}
                                  %
                                </span>
                                <div className="w-10 h-1 bg-white/20 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all duration-500 ease-out"
                                    style={{
                                      width: `${smoothProgress[item.job?.id] || item.job?.progress || 10}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </>
                          ) : item.status === "completed" ? (
                            <img
                              src={item.url}
                              alt="Thumbnail"
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-error/10 flex items-center justify-center text-error">
                              <Icon name="error" className="text-xl" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm shrink-0">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-base font-bold text-on-surface">
                Lịch Sử {activeSubTab}
              </h3>
              <button
                onClick={() => setJobToDelete(selectedItem?.job)}
                className="text-error hover:bg-error/10 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <Icon name="delete" className="text-[18px]" />
                Xóa
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {historyResultItems.length === 0 ? (
                <div className="w-full flex items-center justify-center py-8">
                  <p className="text-sm text-on-surface-variant">
                    Chưa có lịch sử render.
                  </p>
                </div>
              ) : (
                historyResultItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedResultId(item.id)}
                    className={`w-40 h-40 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${selectedItem?.id === item.id
                        ? "border-primary shadow-md"
                        : "border-outline-variant/20 hover:border-primary/50"
                      }`}
                  >
                    {item.status === "pending" ? (
                      <div className="w-full h-full bg-surface-container-low flex items-center justify-center relative">
                        {item.url && (
                          <img
                            src={item.url}
                            alt="Thumbnail"
                            className="w-full h-full object-contain opacity-30"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      </div>
                    ) : item.status === "completed" ? (
                      <img
                        src={item.url}
                        alt="Thumbnail"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full bg-error/10 flex items-center justify-center text-error">
                        <Icon name="error" className="text-xl" />
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      <ImageLibraryModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        onSelectImages={(urls) => {
          if (libraryTarget === "input") {
            setInputImages((prev) => [...prev, ...urls]);
          } else {
            setReferenceImages((prev) => [...prev, ...urls]);
          }
        }}
      />

      {showVRModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-outline-variant/20 animate-in fade-in zoom-in duration-200 relative overflow-hidden text-center">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-500 to-[#0ea5e9]"></div>

            <button
              onClick={() => setShowVRModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-all bg-transparent"
              id="btn-close-vr-modal"
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
                  setShowVRModal(false);
                }}
                className="w-full py-2.5 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-md transition-all text-xs uppercase tracking-wider"
                id="btn-confirm-vr-modal"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewImageUrl(null)}
        >
          <button
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            onClick={() => setPreviewImageUrl(null)}
          >
            <Icon name="close" className="text-2xl" />
          </button>
          <img
            src={previewImageUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {jobToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-outline-variant/20 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-error mb-4">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                <Icon name="warning" className="text-2xl" />
              </div>
              <h3 className="text-lg font-bold">Xác nhận xóa</h3>
            </div>
            <p className="text-on-surface-variant text-sm mb-6">
              Bạn có chắc chắn muốn xóa kết quả render này không? Hành động này
              không thể hoàn tác và sẽ xóa cả ảnh khỏi hệ thống.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setJobToDelete(null)}
                className="px-4 py-2 rounded-xl font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDeleteJob(jobToDelete)}
                className="px-4 py-2 rounded-xl font-semibold bg-error text-white hover:bg-error/90 transition-colors shadow-sm"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
