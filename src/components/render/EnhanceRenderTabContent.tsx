import React, { useState, useEffect, useRef } from "react";
import { Icon } from "../Icon";
import { toast } from "sonner";
import { useAuth } from "../../context/useAuth";
import { apiClient, ApiResponse } from "../../services/apiClient";
import { ImageLibraryModal } from "./ImageLibraryModal";
import { getAIClient, safeJsonParse, checkUserCredits, generateContentWithRetry, getImageBase64, handleDownload, cacheImage, uploadMedia } from "../../lib/renderUtils";

const MODELS = [
  {
    id: "piapi-midjourney",
    name: "Midjourney v6 (PiAPI)",
    isPro: true,
  },
  {
    id: "piapi-flux",
    name: "Flux Dev (PiAPI)",
    isPro: true,
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

const CONTEXT_OPTIONS = [
  ".... (Tự nhập prompt)",
  "Trên một con phố ở Việt Nam",
  "Tại vùng nông thôn Việt Nam",
  "Trong khu đô thị cao cấp ở Việt Nam",
  "Ở ngã 4 của đường phố Việt Nam",
  "Trong khu vườn nhiệt đới thuộc miền quê Việt Nam",
  "Nằm cạnh con đường làng Việt Nam, bao quanh bởi cây xanh hai bên ngôi nhà",
  "Bên trong khu vườn kiểu châu Âu rộng rãi, sang trọng",
  "Trên vùng đồi núi có cảnh quan thơ mộng",
];

const LIGHTING_OPTIONS = [
  ".... (Tự nhập prompt)",
  "Ánh sáng hoàng hôn, đèn nội thất bên trong nhà sáng nhẹ",
  "Bầu trời u ám, ánh sáng overcast, không xuất hiện bóng gắt",
  "Trời vừa mưa xong, mặt đường còn ướt, không khí trong lành",
  "Bình minh buổi sáng với ánh sáng trong trẻo",
  "Ánh sáng ban đêm, trời có trăng sáng",
  "Ánh sáng tự nhiên ban ngày, buổi trưa nắng gắt",
  "Sương mù dày vào buổi sáng sớm, mơ hồ và huyền ảo",
  "Ánh sáng lúc hoàng hôn, đổ bóng kéo dài",
];

const INTERIOR_ROOM_TYPES = [
  ".... (Tự nhập prompt)",
  "Phòng khách",
  "Phòng ngủ",
  "Nhà bếp",
  "Phòng tắm / WC",
  "Ban công",
  "Phòng làm việc",
  "Phòng ăn",
  "Lối vào",
];

const INTERIOR_STYLES = [
  ".... (Tự nhập prompt)",
  "Hiện đại",
  "Tân cổ điển",
  "Wabi-sabi",
  "Tối giản (Minimalism)",
  "Scanvadian",
  "Indochine",
  "Industrial",
  "Bohemian",
];

const INTERIOR_LIGHTING_OPTIONS = [
  ".... (Tự nhập prompt)",
  "Ánh sáng tự nhiên ban ngày từ cửa sổ lớn",
  "Ánh sáng vàng ấm áp từ đèn trang trí vào buổi tối",
  "Ánh sáng dịu nhẹ, khuếch tán (overcast)",
  "Ánh sáng studio, làm nổi bật chi tiết vật liệu",
  "Ánh sáng bình minh len lỏi qua rèm cửa",
  "Ánh sáng đèn neon hiện đại, cá tính",
];

interface RenderJob {
  _id?: string;
  id?: string;
  type: string;
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

export const EnhanceRenderTabContent: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("Cải Thiện Ngoại Thất");
  const [customPrompt, setCustomPrompt] = useState("");
  const [contextOption, setContextOption] = useState(".... (Tự nhập prompt)");
  const [lightingOption, setLightingOption] = useState(".... (Tự nhập prompt)");
  const [interiorRoomType, setInteriorRoomType] = useState(
    ".... (Tự nhập prompt)",
  );
  const [interiorStyle, setInteriorStyle] = useState(".... (Tự nhập prompt)");
  const [interiorLighting, setInteriorLighting] = useState(
    ".... (Tự nhập prompt)",
  );
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [promptModel, setPromptModel] = useState("gemini-3-flash-preview");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptStatus, setPromptStatus] = useState("");
  const [promptProgress, setPromptProgress] = useState(0);
  const [smoothPromptProgress, setSmoothPromptProgress] = useState(0);
  const [selectedModel, setSelectedModel] = useState(
    "gemini-3-pro-image-preview",
  );
  const [selectedResolution, setSelectedResolution] = useState("1K");
  const [numImages, setNumImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState("Tự động");
  const [prompt, setPrompt] = useState("");

  const [inputImages, setInputImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRendering, setIsRendering] = useState(false);

  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [smoothProgress, setSmoothProgress] = useState<{
    [jobId: string]: number;
  }>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<RenderJob | null>(null);
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
      setCustomPrompt("");
      setContextOption(".... (Tự nhập prompt)");
      setLightingOption(".... (Tự nhập prompt)");
      setInteriorRoomType(".... (Tự nhập prompt)");
      setInteriorStyle(".... (Tự nhập prompt)");
      setInteriorLighting(".... (Tự nhập prompt)");
      setPrompt("");
    }, 0);
  }, [activeSubTab]);

  useEffect(() => {
    const parts = [];
    if (activeSubTab === "Cải Thiện Ngoại Thất") {
      if (customPrompt) parts.push(customPrompt);
      if (contextOption && contextOption !== ".... (Tự nhập prompt)")
        parts.push(contextOption);
      if (lightingOption && lightingOption !== ".... (Tự nhập prompt)")
        parts.push(lightingOption);

      const computedPrompt = parts.length > 0 ? `Ảnh chụp thực tế công trình, ${parts.join(", ")}` : "";
      setTimeout(() => setPrompt(computedPrompt), 0);
    } else {
      if (customPrompt) parts.push(customPrompt);
      if (interiorRoomType && interiorRoomType !== ".... (Tự nhập prompt)")
        parts.push(interiorRoomType);
      if (interiorStyle && interiorStyle !== ".... (Tự nhập prompt)")
        parts.push(`phong cách ${interiorStyle}`);
      if (interiorLighting && interiorLighting !== ".... (Tự nhập prompt)")
        parts.push(interiorLighting);

      const computedPrompt = parts.length > 0 ? `Ảnh chụp thực tế nội thất căn phòng, ${parts.join(", ")}` : "";
      setTimeout(() => setPrompt(computedPrompt), 0);
    }
  }, [
    customPrompt,
    contextOption,
    lightingOption,
    interiorRoomType,
    interiorStyle,
    interiorLighting,
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
            const jobId = job._id || job.id;
            const current = prev[jobId] || 0;
            if (current < target) {
              next[jobId] = current + 1;
              changed = true;
            } else if (current < 95 && current >= target) {
              next[jobId] = current + 0.1;
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
          return prev + 2;
        } else if (prev < 95 && prev >= target) {
          return prev + 0.2;
        }
        return prev;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [renderJobs, isGeneratingPrompt, promptProgress]);

  const { user, socket } = useAuth();

  useEffect(() => {
    if (!user) {
      setTimeout(() => setRenderJobs([]), 0);
      return;
    }

    const fetchJobs = async () => {
      try {
        const res = await apiClient.get<ApiResponse<RenderJob[]>>(`/api/v1/render-jobs?type=${encodeURIComponent(activeSubTab)}&limit=50`);
        if (res.success && Array.isArray(res.data)) {
          setRenderJobs(res.data);
        }
      } catch (e) {
        console.error("Error fetching render jobs:", e);
      }
    };
    fetchJobs();
  }, [user, activeSubTab]);

  useEffect(() => {
    if (!socket) return;
    
    const handleJobUpdate = (updatedJob: RenderJob) => {
      if (updatedJob.type !== activeSubTab) return;
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
  }, [socket, activeSubTab]);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!user) {
      toast.error("Vui lòng đăng nhập để tải ảnh lên.");
      return;
    }

    if (!(await checkUserCredits())) return;
    setIsUploading(true);
    setUploadProgress(0);

    const newImageUrls: string[] = [];
    let idx = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setUploadProgress(Math.round((idx / files.length) * 100));
        const downloadURL = await uploadMedia(file, "uploads");
        cacheImage(downloadURL, file);
        newImageUrls.push(downloadURL);
        idx++;
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error("Lỗi khi tải ảnh lên. Vui lòng thử lại.");
      }
    }

    setInputImages((prev) => [...prev, ...newImageUrls]);
    setIsUploading(false);
  };

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
      const jobId = job._id || job.id;
      await apiClient.delete(`/api/v1/render-jobs/${jobId}`);
      
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

  const handleRender = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để sử dụng tính năng này.");
      return;
    }

    if (inputImages.length === 0) {
      toast.error("Vui lòng tải lên ít nhất 1 ảnh.");
      return;
    }

    setIsRendering(true);

    try {
      const jobData = {
        userId: user._id,
        type: activeSubTab,
        inputImageUrls: inputImages,
        status: "pending",
        progress: 10,
        statusMessage: "Khởi tạo...",
        createdAt: new Date().toISOString(),
        settings: {
          prompt,
          numImages,
          aspectRatio,
          model: selectedModel,
          resolution: selectedResolution,
        },
      };

      const jobRes = await apiClient.post<ApiResponse<RenderJob>>("/api/v1/render-jobs", jobData);
      if (!jobRes.success || !jobRes.data) {
        throw new Error("Không thể khởi tạo render job trên server.");
      }

      setIsRendering(false);
      toast.success("Đã gửi yêu cầu kết xuất lên hàng đợi PiAPI!");
    } catch (error) {
      console.error("Render error:", error);
      toast.error("Có lỗi xảy ra trong quá trình tạo ảnh. Vui lòng thử lại.");
      setIsRendering(false);
    }
  };

  const handleGeneratePrompt = async () => {
    if (inputImages.length === 0) {
      toast.error("Vui lòng tải lên ít nhất 1 ảnh để phân tích.");
      return;
    }

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

      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
      setPromptProgress(30);
      setPromptStatus("Đang xử lý ảnh đầu vào...");

      for (const url of inputImages) {
        parts.push(await getImagePart(url));
      }

      setPromptProgress(60);
      setPromptStatus("AI đang phân tích và tối ưu hóa...");

      const textPrompt = `
Mục tiêu: Cải thiện chất lượng render ${activeSubTab === "Cải Thiện Ngoại Thất" ? "ngoại thất" : "nội thất"}.
${
  activeSubTab === "Cải Thiện Ngoại Thất"
    ? `
- Yêu cầu bổ sung: ${customPrompt || "Không có"}
- Bối cảnh: ${contextOption || "Không có"}
- Ánh sáng: ${lightingOption || "Không có"}
`
    : `
- Yêu cầu bổ sung: ${customPrompt || "Không có"}
- Loại phòng: ${interiorRoomType || "Không có"}
- Phong cách: ${interiorStyle || "Không có"}
- Ánh sáng: ${interiorLighting || "Không có"}
`
}
`;

      parts.push({ text: textPrompt });

      const systemInstruction = `
<role>
BẠN LÀ CHUYÊN GIA NÂNG CẤP PROMPT RENDER iGen.
CỰC KỲ QUAN TRỌNG: Tất cả thông tin phân tích, mô tả, phong cách, chất liệu, bối cảnh, kết quả đầu ra, và toàn bộ prompt tối ưu hóa PHẢI được viết hoàn toàn bằng TIẾNG VIỆT 100%. Tuyệt đối không sử dụng tiếng Anh trong mô tả, tiêu đề, phân tích hoặc kết quả đầu ra. Giữ nguyên các thuật ngữ kỹ thuật bắt buộc (nếu có), nhưng ưu tiên diễn đạt bằng tiếng Việt.
Bạn là chuyên gia kết xuất kiến trúc đỉnh cao. Nhiệm vụ của bạn là phân tích bản render nháp hoặc ảnh chụp thực tế và tạo ra một prompt tạo ảnh tiếng Việt cao cấp, siêu thực giúp làm đẹp ảnh nguyên bản trong khi vẫn bảo toàn tuyệt đối ranh giới cấu trúc hình học.
</role>

<core_logic>
1. BẢO TOÀN KIẾN TRÚC: Bạn TUYỆT ĐỐI không thay đổi tường, cửa sổ, cửa chính, góc chụp hoặc bố cục kiến trúc tổng thể. Mục tiêu là "làm đẹp và làm sắc sảo vật liệu", chứ không phải là "xây dựng lại cấu trúc".
2. NÂNG CẤP CHẤT LIỆU CAO CẤP: Phân tích các vật liệu thô nháp trong ảnh. Thay thế kết cấu thô, phẳng, phân giải thấp bằng chất liệu kiến trúc sang trọng cao cấp bằng tiếng Việt (ví dụ: "đá cẩm thạch Carrara của Ý", "nhôm màu sâm panh chải xước sành điệu", "gỗ cháy Shou Sugi Ban Nhật Bản thủ công", "kính siêu trong low-iron cao cấp").
3. ÁNH SÁNG & KHÔNG GIAN BỐI CẢNH: Triển khai các thiết lập ánh sáng tinh tế bằng tiếng Việt.
   - Với Ngoại thất: Sử dụng "giờ vàng hoàng hôn ấm áp", "giờ xanh lãng mạn" hoặc "trời nhiều mây dịu mát siêu thực" kết hợp với nền trời bầu khí quyền HDRI thật.
   - Với Nội thất: Sử dụng "ánh sáng tự nhiên hắt qua khung cửa sổ dịu dàng", "ánh đèn LED âm trần màu vàng ấm áp" và "ánh sáng toàn diện global illumination".
4. CHÂN THỰC HỮU CƠ (SIÊU THỰC): Phân loại phong cách ảnh đầu gốc để tối ưu chất lượng kết xuất thành một tác phẩm nghệ thuật chuẩn tạp chí kiến trúc đời thực:
   - Nếu ảnh gốc có phong cách ảnh chụp thực tế: sử dụng các từ khóa "ảnh chụp kiến trúc thực tế ngoại thất đời thực hữu cơ chân thật cực đại, được chụp bởi một người cầm camera nghiệp dư hoặc kiến trúc sư đứng ở tầm mắt dưới đất (human eye-level handheld perspective), góc chụp tự nhiên thoải mái sai lệch nhẹ không hoàn hảo, mô phỏng sinh động các sai số quang học chân thực (vệt flare phản chiếu nắng dạt bóng thấu kính tinh tế - subtle lens flare, hiện tượng cháy sáng nhẹ một số vùng đón sáng trực tiếp gắt - subtle overexposure bloom), chi tiết kết cấu thớt dăm gỗ tự nhiên thô ráp và mặt gạch đá gồ ghề phong sương cũ mộc sương bóng chứ không phẳng láng vô trùng, thảm thực vật cây cối xum xuê hữu cơ ngẫu nhiên có lẫn lá khô úa tàn rụng rơi, bãi sỏi đá và bạt cỏ mọc bất hoàn hảo tự nhiên lộn xộn, triệt tiêu hoàn toàn cảm giác đồ họa máy tính CGI hay 3D render nhân tạo sạch sẽ vô hồn". KHÔNG sử dụng từ khóa "render", "CGI", "Unreal Engine", "V-Ray", "Corona".
   - Nếu ảnh gốc là ảnh render 3D: sử dụng các từ khóa "kết xuất phối cảnh 3D siêu thực, kết xuất V-Ray 6 sắc nét, chất lượng Unreal Engine 5.5 đỉnh cao, chất lượng Corona rực rỡ, kiến trúc chuẩn phong cách đồ họa máy tính CGI cao cấp, kết xuất 8k chân thực, đổ bóng phản chiếu tinh tế".
5. NGÔN NGỮ ĐẦU RA: Tất cả mô tả, văn bản phân tích và prompt tối ưu hóa PHẢI viết hoàn toàn bằng tiếng Việt 100%.
</core_logic>

<specific_guidelines>
- NGOẠI THẤT: Tập trung tả sâu cảnh quan xung quanh, thảm thực vật cây cối sinh động thực tế, bóng phản chiếu trên nền đường đen ẩm ướt (nếu có) và độ sâu kết cấu của mặt tiền.
- NỘI THẤT: Tập trung kết cấu sợi vải nội thất mềm mại, bề mặt các vật dụng bóng bẩy chân thực, bóng đổ mềm mịn tán xạ và bầu không khí sang trọng ấm cúng có người ở.
</specific_guidelines>

<output_format>
Trả về một đối tượng JSON có định dạng sau:
{
  "analysis": "Phân tích ngắn gọn về bức ảnh gốc và ý đồ mong muốn của người dùng bằng tiếng Việt.",
  "optimized_english_prompt": "Prompt kết xuất cao cấp cuối cùng (Phải viết bằng tiếng Việt 100%).",
  "negative_prompt": "Prompt phủ định nghiêm ngặt (ví dụ: 'đường nét biến dạng thô méo, kết cấu mờ nhòe phân giải thấp, ánh sáng phi thực tế, lỗi vật lý nét vẽ')."
}
</output_format>`;

      const response = await generateContentWithRetry(ai, {
        model: promptModel,
        contents: [{ role: "user", parts }],
        systemInstruction: systemInstruction,
        generationConfig: {
          temperature: 1.0,
          responseMimeType: "application/json",
        },
      });

      try {
        const rawText = typeof response.text === "function" ? response.text() : response.text;
        const jsonStr = rawText?.trim() || "{}";
        const result = safeJsonParse(jsonStr);
        setPrompt((result as Record<string, string>).optimized_english_prompt || rawText || "");
        setPromptProgress(100);
        setPromptStatus("Hoàn tất!");
        toast.success("Đã tối ưu hóa prompt thành công!");
      } catch (parseError) {
        console.error("Error parsing JSON response:", parseError);
        const rawText = typeof response.text === "function" ? response.text() : response.text;
        setPrompt(rawText || "");
        setPromptProgress(100);
        setPromptStatus("Hoàn tất!");
      }
    } catch (error) {
      console.error("Error generating prompt:", error);
      toast.error("Có lỗi xảy ra khi tối ưu hóa prompt.");
      setPromptProgress(0);
      setPromptStatus("");
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const allResultItems = renderJobs.flatMap((job) => {
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
    <div className="flex-1 flex flex-col bg-surface-container-lowest">
      {/* Sub Tabs */}
      <div className="flex items-center justify-center gap-4 py-4 border-b border-outline-variant/20">
        <button
          onClick={() => setActiveSubTab("Cải Thiện Ngoại Thất")}
          className={`flex items-center justify-center gap-2 w-[220px] py-2 rounded-full text-sm font-medium transition-colors ${
            activeSubTab === "Cải Thiện Ngoại Thất"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          <Icon name="landscape" className="text-lg" />
          Cải Thiện Ngoại Thất
        </button>
        <button
          onClick={() => setActiveSubTab("Cải Thiện Nội Thất")}
          className={`flex items-center justify-center gap-2 w-[220px] py-2 rounded-full text-sm font-medium transition-colors ${
            activeSubTab === "Cải Thiện Nội Thất"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          <Icon name="chair" className="text-lg" />
          Cải Thiện Nội Thất
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-[600px] items-start p-6">
        {/* Left Sidebar */}
        <div className="w-full lg:w-[380px] flex flex-col gap-6">
          {/* Panel 1: Tải Lên Ảnh Gốc */}
          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-on-surface">
                1. Tải Lên Ảnh Gốc
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
              className={`border-2 border-dashed border-outline-variant/50 rounded-xl p-8 flex flex-col items-center justify-center text-center ${inputImages.length === 0 ? "cursor-pointer hover:bg-surface-container-highest" : ""} transition-colors min-h-[200px] relative overflow-hidden`}
              onClick={() =>
                inputImages.length === 0 && fileInputRef.current?.click()
              }
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                multiple
                onChange={handleImageUpload}
              />

              {inputImages.length > 0 ? (
                <div className="absolute inset-0 p-2 grid grid-cols-2 gap-2 bg-surface-container-lowest overflow-y-auto">
                  {inputImages.map((url, index) => (
                    <div
                      key={index}
                      className="relative group rounded-lg overflow-hidden border border-outline-variant/20"
                    >
                      <img
                        src={url}
                        alt={`Upload ${index}`}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        onClick={(e) => handleDeleteInputImage(url, index, e)}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-error/80 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Icon name="close" className="text-[14px]" />
                      </button>
                    </div>
                  ))}
                  {isUploading && (
                    <div className="relative rounded-lg overflow-hidden border border-outline-variant/20 bg-surface-container-low flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
                        {Math.round(uploadProgress)}%
                      </div>
                    </div>
                  )}
                </div>
              ) : isUploading ? (
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium text-primary">
                    Đang tải lên... {Math.round(uploadProgress)}%
                  </p>
                </div>
              ) : (
                <>
                  <Icon
                    name="cloud_upload"
                    className="text-4xl text-on-surface-variant/50 mb-4"
                  />
                  <p className="text-sm font-medium text-on-surface mb-1">
                    Nhấp hoặc kéo tệp vào đây
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    PNG, JPG, WEBP
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Panel 2: Start Process */}
          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/20 p-6">
            <h3 className="text-base font-bold text-on-surface mb-4">
              2. Bắt Đầu Quá Trình
            </h3>
            <p className="text-sm text-on-surface-variant mb-6">
              {activeSubTab === "Cải Thiện Ngoại Thất"
                ? "AI sẽ thực hiện 2 bước tự động: Xử lý ảnh gốc, sau đó chuyển ảnh đã xử lý sang dạng sketch để render lại."
                : "AI sẽ tự động chuyển ảnh của bạn sang dạng sketch màu để bạn có thể render lại với bối cảnh và ánh sáng mới."}
            </p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-on-surface-variant mb-2">
                AI Engine
              </label>
              <div className="relative">
                <select
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
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

            <button
              onClick={handleRender}
              disabled={isRendering || inputImages.length === 0 || isUploading}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRendering ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Icon name="auto_fix_high" className="text-lg" />
                  Bắt Đầu Cải Thiện
                </>
              )}
            </button>
          </div>

          {/* Panel: AI Processing Steps */}
          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/20 p-6">
            <div className="flex items-center justify-between mb-6 cursor-pointer">
              <h3 className="text-base font-bold text-on-surface">
                Các Bước Xử Lý Của AI
              </h3>
              <Icon
                name="keyboard_arrow_up"
                className="text-on-surface-variant"
              />
            </div>

            <div
              className={`grid grid-cols-1 ${activeSubTab === "Cải Thiện Ngoại Thất" ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}
            >
              {/* Original Image */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4 flex flex-col">
                <h4 className="text-sm font-medium text-primary text-center mb-3">
                  Ảnh Gốc
                </h4>
                <div className="flex-1 bg-surface-container-low rounded-lg flex items-center justify-center min-h-[160px] p-4 text-center">
                  <p className="text-xs text-on-surface-variant">
                    Ảnh bạn tải lên sẽ hiện ở đây.
                  </p>
                </div>
              </div>

              {/* Step 1 (Only for Ngoại Thất) */}
              {activeSubTab === "Cải Thiện Ngoại Thất" && (
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4 flex flex-col">
                  <h4 className="text-sm font-medium text-primary text-center mb-3">
                    Bước 1: Xử lý nền
                  </h4>
                  <div className="flex-1 bg-surface-container-low rounded-lg flex items-center justify-center min-h-[160px] p-4 text-center">
                    <p className="text-xs text-on-surface-variant">
                      Kết quả sau khi xử lý nền.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2 / Chuyển Sketch */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4 flex flex-col">
                <h4 className="text-sm font-medium text-primary text-center mb-3">
                  {activeSubTab === "Cải Thiện Ngoại Thất"
                    ? "Bước 2: Chuyển Sketch"
                    : "Chuyển sang Sketch"}
                </h4>
                <div className="flex-1 bg-surface-container-low rounded-lg flex items-center justify-center min-h-[160px] p-4 text-center">
                  <p className="text-xs text-on-surface-variant">
                    Kết quả sau khi chuyển sang sketch.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 3: Re-render */}
          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/20 p-6 flex-1 flex flex-col">
            <h3 className="text-base font-bold text-on-surface mb-6">
              3. Render Lại Với Prompt Tùy Chỉnh
            </h3>

            <div className="flex flex-col gap-4">
              {/* Custom Prompt */}
              <div>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl p-4 text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-colors min-h-[80px] resize-none"
                  placeholder="Thêm mô tả tùy chỉnh..."
                />
              </div>

              {activeSubTab === "Cải Thiện Ngoại Thất" ? (
                <>
                  {/* Context Dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-2">
                      Bối cảnh
                    </label>
                    <div className="relative">
                      <select
                        value={contextOption}
                        onChange={(e) => setContextOption(e.target.value)}
                        className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl p-4 text-sm text-on-surface appearance-none focus:outline-none focus:border-primary/50 transition-colors"
                      >
                        {CONTEXT_OPTIONS.map((opt, idx) => (
                          <option key={idx} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <Icon
                        name="expand_more"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>

                  {/* Lighting Dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-2">
                      Ánh sáng
                    </label>
                    <div className="relative">
                      <select
                        value={lightingOption}
                        onChange={(e) => setLightingOption(e.target.value)}
                        className="w-full bg-surface-container-highest border border-primary/50 rounded-xl p-4 text-sm text-on-surface appearance-none focus:outline-none focus:border-primary transition-colors"
                      >
                        {LIGHTING_OPTIONS.map((opt, idx) => (
                          <option key={idx} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <Icon
                        name="expand_more"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Room Type Dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-2">
                        Loại phòng
                      </label>
                      <div className="relative">
                        <select
                          value={interiorRoomType}
                          onChange={(e) => setInteriorRoomType(e.target.value)}
                          className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl p-4 text-sm text-on-surface appearance-none focus:outline-none focus:border-primary/50 transition-colors"
                        >
                          {INTERIOR_ROOM_TYPES.map((opt, idx) => (
                            <option key={idx} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <Icon
                          name="expand_more"
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                        />
                      </div>
                    </div>

                    {/* Style Dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-2">
                        Phong cách
                      </label>
                      <div className="relative">
                        <select
                          value={interiorStyle}
                          onChange={(e) => setInteriorStyle(e.target.value)}
                          className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl p-4 text-sm text-on-surface appearance-none focus:outline-none focus:border-primary/50 transition-colors"
                        >
                          {INTERIOR_STYLES.map((opt, idx) => (
                            <option key={idx} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <Icon
                          name="expand_more"
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lighting Dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-2">
                      Ánh sáng
                    </label>
                    <div className="relative">
                      <select
                        value={interiorLighting}
                        onChange={(e) => setInteriorLighting(e.target.value)}
                        className="w-full bg-surface-container-highest border border-primary/50 rounded-xl p-4 text-sm text-on-surface appearance-none focus:outline-none focus:border-primary transition-colors"
                      >
                        {INTERIOR_LIGHTING_OPTIONS.map((opt, idx) => (
                          <option key={idx} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <Icon
                        name="expand_more"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Panel 4: Final Prompt & Generate */}
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
                  <option value="gemini-1.5-flash-latest">
                    iGen 3 Flash Preview
                  </option>
                  <option value="gemini-1.5-pro-latest">
                    iGen 3.1 Pro Preview
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

            {/* Generate Button */}
            <button
              onClick={handleRender}
              disabled={isRendering || inputImages.length === 0 || isUploading}
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
                  Tạo Ảnh
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Sidebar (Kết Quả Render, Lịch Sử) */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 lg:sticky lg:top-4 lg:h-[calc(100vh-32px)]">
          {/* Kết Quả */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm flex-1 min-h-0 overflow-hidden">
            <h3 className="text-base font-bold text-on-surface mb-4 shrink-0">
              Kết Quả Cải Thiện Render
            </h3>

            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {currentResultItems.length === 0 && !selectedItem ? (
                <div className="flex-1 bg-surface-container-low/50 rounded-xl flex flex-col items-center justify-center text-center border border-outline-variant/10 min-h-0">
                  <Icon
                    name="image"
                    className="text-4xl text-on-surface-variant/30 mb-4"
                  />
                  <p className="text-sm font-medium text-on-surface-variant/70">
                    Kết quả cải thiện render sẽ hiển thị ở đây
                  </p>
                </div>
              ) : (
                <>
                  {/* Large Preview */}
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
                                strokeDashoffset={`${2 * Math.PI * 40 * (1 - (smoothProgress[selectedItem.job?._id || selectedItem.job?.id] || selectedItem.job?.progress || 10) / 100)}`}
                              ></circle>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-sm font-bold">
                                {Math.floor(
                                  smoothProgress[selectedItem.job?._id || selectedItem.job?.id] ||
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

                        {/* Action Buttons Overlay */}
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
                                "Đã thêm ảnh vào mục tải lên ảnh gốc để chọn lại góc!",
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
                                `igen_enhance_${Date.now()}.png`,
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
                      <div className="w-full h-[400px] flex flex-col items-center justify-center text-error bg-error/5">
                        <Icon name="error" className="text-4xl mb-4" />
                        <p className="font-medium">Có lỗi xảy ra khi tạo ảnh</p>
                        <p className="text-sm opacity-70 mt-1">
                          {selectedItem?.job?.statusMessage ||
                            "Vui lòng thử lại sau"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Thumbnails */}
                  {currentResultItems.length > 0 && (
                    <div className="shrink-0 flex flex-wrap gap-2 overflow-y-auto custom-scrollbar pb-2 px-1 max-h-[30vh] min-h-[5rem]">
                      {currentResultItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedResultId(item.id)}
                          className={`relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                            selectedItem?.id === item.id
                              ? "border-primary shadow-md scale-105"
                              : "border-transparent hover:border-primary/50 opacity-70 hover:opacity-100"
                          }`}
                        >
                          {item.status === "pending" ? (
                            <>
                              {item.url ? (
                                <img
                                  src={item.url}
                                  alt="Thumbnail"
                                  className="w-full h-full object-contain opacity-50"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full bg-surface-container-low flex items-center justify-center">
                                  <Icon
                                    name="hourglass_empty"
                                    className="text-primary/50 text-2xl animate-pulse"
                                  />
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
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
          </div>

          {/* History Panel */}
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
                    Chưa có lịch sử cải thiện render.
                  </p>
                </div>
              ) : (
                historyResultItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedResultId(item.id)}
                    className={`w-40 h-40 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedItem?.id === item.id
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
        </div>
      </div>

      {/* Image Library Modal */}
      <ImageLibraryModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        onSelectImages={(images) => {
          setInputImages((prev) => [...prev, ...images]);
          setShowLibraryModal(false);
        }}
      />

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
