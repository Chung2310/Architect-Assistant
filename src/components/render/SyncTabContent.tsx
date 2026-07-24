import React, { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "../Icon";
import { toast } from "sonner";
import Markdown from "react-markdown";
import { useAuth } from "../../context/useAuth";
import { apiClient, ApiResponse } from "../../services/apiClient";
import { ImageLibraryModal } from "./ImageLibraryModal";
import { getAIClient, checkUserCredits, generateContentWithRetry, getImageBase64, cacheImage, scaleToResolution, safeJsonParse, uploadMedia } from "../../lib/renderUtils";

interface AngleSuggestion {
  id: string;
  title?: string;
  text: string;
  isGenerating?: boolean;
  generatedImage?: string;
  generatedImage2?: string;
  selectedModel?: string;
  generationProgress?: number;
  generationStatus?: string;
  _lastTranslatedTitle?: string;
  _timeoutId?: number | NodeJS.Timeout | null;
  isUpdatingPrompt?: boolean;
}

interface AngleCategory {
  name: string;
  suggestions: AngleSuggestion[];
  isExpanded?: boolean;
}

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
    model?: string;
    suggestionText?: string;
  };
}

const MODELS = [
  {
    id: "nano-banana-2",
    name: "Igen gemini Image Flash",
    isPro: false,
  },
  {
    id: "nano-banana-pro",
    name: "Igen gemini Image Pro",
    isPro: true,
  },
  {
    id: "openrouter-nano-banana-2",
    name: "Igen gemini Image Pro Preview",
    isPro: true,
  },
];

const GEMINI_MODELS = [
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
];

const RESOLUTIONS = [
  { id: "1K", name: "1K Full HD" },
  { id: "2K", name: "2K Quad HD" },
];

export const SyncTabContent: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("Đồng Bộ Công Trình");
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [_inputImageBase64, setInputImageBase64] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzeStatus, setAnalyzeStatus] = useState("");
  const [promptModel, setPromptModel] = useState("gemini-2.5-flash");
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisCategories, setAnalysisCategories] = useState<
    AngleCategory[] | null
  >(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [libraryTarget, setLibraryTarget] = useState<
    "input" | "context" | "character"
  >("input");
  const [isDragging, setIsDragging] = useState(false);
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [jobToDelete, setJobToDelete] = useState<RenderJob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user, socket } = useAuth();

  const fetchJobs = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient.get<ApiResponse<RenderJob[]>>(`/api/v1/render-jobs?type=${encodeURIComponent(activeSubTab)}&limit=50`);
      if (res.success && Array.isArray(res.data)) {
        const jobs = res.data;
        jobs.sort((a: RenderJob, b: RenderJob) => {
          const timeA = new Date(typeof a.createdAt === "string" ? a.createdAt : 0).getTime();
          const timeB = new Date(typeof b.createdAt === "string" ? b.createdAt : 0).getTime();
          return timeB - timeA;
        });
        setRenderJobs(jobs);
      }
    } catch (e) {
      console.error("Error fetching render jobs:", e);
    }
  }, [user, activeSubTab]);

  useEffect(() => {
    if (!user) {
      setTimeout(() => setRenderJobs([]), 0);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchJobs();

    // Refetch when the tab becomes active/visible again or window gains focus
    const handleRefetch = () => {
      if (document.visibilityState === "visible") {
        fetchJobs();
      }
    };

    window.addEventListener("focus", fetchJobs);
    document.addEventListener("visibilitychange", handleRefetch);

    return () => {
      window.removeEventListener("focus", fetchJobs);
      document.removeEventListener("visibilitychange", handleRefetch);
    };
  }, [user, fetchJobs]);

  useEffect(() => {
    if (!socket) return;

    socket.on("connect", fetchJobs);
    
    const handleJobUpdate = (updatedJob: RenderJob) => {
      if (updatedJob.type !== activeSubTab) return;
      setRenderJobs((prevJobs) => {
        const exists = prevJobs.some(j => (j._id || j.id) === (updatedJob._id || updatedJob.id));
        const newJobs = exists
          ? prevJobs.map(j => (j._id || j.id) === (updatedJob._id || updatedJob.id) ? updatedJob : j)
          : [updatedJob, ...prevJobs];
        return [...newJobs].sort((a: RenderJob, b: RenderJob) => {
          const timeA = new Date(typeof a.createdAt === "string" ? a.createdAt : 0).getTime();
          const timeB = new Date(typeof b.createdAt === "string" ? b.createdAt : 0).getTime();
          return timeB - timeA;
        });
      });
    };

    socket.on("renderJobUpdated", handleJobUpdate);
    return () => {
      socket.off("connect", fetchJobs);
      socket.off("renderJobUpdated", handleJobUpdate);
    };
  }, [socket, activeSubTab, fetchJobs]);

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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith("image/")) {
        toast.error("Vui lòng chọn file ảnh hợp lệ.");
        return;
      }

      if (!user) {
        toast.error("Vui lòng đăng nhập để tải ảnh lên.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setInputImageBase64(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);

      if (!(await checkUserCredits())) return;

      setIsUploading(true);
      setUploadProgress(1);
      let progressVal = 1;
      const progressInterval = setInterval(() => {
        progressVal += (95 - progressVal) * 0.1;
        setUploadProgress(Math.round(progressVal));
      }, 150);

      try {
        const downloadURL = await uploadMedia(file, "uploads");
        cacheImage(downloadURL, file);
        setInputImage(downloadURL);
        clearInterval(progressInterval);
        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(false);
        }, 400);
      } catch (error) {
        clearInterval(progressInterval);
        console.error("Error uploading file:", error);
        setIsUploading(false);
      }
    }
  };

  const [characterContextImages, setCharacterContextImages] = useState<
    { url: string; prompt: string }[]
  >([]);
  const [characterProvideType, setCharacterProvideType] = useState<
    "upload" | "prompt"
  >("upload");
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [characterPrompt, setCharacterPrompt] = useState("");
  const [isSyncingCharacter, setIsSyncingCharacter] = useState(false);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [characterGenProgress, setCharacterGenProgress] = useState(0);
  const [characterModel, setCharacterModel] = useState(
    "gemini-3-pro-image",
  );
  const [characterGenModel, setCharacterGenModel] = useState(
    "gemini-3-pro-image",
  );
  const [characterResolution, setCharacterResolution] = useState("1K");
  const [characterAspectRatio, setCharacterAspectRatio] = useState("1:1");
  const [syncResults, setSyncResults] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const contextFileInputRef = useRef<HTMLInputElement>(null);
  const characterFileInputRef = useRef<HTMLInputElement>(null);

  const subTabs = [
    { id: "Đồng Bộ Công Trình", icon: "domain" },
    { id: "Đồng Bộ Nhân Vật", icon: "person" },
  ];

  const [isDraggingContext, setIsDraggingContext] = useState(false);
  const [isDraggingCharacter, setIsDraggingCharacter] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setInputImage(null);
      setInputImageBase64(null);
      setAnalysisResult(null);
      setAnalysisCategories(null);
      setCharacterContextImages([]);
      setCharacterProvideType("upload");
      setCharacterImage(null);
      setCharacterPrompt("");
      setSyncResults([]);
    }, 0);
  }, [activeSubTab]);

  const handleContextDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingContext(true);
  };

  const handleContextDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingContext(false);
  };

  const handleContextDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingContext(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setCharacterContextImages([
            { url: ev.target.result as string, prompt: "" },
          ]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCharacterDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCharacter(true);
  };

  const handleCharacterDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCharacter(false);
  };

  const handleCharacterDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCharacter(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setCharacterImage(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleContextImagesUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setCharacterContextImages([
          { url: ev.target.result as string, prompt: "" },
        ]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCharacterImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error("Vui lòng đăng nhập để tải ảnh lên.");
      return;
    }

    const toastId = toast.loading("Đang tải ảnh lên...");
    try {
      const downloadURL = await uploadMedia(file, "characters");
      setCharacterImage(downloadURL);
      toast.success("Tải ảnh lên thành công", { id: toastId });
    } catch (error) {
      console.error("Error uploading character image:", error);
      toast.error("Có lỗi xảy ra khi tải ảnh lên.", { id: toastId });
    }
  };

  const handleGenerateCharacter = async () => {
    if (!characterPrompt) return;
    if (!user) {
      toast.error("Vui lòng đăng nhập để tạo ảnh.");
      return;
    }

    setIsGeneratingCharacter(true);
    setCharacterGenProgress(0);

    const startTime = Date.now();
    const expectedDuration = 15000;
    let currentCharacterProgress = 0;
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      currentCharacterProgress = Math.min(90, (elapsed / expectedDuration) * 90);
      setCharacterGenProgress(currentCharacterProgress);
    }, 100);

    try {
      const ai = await getAIClient(characterGenModel);
      const response = await generateContentWithRetry(ai, {
        model: characterGenModel,
        promptTemplateKey: "character_generate_prompt",
        promptTemplateInput: {
          characterPrompt,
          aspectRatio: "1:1",
        },
      });

      clearInterval(progressInterval);
      setCharacterGenProgress(95);

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part?.inlineData?.data;
          const mimeType = part?.inlineData?.mimeType || "image/png";

          const binary = atob(base64EncodeString);
          const array = [];
          for (let k = 0; k < binary.length; k++) {
            array.push(binary.charCodeAt(k));
          }
          const blob = new Blob([new Uint8Array(array)], { type: mimeType });
          const downloadURL = await uploadMedia(blob, "characters");
          
          const characterProgressStart = Math.min(95, currentCharacterProgress);
          for (let step = 1; step <= 10; step++) {
            await new Promise((resolve) => setTimeout(resolve, 40));
            setCharacterGenProgress(
              characterProgressStart + ((100 - characterProgressStart) * step) / 10,
            );
          }
          setCharacterImage(downloadURL);
          setCharacterProvideType("prompt");
          break;
        }
      }
    } catch (error) {
      console.error("Error generating character:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra khi tạo nhân vật. Vui lòng thử lại.",
      );
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsGeneratingCharacter(false);
        setCharacterGenProgress(0);
      }, 500);
    }
  };

  const handleSyncCharacter = async () => {
    if (!characterImage) {
      toast.error("Vui lòng cung cấp hình ảnh nhân vật.");
      return;
    }

    if (characterContextImages.length === 0) {
      toast.error("Vui lòng tải lên ít nhất một ảnh bối cảnh.");
      return;
    }

    if (!user) {
      toast.error("Vui lòng đăng nhập để đồng bộ.");
      return;
    }

    setIsSyncingCharacter(true);
    setSyncResults([]);
    setSyncProgress(0);

    const numImages = characterContextImages.length;
    const startTime = Date.now();
    const expectedDuration = characterContextImages.length * 15000;
    let currentSyncProgress = 0;
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      currentSyncProgress = Math.min(90, (elapsed / expectedDuration) * 90);
      setSyncProgress(currentSyncProgress);
    }, 100);

    try {
      const isPiapiModel = characterModel && (characterModel.startsWith("piapi-") || characterModel === "nano-banana-pro" || characterModel === "nano-banana-2" || characterModel === "openrouter-nano-banana-2");
      if (isPiapiModel) {
        toast.error("Tính năng Đồng Bộ Nhân Vật hiện chưa hỗ trợ PiAPI. Vui lòng chọn Gemini.");
        setIsSyncingCharacter(false);
        clearInterval(progressInterval);
        return;
      }

      const ai = await getAIClient(characterModel);

      const uploadImageIfBase64 = async (imageStr: string) => {
        if (imageStr.startsWith("data:")) {
          const match = imageStr.match(
            /^data:(image\/[a-zA-Z0-9]+);base64,(.+)$/,
          );
          if (match) {
            const mimeType = match[1];
            const base64Str = match[2];
            const binary = atob(base64Str);
            const array = [];
            for (let k = 0; k < binary.length; k++) {
              array.push(binary.charCodeAt(k));
            }
            const blob = new Blob([new Uint8Array(array)], { type: mimeType });
            return await uploadMedia(blob, "uploads");
          }
        }
        return imageStr;
      };

      const uploadInputImagesPromise = Promise.all([
        uploadImageIfBase64(characterImage),
        ...characterContextImages.map((img) => uploadImageIfBase64(img.url)),
      ]);

      const charImageData = await getImageBase64(characterImage);

      let imageSize = "1K";
      if (characterResolution === "2K") imageSize = "2K";
      if (characterResolution === "4K") imageSize = "4K";
      if (characterResolution === "512px") imageSize = "512px";

      let aspectRatio = "1:1";
      if (characterAspectRatio === "16:9") aspectRatio = "16:9";
      if (characterAspectRatio === "9:16") aspectRatio = "9:16";
      if (characterAspectRatio === "4:3") aspectRatio = "4:3";
      if (characterAspectRatio === "3:4") aspectRatio = "3:4";

      const taskProgress: number[] = [];

      const uploadedInputImages = await uploadInputImagesPromise;
      const uploadedCharImage = uploadedInputImages[0];
      const uploadedContextImages = uploadedInputImages.slice(1);

      const generatedImagesData: {
        base64: string;
        mimeType: string;
        prompt: string;
        contextIndex: number;
      }[] = [];
      let failedCount = 0;

      for (let i = 0; i < numImages; i++) {
        try {
          const ctxImg = characterContextImages[i];
          const ctxImageData = await getImageBase64(ctxImg.url);

          const userAction =
            ctxImg.prompt && ctxImg.prompt.trim() !== ""
              ? ctxImg.prompt
              : "[EMPTY] - Apply Auto-Placement and Auto-Posing based on the background.";

          const negativePromptText =
            "mutated hands, extra fingers, deformed face, morphed identity, mismatched lighting, flat lighting, floating subject, missing cast shadows, incorrect perspective, wrong scale, giant person, tiny person, clipping through objects, unnatural skin tone, cartoon, illustration, heavy vignette, distorted architecture, blurry subject, artificial outline, green screen edges.";

          const imageConfig: {
            aspectRatio: string;
            imageSize?: string;
            negativePrompt?: string;
          } = {
            aspectRatio:
              characterAspectRatio === "Tự động" ? "1:1" : aspectRatio,
          };
          if (
            characterModel === "gemini-3.1-flash-image" ||
            characterModel === "gemini-3-pro-image"
          ) {
            imageConfig.imageSize = imageSize;
            imageConfig.negativePrompt = negativePromptText;
          }

          const response = await generateContentWithRetry(ai, {
            model: characterModel,
            promptTemplateKey: "sync_character_composite_prompt",
            promptTemplateInput: {
              userAction,
              imageConfig,
              images: [
                {
                  data: ctxImageData.base64Data,
                  mimeType: ctxImageData.mimeType,
                },
                {
                  data: charImageData.base64Data,
                  mimeType: charImageData.mimeType,
                },
              ],
            },
          });

          taskProgress[i] = 100;

          let foundImage = false;
          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              let base64EncodeString = part?.inlineData?.data || "";
              let outMimeType = part?.inlineData?.mimeType || "image/png";

              if (
                characterResolution === "2K" ||
                characterResolution === "4K"
              ) {
                const scaled = await scaleToResolution(
                  base64EncodeString,
                  outMimeType,
                  characterResolution,
                );
                base64EncodeString = scaled.base64Data;
                outMimeType = scaled.mimeType;
              }

              generatedImagesData.push({
                base64: base64EncodeString,
                mimeType: outMimeType,
                prompt: ctxImg.prompt || "Đồng bộ nhân vật",
                contextIndex: i,
              });
              foundImage = true;
              break;
            }
          }
          if (!foundImage) {
            failedCount++;
            taskProgress[numImages + i] = 100;
          }
        } catch (error) {
          console.error(`Error generating image ${i}:`, error);
          failedCount++;
          taskProgress[i] = 100;
          taskProgress[numImages + i] = 100;
        }
      }

      if (failedCount > 0) {
        toast.error(
          `Có ${failedCount} ảnh không thể tạo. Đang tiếp tục lưu các ảnh thành công...`,
        );
      }

      if (generatedImagesData.length === 0) {
        toast.error("Không thể tạo bất kỳ ảnh nào. Vui lòng thử lại.");
        return;
      }

      const finalUrls: string[] = [];
      for (let i = 0; i < generatedImagesData.length; i++) {
        try {
          const imgData = generatedImagesData[i];
          const binary = atob(imgData.base64);
          const array = [];
          for (let k = 0; k < binary.length; k++) {
            array.push(binary.charCodeAt(k));
          }
          const blob = new Blob([new Uint8Array(array)], { type: imgData.mimeType });

          taskProgress[numImages + imgData.contextIndex] = 50;

          const downloadURL = await uploadMedia(blob, "syncs");

          taskProgress[numImages + imgData.contextIndex] = 100;

          finalUrls.push(downloadURL);

          const jobData = {
            userId: user._id,
            type: "Đồng Bộ Nhân Vật",
            inputImageUrls: [
              uploadedCharImage,
              uploadedContextImages[imgData.contextIndex],
            ],
            outputImageUrls: [downloadURL],
            status: "completed",
            progress: 100,
            statusMessage: "Hoàn tất",
            createdAt: new Date().toISOString(),
            settings: {
              prompt: imgData.prompt,
              model: characterModel,
              resolution: characterResolution,
              aspectRatio: characterAspectRatio,
            },
          };
          try {
            await apiClient.post("/api/v1/render-jobs", jobData);
          } catch (error) {
            console.error("Error creating render job:", error);
          }
        } catch (error) {
          console.error(`Error uploading image ${i}:`, error);
          const imgData = generatedImagesData[i];
          if (imgData) {
            taskProgress[numImages + imgData.contextIndex] = 100;
          } else {
            taskProgress[numImages + i] = 100;
          }
        }
      }

      if (finalUrls.length > 0) {
        clearInterval(progressInterval);
        const syncProgressStart = Math.min(95, currentSyncProgress);
        for (let step = 1; step <= 10; step++) {
          await new Promise((resolve) => setTimeout(resolve, 40));
          setSyncProgress(
            syncProgressStart + ((100 - syncProgressStart) * step) / 10,
          );
        }
        setSyncResults(finalUrls);
        toast.success("Đồng bộ nhân vật thành công!");
      } else {
        toast.error("Có lỗi xảy ra khi lưu ảnh.");
      }
    } catch (error) {
      console.error("Error syncing character:", error);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra khi đồng bộ.";
      toast.error(errMsg);
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsSyncingCharacter(false);
        setSyncProgress(0);
      }, 500);
    }
  };

  const handleDeleteSyncResult = async (urlToDelete: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xoá ảnh này?")) return;

    if (urlToDelete.includes("cloudinary.com")) {
      try {
        await apiClient.delete("/api/v1/media", {
          body: { publicId: urlToDelete }
        });
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
      }
    }
    setSyncResults((prev) => prev.filter((url) => url !== urlToDelete));
    toast.success("Đã xoá ảnh thành công");
  };

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
    setUploadProgress(1);
    let progressVal = 1;
    const progressInterval = setInterval(() => {
      progressVal += (95 - progressVal) * 0.1;
      setUploadProgress(Math.round(progressVal));
    }, 150);

    try {
      const downloadURL = await uploadMedia(file, "uploads");
      cacheImage(downloadURL, file);
      setInputImage(downloadURL);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
      }, 400);
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Error uploading image:", error);
      setIsUploading(false);
    }
  };

  const handleDeleteInputImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inputImage && inputImage.includes("cloudinary.com")) {
      try {
        await apiClient.delete("/api/v1/media", {
          body: { publicId: inputImage }
        });
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
      }
    }
    setInputImage(null);
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
      toast.error("Đã xảy ra lỗi khi tải ảnh. Vui lòng thử lại.");
    }
  };

  const handleDeleteGeneratedImage = async (
    catIndex: number,
    sugIndex: number,
  ) => {
    if (!analysisCategories) return;
    const suggestion = analysisCategories[catIndex].suggestions[sugIndex];
    if (!suggestion.generatedImage && !suggestion.generatedImage2) return;

    try {
      if (suggestion.generatedImage && suggestion.generatedImage.includes("cloudinary.com")) {
        await apiClient.delete("/api/v1/media", {
          body: { publicId: suggestion.generatedImage }
        }).catch(console.error);
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    }

    const newCats = [...analysisCategories];
    newCats[catIndex].suggestions[sugIndex].generatedImage = undefined;
    newCats[catIndex].suggestions[sugIndex].generatedImage2 = undefined;
    setAnalysisCategories(newCats);
  };

  const handleUpdatePromptFromTitle = async (
    catIndex: number,
    sugIndex: number,
  ) => {
    setAnalysisCategories((prev) => {
      if (!prev) return prev;
      const suggestion = prev[catIndex].suggestions[sugIndex];
      const currentTitle = suggestion.title;
      const cachedTitle = suggestion._lastTranslatedTitle;

      if (
        !currentTitle ||
        currentTitle === cachedTitle ||
        suggestion.isUpdatingPrompt
      )
        return prev;

      const newCats = [...prev];
      newCats[catIndex].suggestions[sugIndex].isUpdatingPrompt = true;
      const toastId = `update-prompt-${catIndex}-${sugIndex}`;
      toast.loading(
        "Đang cập nhật câu lệnh cho: " + currentTitle.substring(0, 20) + "...",
        { id: toastId },
      );

      (async () => {
        try {
          const ai = await getAIClient("gemini-2.5-flash");
          let parsedText: { hidden_api_prompt_en?: string; display_title_vi?: string } = {};
          try {
            parsedText = JSON.parse(suggestion.text);
          } catch {
            // Ignore JSON parse error
          }

          const result = await generateContentWithRetry(ai, {
            model: "gemini-2.5-flash",
            promptTemplateKey: "sync_suggestion_update_prompt",
            promptTemplateInput: {
              currentTitle,
              previousPrompt: parsedText.hidden_api_prompt_en || "",
            },
          });

          const rawText = typeof result.text === "function" ? result.text() : result.text;
          const newJsonString =
            rawText?.replace(/```json\n?|\n?```/g, "").trim() || "{}";
          const newJson = JSON.parse(newJsonString);

          if (newJson && newJson.hidden_api_prompt_en) {
            toast.success("Đã cập nhật câu lệnh thành công!", { id: toastId });
            setAnalysisCategories((latest) => {
              if (!latest) return latest;
              const cats = [...latest];
              const pText = cats[catIndex].suggestions[sugIndex].text;
              try {
                const pObj = JSON.parse(pText);
                pObj.hidden_api_prompt_en = newJson.hidden_api_prompt_en;
                pObj.display_title_vi = currentTitle;
                cats[catIndex].suggestions[sugIndex].text = JSON.stringify(
                  pObj,
                  null,
                  2,
                );
                cats[catIndex].suggestions[sugIndex]._lastTranslatedTitle =
                  currentTitle;
              } catch {
                // Ignore JSON parse error
              }
              cats[catIndex].suggestions[sugIndex].isUpdatingPrompt = false;
              return cats;
            });
          } else {
            toast.dismiss(toastId);
            setAnalysisCategories((latest) => {
              if (!latest) return latest;
              const cats = [...latest];
              cats[catIndex].suggestions[sugIndex].isUpdatingPrompt = false;
              return cats;
            });
          }
        } catch (error) {
          console.error("Error updating prompt from title", error);
          toast.error("Gặp lỗi khi tạo câu lệnh.", { id: toastId });
          setAnalysisCategories((latest) => {
            if (!latest) return latest;
            const cats = [...latest];
            cats[catIndex].suggestions[sugIndex].isUpdatingPrompt = false;
            return cats;
          });
        }
      })();

      return newCats;
    });
  };

  const handleGenerateSuggestionImage = async (
    catIndex: number,
    sugIndex: number,
  ) => {
    if (!analysisCategories || !inputImage) return;

    const suggestion = analysisCategories[catIndex].suggestions[sugIndex];
    if (!suggestion.text) return;

    let targetProgress = 0;
    const updateStatus = (progress: number, status: string) => {
      targetProgress = progress;
      setAnalysisCategories((prev) => {
        if (!prev) return prev;
        const newCats = [...prev];
        newCats[catIndex].suggestions[sugIndex].generationStatus = status;
        return newCats;
      });
    };

    const newCats = [...analysisCategories];
    newCats[catIndex].suggestions[sugIndex].isGenerating = true;
    newCats[catIndex].suggestions[sugIndex].generationProgress = 0;
    newCats[catIndex].suggestions[sugIndex].generationStatus = "Khởi tạo...";
    setAnalysisCategories(newCats);

    const progressInterval = setInterval(() => {
      setAnalysisCategories((prev) => {
        if (!prev) return prev;
        const newCats = [...prev];
        const currentP =
          newCats[catIndex].suggestions[sugIndex].generationProgress || 0;
        let p = currentP;
        if (p < targetProgress) {
          p += (targetProgress - p) * 0.2;
        } else if (p < 90) {
          p += 0.5;
        }
        newCats[catIndex].suggestions[sugIndex].generationProgress = Math.min(
          p,
          98,
        );
        return newCats;
      });
    }, 200);

    try {
      updateStatus(5, "Đang tải ảnh gốc...");
      const ai = await getAIClient(
        suggestion.selectedModel || "gemini-3-pro-image",
      );

      let base64Data = "";
      let mimeType = "image/jpeg";

      if (inputImage.toLowerCase().includes(".png")) mimeType = "image/png";
      else if (inputImage.toLowerCase().includes(".webp"))
        mimeType = "image/webp";

      const imageData = await getImageBase64(inputImage);
      mimeType = imageData.mimeType;
      base64Data = imageData.base64Data;

      let promptInstruction = suggestion.text;
      try {
        const parsedNode = JSON.parse(suggestion.text);
        if (parsedNode && parsedNode.hidden_api_prompt_en) {
          promptInstruction = parsedNode.hidden_api_prompt_en;
        }
      } catch {
        // use raw
      }

      const selectedModel =
        suggestion.selectedModel || "openrouter-nano-banana-2";

      const generatedImageUrls: string[] = [];

      updateStatus(10, "Đang gửi yêu cầu đến AI...");

      const requestPayload1 = {
        model: selectedModel,
        promptTemplateKey: "sync_variation_generate_prompt",
        promptTemplateInput: {
          promptInstruction,
          variationLabel: "Variation A",
          aspectRatio: "16:9",
          images: [
            {
              data: base64Data,
              mimeType,
            },
          ],
        },
      };

      const requestPayload2 = {
        model: selectedModel,
        promptTemplateKey: "sync_variation_generate_prompt",
        promptTemplateInput: {
          promptInstruction,
          variationLabel: "Variation B",
          aspectRatio: "16:9",
          images: [
            {
              data: base64Data,
              mimeType,
            },
          ],
        },
      };

      const [result1, result2] = await Promise.all([
        generateContentWithRetry(ai, requestPayload1),
        generateContentWithRetry(ai, requestPayload2),
      ]);

      updateStatus(50, "Đang nhận dữ liệu từ AI...");

      const processResult = async (res: unknown) => {
        const result = res as {
          candidates?: {
            content?: {
              parts?: {
                inlineData?: {
                  data: string;
                  mimeType?: string;
                };
              }[];
            };
          }[];
        };
        for (const part of result.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const b64 = part?.inlineData?.data;
            const mime = part?.inlineData?.mimeType || "image/png";

            const binary = atob(b64);
            const array = [];
            for (let k = 0; k < binary.length; k++) {
              array.push(binary.charCodeAt(k));
            }
            const blob = new Blob([new Uint8Array(array)], { type: mime });

            updateStatus(70, "Đang lưu trữ kết quả...");
            const currentImageUrl = await uploadMedia(blob, "sync_suggestions");

            cacheImage(currentImageUrl, blob);
            generatedImageUrls.push(currentImageUrl);
          }
        }
      };

      await Promise.all([processResult(result1), processResult(result2)]);

      if (generatedImageUrls.length > 0) {
        const jobData = {
          userId: user?._id,
          type: "Đồng Bộ Công Trình",
          inputImageUrls: [inputImage],
          outputImageUrls: generatedImageUrls,
          status: "completed",
          progress: 100,
          statusMessage: "Hoàn tất",
          createdAt: new Date().toISOString(),
          settings: {
            prompt: promptInstruction,
            model: selectedModel,
            suggestionText: suggestion.text,
          },
        };
        try {
          await apiClient.post("/api/v1/render-jobs", jobData);
        } catch (error) {
          console.error("Error saving render job:", error);
        }
      }

      clearInterval(progressInterval);
      updateStatus(100, "Hoàn tất!");

      setAnalysisCategories((prev) => {
        if (!prev) return prev;
        const updatedCats = [...prev];
        updatedCats[catIndex].suggestions[sugIndex].generationProgress = 100;
        updatedCats[catIndex].suggestions[sugIndex].generatedImage =
          generatedImageUrls[0];
        updatedCats[catIndex].suggestions[sugIndex].generatedImage2 =
          generatedImageUrls[1];
        updatedCats[catIndex].suggestions[sugIndex].isGenerating = false;
        return updatedCats;
      });
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Error generating image:", error);
      setAnalysisCategories((prev) => {
        if (!prev) return prev;
        const updatedCats = [...prev];
        updatedCats[catIndex].suggestions[sugIndex].isGenerating = false;
        updatedCats[catIndex].suggestions[sugIndex].generationStatus = "Lỗi!";
        return updatedCats;
      });
    }
  };

  const handleAnalyze = async () => {
    if (!inputImage) return;
    setIsAnalyzing(true);
    setAnalyzeProgress(0);
    setAnalyzeStatus("Khoi tao...");
    setAnalysisResult(null);
    setAnalysisCategories(null);

    let progressInterval: NodeJS.Timeout | number | undefined;

    try {
      setAnalyzeProgress(10);
      setAnalyzeStatus("Dang chuan bi du lieu anh...");
      const ai = await getAIClient(promptModel);

      let mimeType = "image/jpeg";
      if (inputImage.toLowerCase().includes(".png")) mimeType = "image/png";
      else if (inputImage.toLowerCase().includes(".webp")) mimeType = "image/webp";

      const imageData = await getImageBase64(inputImage);
      mimeType = imageData.mimeType;

      setAnalyzeProgress(15);
      setAnalyzeStatus("Dang gui yeu cau den AI...");

      progressInterval = setInterval(() => {
        setAnalyzeProgress((prev) => {
          if (prev >= 95) return prev;
          let inc = 2;
          if (prev > 70) inc = 0.5;
          if (prev > 90) inc = 0.1;
          return Math.min(prev + inc, 95);
        });
      }, 500);

      const result = await generateContentWithRetry(ai, {
        model: promptModel,
        promptTemplateKey: "sync_analyze_prompt",
        promptTemplateInput: {
          activeSubTab,
          images: [
            {
              data: imageData.base64Data,
              mimeType,
            },
          ],
        },
      });

      clearInterval(progressInterval);
      setAnalyzeProgress(97);
      setAnalyzeStatus("Dang xu ly ket qua...");

      if (result.text) {
        try {
          const rawText = typeof result.text === "function" ? result.text() : result.text;
          const jsonString = (rawText || "")
            .replace(/```json\n?|\n?```/g, "")
            .trim();
          const parsed = safeJsonParse(jsonString) as any;

          let rawCategories = parsed?.categories;
          let rawShots = parsed?.shots || parsed?.suggestions;

          if (!rawCategories && parsed?.mental_blueprint) {
            rawCategories = parsed.mental_blueprint.categories;
            if (!rawShots) {
              rawShots = parsed.mental_blueprint.shots || parsed.mental_blueprint.suggestions;
            }
          }

          if (!rawCategories && Array.isArray(parsed)) {
            rawCategories = parsed;
          }

          if (rawCategories && Array.isArray(rawCategories) && rawCategories.length > 0) {
            interface ParsedShot {
              display_title_vi?: string;
              hidden_api_prompt_en?: string;
              text?: string;
              title?: string;
            }

            // Tên cố định cho 3 nhóm theo thứ tự (phòng trường hợp AI trả về tên không đúng)
            const FIXED_CATEGORY_NAMES = [
              "Góc Trung Cảnh",
              "Góc Cận Cảnh Nghệ Thuật",
              "Góc Nội Thất",
            ];

            const formattedCategories: AngleCategory[] = rawCategories.map((cat: any, idx: number) => {
              const catId = cat.id || cat.category_id || cat.category_name || "";
              // Ưu tiên tên từ AI nếu hợp lý, fallback về tên cố định theo index
              const aiName = cat.display_title_vi || cat.name || cat.category_name || "";
              const isGenericName = !aiName || aiName.toLowerCase().startsWith("góc chụp") || aiName.toLowerCase() === "category" || aiName.trim().length < 5;
              const catName = isGenericName ? (FIXED_CATEGORY_NAMES[idx] || aiName || "Góc chụp") : aiName;
              
              // Get shots from nested structure if available
              let catShots = cat.suggestions || cat.shots || [];
              
              // If not nested, filter from rawShots array
              if ((!catShots || catShots.length === 0) && Array.isArray(rawShots)) {
                catShots = rawShots.filter((shot: any) => {
                  const shotCatId = shot.category_id || shot.category || "";
                  return String(shotCatId).toLowerCase() === String(catId).toLowerCase() || 
                         String(shotCatId).toLowerCase() === String(catName).toLowerCase();
                });
              }

              return {
                name: catName,
                isExpanded: true,
                suggestions: ((catShots || []) as (ParsedShot | string)[]).map((sug) => {
                  const isStr = typeof sug === "string";
                  const displayTitle = isStr ? "" : (sug.display_title_vi || sug.title || "");
                  const hiddenPrompt = isStr ? sug : (sug.hidden_api_prompt_en || sug.text || "");
                  return {
                    id: Math.random().toString(36).substring(7),
                    title: displayTitle,
                    _lastTranslatedTitle: displayTitle,
                    text: JSON.stringify(
                      {
                        display_title_vi: displayTitle,
                        hidden_api_prompt_en: hiddenPrompt,
                      },
                      null,
                      2,
                    ),
                    selectedModel: "openrouter-nano-banana-2",
                  };
                }),
              };
            });

            setAnalysisCategories(formattedCategories);
            for (let step = 1; step <= 6; step++) {
              await new Promise((resolve) => setTimeout(resolve, 40));
              setAnalyzeProgress(97 + (3 * step) / 6);
            }
            setAnalyzeStatus("Hoàn tất!");
          } else {
            console.error("Invalid JSON structure or empty categories", parsed);
            setAnalysisResult(result.text);
            setAnalyzeStatus("Lỗi định dạng dữ liệu");
          }
        } catch (e) {
          console.error("Failed to parse JSON", e);
          setAnalysisResult(result.text);
          setAnalyzeStatus("Loi phan tich du lieu");
        }
      } else {
        setAnalysisResult("Khong co ket qua phan tich.");
        setAnalyzeStatus("Khong co ket qua");
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      clearInterval(progressInterval);
      setAnalysisResult(
        `Da xay ra loi khi phan tich anh: ${error instanceof Error ? error.message : String(error)}`,
      );
      setAnalyzeStatus("Loi!");
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalyzeProgress(0);
        setAnalyzeStatus("");
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex justify-center pt-6 pb-2 shrink-0">
        <div className="flex bg-surface-container-low rounded-full p-1 border border-outline-variant/20">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`w-[220px] py-2 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeSubTab === tab.id
                  ? "bg-[#00BCD4]/10 text-[#00BCD4]"
                  : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
              }`}
            >
              <Icon name={tab.icon} className="text-[18px]" />
              {tab.id}
            </button>
          ))}
        </div>
      </div>

      <div className="text-center mb-6 shrink-0">
        <h2 className="text-xl font-bold text-on-surface mb-1">
          {activeSubTab === "Đồng Bộ Công Trình"
            ? "Đồng Bộ Công Trình"
            : "Đồng Bộ Nhân Vật"}
        </h2>
        <p className="text-sm text-on-surface-variant">
          {activeSubTab === "Đồng Bộ Công Trình"
            ? "Tạo các góc chụp khác nhau từ một ảnh phối cảnh gốc."
            : "Ghép một nhân vật vào nhiều bối cảnh khác nhau."}
        </p>
      </div>

      <div className="p-6 pt-0 flex flex-col gap-6">
        {activeSubTab === "Đồng Bộ Công Trình" ? (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column */}
            <div className="w-full lg:w-[380px] flex flex-col gap-4 shrink-0">
              {/* Panel 1: Tải Lên Ảnh Gốc */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-on-surface">
                    1. Tải Lên Ảnh Gốc
                  </h3>
                  <button
                    onClick={() => {
                      setLibraryTarget("input");
                      setShowLibraryModal(true);
                    }}
                    className="text-xs font-bold text-[#00BCD4] bg-[#00BCD4]/10 hover:bg-[#00BCD4]/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Icon name="photo_library" className="text-[16px]" />
                    Thư viện ảnh
                  </button>
                </div>
                <div
                  className={`min-h-[12rem] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center group transition-colors cursor-pointer relative overflow-hidden p-6 ${
                    isDragging && !inputImage
                      ? "border-primary bg-primary/10"
                      : !inputImage
                      ? "border-outline-variant/40 hover:border-primary/50 bg-surface-container-low/50 hover:bg-surface-container-low"
                      : "bg-surface-container-lowest border-outline-variant/20"
                  }`}
                  onClick={() => !inputImage && fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    if (!inputImage) handleDragOver(e);
                  }}
                  onDragLeave={(e) => {
                    if (!inputImage) handleDragLeave(e);
                  }}
                  onDrop={(e) => {
                    if (!inputImage) handleDrop(e);
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
                    <div className="flex flex-col items-center p-6">
                      <div className="w-12 h-12 border-4 border-[#00BCD4] border-t-transparent rounded-full animate-spin mb-3"></div>
                      <p className="text-sm font-semibold text-[#00BCD4]">
                        Đang tải lên... {Math.round(uploadProgress)}%
                      </p>
                    </div>
                  ) : inputImage ? (
                    <div className="relative w-full h-full p-2 flex items-center justify-center bg-white/50 group">
                      <img
                        src={inputImage}
                        alt="Uploaded"
                        className="max-h-[280px] w-full object-contain rounded-xl cursor-zoom-in hover:opacity-95 transition-opacity"
                        referrerPolicy="no-referrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImageUrl(inputImage);
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteInputImage(e);
                        }}
                        className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 opacity-80 hover:opacity-100 transition-all shadow-md z-10"
                        title="Xóa ảnh"
                      >
                        <Icon name="delete" className="text-[18px]" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                        <Icon
                          name="image"
                          className="text-2xl text-on-surface-variant group-hover:text-primary transition-colors"
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

              {/* Analyze Button Panel */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-on-surface">
                    2. Phân Tích & Tạo Gợi Ý
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
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !inputImage || isUploading}
                  className="relative w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
                >
                  <div className="relative z-10 flex items-center gap-3">
                    {isAnalyzing ? (
                      <>
                        <div className="relative w-8 h-8 flex items-center justify-center">
                          <svg
                            className="absolute inset-0 w-full h-full animate-spin"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              fill="none"
                            />
                            <circle
                              className="opacity-100 transition-all duration-500 ease-out"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              fill="none"
                              strokeDasharray="62.83"
                              strokeDashoffset={
                                62.83 - (62.83 * (analyzeProgress || 0)) / 100
                              }
                              strokeLinecap="round"
                              transform="rotate(-90 12 12)"
                            />
                          </svg>
                          <span className="absolute text-[9px] font-bold">
                            {Math.round(analyzeProgress)}%
                          </span>
                        </div>
                        <span>{analyzeStatus || "Đang phân tích..."}</span>
                      </>
                    ) : (
                      <>
                        <Icon name="auto_awesome" className="text-lg" />
                        Phân Tích & Tạo Gợi Ý
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-sm flex flex-col min-h-[550px] overflow-hidden">
              <h3 className="text-base font-bold text-on-surface mb-4 shrink-0">
                3. Gợi Ý Các Góc Chụp
              </h3>
              <div
                className={`flex-1 overflow-y-auto pr-2 ${analysisCategories && analysisCategories.length > 0 ? "" : "bg-surface-container-low rounded-xl flex flex-col items-center justify-center text-center p-8"}`}
              >
                {analysisCategories && analysisCategories.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {analysisCategories.map((category, catIndex) => (
                      <div key={catIndex} className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            const newCats = [...analysisCategories];
                            newCats[catIndex].isExpanded =
                              !newCats[catIndex].isExpanded;
                            setAnalysisCategories(newCats);
                          }}
                          className="flex items-center gap-2 text-primary font-bold text-sm hover:underline text-left"
                        >
                          <Icon
                            name={
                              category.isExpanded
                                ? "arrow_drop_down"
                                : "arrow_right"
                            }
                            className="text-xl"
                          />
                          {category.name.replace(/\s*\(\d+\)$/, "")} (
                          {category.suggestions.length})
                        </button>

                        {category.isExpanded && (
                          <div className="flex flex-col gap-4 pl-4">
                            {category.suggestions.map(
                              (suggestion, sugIndex) => (
                                <div
                                  key={suggestion.id}
                                  className="bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden"
                                >
                                  <div className="p-4 flex flex-col gap-3">
                                    <div className="flex items-start gap-2 relative">
                                      <textarea
                                        rows={2}
                                        className="font-bold text-xs text-on-surface bg-transparent border border-transparent hover:border-outline-variant/30 focus:border-primary/50 focus:bg-surface-container-highest outline-none rounded-md px-2 py-1 -ml-2 transition-all flex-1 resize-none leading-relaxed"
                                        value={suggestion.title}
                                        onChange={(e) => {
                                          const newCats = [
                                            ...analysisCategories,
                                          ];
                                          const newTitle = e.target.value;
                                          newCats[catIndex].suggestions[
                                            sugIndex
                                          ].title = newTitle;

                                          try {
                                            const parsedText = JSON.parse(
                                              suggestion.text,
                                            );
                                            if (
                                              parsedText &&
                                              typeof parsedText === "object"
                                            ) {
                                              parsedText.display_title_vi =
                                                newTitle;
                                              newCats[catIndex].suggestions[
                                                sugIndex
                                              ].text = JSON.stringify(
                                                parsedText,
                                                null,
                                                2,
                                              );
                                            }
                                          } catch {
                                            // Ignore
                                          }

                                          if (
                                            newCats[catIndex].suggestions[
                                              sugIndex
                                            ]._timeoutId
                                          ) {
                                            clearTimeout(
                                              newCats[catIndex].suggestions[
                                                sugIndex
                                              ]._timeoutId,
                                            );
                                          }
                                          newCats[catIndex].suggestions[
                                            sugIndex
                                          ]._timeoutId = setTimeout(() => {
                                            handleUpdatePromptFromTitle(
                                              catIndex,
                                              sugIndex,
                                            );
                                          }, 1500);

                                          setAnalysisCategories(newCats);
                                        }}
                                        onBlur={() =>
                                          handleUpdatePromptFromTitle(
                                            catIndex,
                                            sugIndex,
                                          )
                                        }
                                        disabled={
                                          suggestion.isUpdatingPrompt
                                        }
                                        title="Bạn có thể sửa tiêu đề này, AI sẽ tự động điều chỉnh câu lệnh tạo ảnh tương ứng."
                                      />
                                      {suggestion.isUpdatingPrompt && (
                                        <div className="flex items-center gap-2 pr-2">
                                          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0"></div>
                                          <span className="text-xs text-primary font-medium animate-pulse">
                                            Đang dịch...
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <textarea
                                      className="hidden"
                                      value={suggestion.text}
                                      onChange={(e) => {
                                        const newCats = [...analysisCategories];
                                        const newText = e.target.value;
                                        newCats[catIndex].suggestions[
                                          sugIndex
                                        ].text = newText;

                                        try {
                                          const parsedText =
                                            JSON.parse(newText);
                                          if (
                                            parsedText &&
                                            typeof parsedText === "object" &&
                                            parsedText.display_title_vi
                                          ) {
                                            newCats[catIndex].suggestions[
                                              sugIndex
                                            ].title =
                                              parsedText.display_title_vi;
                                          }
                                        } catch {
                                          // Ignore
                                        }
                                        setAnalysisCategories(newCats);
                                      }}
                                    />
                                    <div className="flex justify-end items-center gap-2">
                                      <div className="relative w-48">
                                        <select
                                          className="w-full bg-surface-container-lowest border border-outline-variant/20 focus:border-primary rounded-lg p-2 text-xs font-medium text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                                          value={
                                            suggestion.selectedModel ||
                                            "openrouter-nano-banana-2"
                                          }
                                          onChange={(e) => {
                                            const newCats = [
                                              ...analysisCategories,
                                            ];
                                            newCats[catIndex].suggestions[
                                              sugIndex
                                            ].selectedModel = e.target.value;
                                            setAnalysisCategories(newCats);
                                          }}
                                        >
                                          {MODELS.map((model) => (
                                            <option
                                              key={model.id}
                                              value={model.id}
                                            >
                                              {model.name}
                                            </option>
                                          ))}
                                        </select>
                                        <Icon
                                          name="keyboard_arrow_down"
                                          className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[16px]"
                                        />
                                      </div>
                                      <button
                                        onClick={() =>
                                          handleGenerateSuggestionImage(
                                            catIndex,
                                            sugIndex,
                                          )
                                        }
                                        disabled={
                                          suggestion.isGenerating ||
                                          suggestion.isUpdatingPrompt ||
                                          suggestion.title !==
                                            suggestion._lastTranslatedTitle
                                        }
                                        className="bg-[#00BCD4]/10 text-[#00BCD4] hover:bg-[#00BCD4]/20 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                                      >
                                        <div className="relative z-10 flex items-center gap-2">
                                          {suggestion.isGenerating ? (
                                            <>
                                              <div className="relative w-5 h-5 flex items-center justify-center">
                                                <svg
                                                  className="absolute inset-0 w-full h-full animate-spin"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    fill="none"
                                                  />
                                                  <circle
                                                    className="opacity-100 transition-all duration-500 ease-out"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    fill="none"
                                                    strokeDasharray="62.83"
                                                    strokeDashoffset={
                                                      62.83 -
                                                      (62.83 *
                                                        (suggestion.generationProgress ||
                                                          0)) /
                                                        100
                                                    }
                                                    strokeLinecap="round"
                                                    transform="rotate(-90 12 12)"
                                                  />
                                                </svg>
                                              </div>
                                              <span>
                                                {suggestion.generationStatus ||
                                                  "Đang xử lý..."}
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              <Icon
                                                name="auto_awesome"
                                                className="text-[16px]"
                                              />
                                              <span>Tạo Ảnh</span>
                                            </>
                                          )}
                                        </div>
                                      </button>
                                    </div>
                                  </div>

                                  {suggestion.isGenerating && (
                                    <div className="w-full aspect-[2/1] bg-surface-container-low/50 border-t border-outline-variant/20 flex flex-col items-center justify-center p-4">
                                      <div className="relative w-16 h-16 flex items-center justify-center mb-4">
                                        <svg
                                          className="absolute inset-0 w-full h-full animate-spin text-primary"
                                          viewBox="0 0 24 24"
                                        >
                                          <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            fill="none"
                                          />
                                          <circle
                                            className="opacity-100 transition-all duration-500 ease-out"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            fill="none"
                                            strokeDasharray="62.83"
                                            strokeDashoffset={
                                              62.83 -
                                              (62.83 *
                                                (suggestion.generationProgress ||
                                                  0)) /
                                                100
                                            }
                                            strokeLinecap="round"
                                            transform="rotate(-90 12 12)"
                                          />
                                        </svg>
                                        <span className="absolute text-sm font-bold text-primary">
                                          {Math.round(
                                            suggestion.generationProgress || 0,
                                          )}
                                          %
                                        </span>
                                      </div>
                                      <p className="text-sm font-medium text-on-surface-variant">
                                        {suggestion.generationStatus ||
                                          "AI đang kiến tạo chi tiết..."}
                                      </p>
                                    </div>
                                  )}

                                  {suggestion.generatedImage &&
                                    !suggestion.isGenerating && (
                                      <div className="flex w-full aspect-[2/1] bg-black/5 border-t border-outline-variant/20">
                                        <div
                                          className="flex-1 relative border-r border-outline-variant/20 group cursor-zoom-in"
                                          onClick={() =>
                                            setPreviewImageUrl(suggestion.generatedImage!)
                                          }
                                        >
                                          <img
                                            src={suggestion.generatedImage!}
                                            alt="Generated 1"
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                          />
                                          <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm">
                                            Ảnh Gợi Ý 1
                                          </div>
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewImageUrl(
                                                  suggestion.generatedImage!,
                                                );
                                              }}
                                              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
                                            >
                                              <Icon name="zoom_in" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownloadImage(
                                                  suggestion.generatedImage!,
                                                  `sync_result_1_${Date.now()}.png`,
                                                );
                                              }}
                                              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
                                            >
                                              <Icon name="download" />
                                            </button>
                                          </div>
                                        </div>
                                        <div
                                          className="flex-1 relative group cursor-zoom-in"
                                          onClick={() =>
                                            setPreviewImageUrl(
                                              suggestion.generatedImage2 || suggestion.generatedImage!,
                                            )
                                          }
                                        >
                                          <img
                                            src={suggestion.generatedImage2 || suggestion.generatedImage!}
                                            alt="Generated 2"
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                          />
                                          <div className="absolute top-2 left-2 bg-primary/80 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm">
                                            Ảnh Gợi Ý 2
                                          </div>
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewImageUrl(
                                                  suggestion.generatedImage2 || suggestion.generatedImage!,
                                                );
                                              }}
                                              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
                                            >
                                              <Icon name="zoom_in" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownloadImage(
                                                  suggestion.generatedImage2 || suggestion.generatedImage!,
                                                  `sync_result_2_${Date.now()}.png`,
                                                );
                                              }}
                                              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
                                            >
                                              <Icon name="download" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteGeneratedImage(
                                                  catIndex,
                                                  sugIndex,
                                                );
                                              }}
                                              className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white backdrop-blur-sm transition-colors shadow-lg"
                                            >
                                              <Icon name="delete" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : analysisResult ? (
                  <div className="markdown-body text-sm text-on-surface overflow-y-auto max-h-[400px]">
                    <Markdown>{analysisResult}</Markdown>
                  </div>
                ) : (
                  <>
                    <Icon
                      name="photo_camera"
                      className="text-4xl text-on-surface-variant/30 mb-4"
                    />
                    <p className="text-sm text-on-surface-variant">
                      Các gợi ý góc chụp sẽ xuất hiện ở đây.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column */}
            <div className="w-full lg:w-[380px] flex flex-col gap-4 shrink-0">
              {/* Panel 1: Tải Lên Các Bối Cảnh */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-on-surface">
                    1. Tải Lên Các Bối Cảnh
                  </h3>
                  <button
                    onClick={() => {
                      setLibraryTarget("context");
                      setShowLibraryModal(true);
                    }}
                    className="text-xs font-bold text-[#00BCD4] bg-[#00BCD4]/10 hover:bg-[#00BCD4]/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Icon name="photo_library" className="text-[16px]" />
                    Thư viện ảnh
                  </button>
                </div>
                <div
                  className={`min-h-[8rem] border-2 border-dashed ${isDraggingContext ? "border-primary bg-primary/5" : "border-outline-variant/40 bg-surface-container-low/50"} rounded-xl flex flex-col p-4 transition-colors relative overflow-hidden`}
                  onDragOver={handleContextDragOver}
                  onDragLeave={handleContextDragLeave}
                  onDrop={handleContextDrop}
                >
                  {characterContextImages.length > 0 ? (
                    <div className="relative w-full h-full min-h-[220px] max-h-[300px] p-2 flex flex-col items-center justify-center bg-surface-container-low/30 rounded-xl overflow-hidden group">
                      <div className="relative w-full h-full flex flex-col items-center justify-center">
                        <img
                          src={characterContextImages[0].url}
                          alt="Context"
                          className="max-h-[240px] w-full object-contain rounded-lg shadow-sm cursor-zoom-in hover:opacity-95 transition-opacity"
                          referrerPolicy="no-referrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImageUrl(characterContextImages[0].url);
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCharacterContextImages([]);
                          }}
                          className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 opacity-80 hover:opacity-100 transition-all shadow-md z-10"
                          title="Xóa ảnh"
                        >
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex-1 flex flex-col items-center justify-center text-center cursor-pointer py-8"
                      onClick={() => contextFileInputRef.current?.click()}
                    >
                      <Icon
                        name="image"
                        className="text-3xl text-on-surface-variant/50 mb-2"
                      />
                      <p className="text-sm font-medium text-on-surface mb-1">
                        Nhấp hoặc kéo tệp vào đây
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        PNG, JPG, WEBP
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={contextFileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleContextImagesUpload}
                  />
                </div>
              </div>

              {/* Panel 2: Cung Cấp Nhân Vật */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-on-surface">
                    2. Cung Cấp Nhân Vật
                  </h3>
                  {characterProvideType === "upload" && (
                    <button
                      onClick={() => {
                        setLibraryTarget("character");
                        setShowLibraryModal(true);
                      }}
                      className="text-xs font-bold text-[#00BCD4] bg-[#00BCD4]/10 hover:bg-[#00BCD4]/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Icon name="photo_library" className="text-[16px]" />
                      Thư viện ảnh
                    </button>
                  )}
                </div>

                <div className="flex bg-surface-container-low rounded-lg p-1 mb-4">
                  <button
                    onClick={() => setCharacterProvideType("upload")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${characterProvideType === "upload" ? "bg-surface-container-highest text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                  >
                    Tải Lên Ảnh
                  </button>
                  <button
                    onClick={() => setCharacterProvideType("prompt")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${characterProvideType === "prompt" ? "bg-surface-container-highest text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                  >
                    Tạo Từ Prompt
                  </button>
                </div>

                {characterProvideType === "upload" ? (
                  <>
                    <div
                      className={`mb-4 min-h-[12rem] border-2 border-dashed ${isDraggingCharacter ? "border-[#00BCD4] bg-[#00BCD4]/5" : "border-outline-variant/40 bg-surface-container-low/50"} rounded-xl flex flex-col items-center justify-center text-center group hover:border-[#00BCD4]/50 transition-colors cursor-pointer hover:bg-surface-container-low relative overflow-hidden p-4`}
                      onClick={() => characterFileInputRef.current?.click()}
                      onDragOver={handleCharacterDragOver}
                      onDragLeave={handleCharacterDragLeave}
                      onDrop={handleCharacterDrop}
                    >
                      {characterImage ? (
                        <div className="relative w-full h-full p-2 flex justify-center items-center">
                          <img
                            src={characterImage}
                            alt="Character"
                            className="h-auto object-contain max-h-[240px] rounded-lg cursor-zoom-in hover:opacity-95 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImageUrl(characterImage);
                            }}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCharacterImage(null);
                            }}
                            className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 opacity-80 hover:opacity-100 transition-all shadow-md z-10"
                            title="Xóa ảnh"
                          >
                            <Icon name="delete" className="text-[18px]" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Icon
                            name="person_add"
                            className="text-4xl text-on-surface-variant mb-2 opacity-50 group-hover:opacity-100 transition-opacity"
                          />
                          <p className="text-sm font-medium text-on-surface mb-1">
                            Tải Lên
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            Kéo thả ảnh vào đây hoặc click để chọn file
                          </p>
                        </>
                      )}
                      <input
                        type="file"
                        ref={characterFileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleCharacterImageUpload}
                      />
                    </div>
                    <div className="text-center py-2">
                      <p className="text-sm text-on-surface-variant">
                        Bạn có thể tải ảnh lên bằng cách kéo thả vào khung phía
                        trên, hoặc chọn từ{" "}
                        <span
                          className="text-[#00BCD4] cursor-pointer hover:underline font-medium"
                          onClick={() => {
                            setLibraryTarget("character");
                            setShowLibraryModal(true);
                          }}
                        >
                          Thư viện ảnh
                        </span>
                        .
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-4">
                    <textarea
                      value={characterPrompt}
                      onChange={(e) => setCharacterPrompt(e.target.value)}
                      placeholder="Nhập mô tả nhân vật của bạn để AI tạo ảnh..."
                      className="w-full h-24 bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 text-sm text-on-surface resize-none focus:outline-none focus:border-[#00BCD4]"
                    />

                    {characterImage && (
                      <div className="mt-2 bg-surface-container-low rounded-xl flex justify-center items-center relative p-2 border border-outline-variant/20">
                        <img
                          src={characterImage}
                          alt="Character Generated"
                          className="h-auto object-contain max-h-[240px] rounded-lg cursor-zoom-in"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImageUrl(characterImage);
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCharacterImage(null);
                          }}
                          className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 opacity-70 hover:opacity-100 transition-all"
                        >
                          <Icon name="close" className="text-[16px]" />
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-2">
                        AI Engine tạo ảnh
                      </label>
                      <div className="relative">
                        <select
                          className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-[#00BCD4] rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                          value={characterGenModel}
                          onChange={(e) => setCharacterGenModel(e.target.value)}
                        >
                          {GEMINI_MODELS.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
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
                      onClick={handleGenerateCharacter}
                      disabled={isGeneratingCharacter || !characterPrompt}
                      className={
                        isGeneratingCharacter
                          ? "w-full py-3 bg-[#00BCD4]/10 text-[#00BCD4] font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-none cursor-not-allowed"
                          : "w-full py-3 bg-gradient-to-r from-[#00BCD4] to-[#00BCD4]/80 hover:from-[#00BCD4]/90 hover:to-[#00BCD4]/70 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      }
                    >
                      {isGeneratingCharacter ? (
                        <>
                          <div className="w-5 h-5 border-2 border-[#00BCD4] border-t-transparent rounded-full animate-spin"></div>
                          <span>
                            Đang tạo {Math.round(characterGenProgress)}%...
                          </span>
                        </>
                      ) : (
                        <>
                          <Icon name="brush" className="text-[18px]" />
                          Tạo nhân vật
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Character Sync Options */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-sm flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      AI Engine
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-[#00BCD4] rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={characterModel}
                        onChange={(e) => setCharacterModel(e.target.value)}
                      >
                        {GEMINI_MODELS.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
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
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-[#00BCD4] rounded-lg p-2.5 text-sm font-bold text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={characterResolution}
                        onChange={(e) => setCharacterResolution(e.target.value)}
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

                <div className="grid grid-cols-1 gap-4 pt-4 border-t border-outline-variant/20">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">
                      Tỷ lệ khung hình
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low/50 border border-outline-variant/20 focus:border-primary rounded-lg p-2.5 text-sm text-on-surface appearance-none outline-none cursor-pointer pr-10 text-ellipsis overflow-hidden whitespace-nowrap"
                        value={characterAspectRatio}
                        onChange={(e) =>
                          setCharacterAspectRatio(e.target.value)
                        }
                      >
                        <option value="Tự động">Tự động</option>
                        <option value="1:1">1:1 (Vuông)</option>
                        <option value="16:9">16:9 (Ngang)</option>
                        <option value="9:16">9:16 (Dọc)</option>
                        <option value="4:3">4:3 (Ngang)</option>
                        <option value="3:4">3:4 (Dọc)</option>
                      </select>
                      <Icon
                        name="keyboard_arrow_down"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sync Button */}
              <button
                onClick={handleSyncCharacter}
                disabled={
                  isSyncingCharacter ||
                  characterContextImages.length === 0 ||
                  (characterProvideType === "upload"
                    ? !characterImage
                    : !characterPrompt)
                }
                className={
                  isSyncingCharacter
                    ? "w-full py-4 bg-primary/10 text-primary font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-not-allowed shadow-none"
                    : "w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                }
              >
                {isSyncingCharacter ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Đang đồng bộ {Math.round(syncProgress)}%...</span>
                  </>
                ) : (
                  <>
                    <Icon name="auto_awesome" className="text-lg" />
                    Bắt Đầu Đồng Bộ
                  </>
                )}
              </button>
            </div>

            {/* Right Column */}
            <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-sm flex flex-col min-h-[550px]">
              <h3 className="text-base font-bold text-on-surface mb-4">
                3. Kết Quả
              </h3>
              <div className="flex-1 bg-surface-container-low rounded-xl flex flex-col items-center justify-center text-center p-4 overflow-y-auto">
                {isSyncingCharacter ? (
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="relative w-24 h-24 flex items-center justify-center">
                      <svg
                        className="w-full h-full transform -rotate-90 animate-spin"
                        viewBox="0 0 80 80"
                      >
                        <circle
                          cx="40"
                          cy="40"
                          r="30"
                          className="stroke-outline-variant/20"
                          strokeWidth="6"
                          fill="transparent"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="30"
                          className="stroke-primary transition-all duration-300 ease-out"
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 30}
                          strokeDashoffset={
                            2 * Math.PI * 30 -
                            (syncProgress / 100) * (2 * Math.PI * 30)
                          }
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-primary">
                          {Math.round(syncProgress)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-on-surface">
                      Đang xử lý đồng bộ...
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Quá trình này có thể mất vài phút.
                    </p>
                  </div>
                ) : syncResults.length > 0 ? (
                  <div
                    className={`w-full h-full ${syncResults.length === 1 ? "flex items-center justify-center p-2" : "grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-max content-start"}`}
                  >
                    {syncResults.map((url, idx) => (
                      <div
                        key={idx}
                        className={`relative rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm group bg-surface-container-lowest flex items-center justify-center ${syncResults.length === 1 ? "w-full h-full max-h-[800px] border-none shadow-none bg-transparent" : ""}`}
                      >
                        <img
                          src={url}
                          alt={`Sync Result ${idx}`}
                          className={`w-full object-contain cursor-zoom-in ${syncResults.length === 1 ? "h-full max-h-[800px]" : "h-auto max-h-[400px]"}`}
                          referrerPolicy="no-referrer"
                          onClick={() => setPreviewImageUrl(url)}
                        />

                        {/* Action Buttons Overlay */}
                        <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              localStorage.setItem(
                                "iGen_editReferenceImage",
                                url,
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
                            onClick={(e) => {
                              e.stopPropagation();
                              localStorage.setItem("iGen_upscaleImage", url);
                              setActiveSubTab("Upscale HD");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                            title="Upscale HD"
                          >
                            <Icon name="high_quality" className="text-[18px]" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImageUrl(url);
                            }}
                            className="w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                            title="Phóng to"
                          >
                            <Icon name="zoom_in" className="text-[18px]" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDownloadImage(
                                url,
                                `sync_result_${idx}_${Date.now()}.png`,
                              );
                            }}
                            className="w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                            title="Tải xuống"
                          >
                            <Icon name="download" className="text-[18px]" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteSyncResult(url);
                            }}
                            className="w-8 h-8 bg-[#EF5350] hover:bg-[#EF5350]/90 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                            title="Xóa ảnh"
                          >
                            <Icon name="delete" className="text-[18px]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <Icon
                      name="person_search"
                      className="text-4xl text-on-surface-variant/30 mb-4"
                    />
                    <p className="text-sm text-on-surface-variant">
                      Kết quả đồng bộ sẽ xuất hiện ở đây.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Row: Lịch Sử Đồng Bộ */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-sm min-h-[200px] flex flex-col mt-8">
          <h3 className="text-base font-bold text-on-surface mb-4">
            Lịch Sử Đồng Bộ
          </h3>
          {renderJobs.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {renderJobs.slice(0, 20).map((job) => (
                <div
                  key={job.id}
                  className="relative group aspect-square rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/20"
                >
                  {job.outputImageUrls?.[0] ? (
                    <img
                      src={job.outputImageUrls[0]}
                      alt="Sync Result"
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                      onClick={() => setPreviewImageUrl(job.outputImageUrls[0])}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-xs text-white line-clamp-2">
                      {job.settings?.suggestionText ||
                        job.settings?.prompt ||
                        "Đồng bộ công trình"}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-white/70">
                        {(() => {
                          if (!job.createdAt) return "";
                          if (typeof job.createdAt === 'string') return new Date(job.createdAt).toLocaleDateString();
                          if (typeof job.createdAt === 'object' && typeof job.createdAt.toMillis === 'function') {
                            return new Date(job.createdAt.toMillis()).toLocaleDateString();
                          }
                          return "";
                        })()}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (job.outputImageUrls?.[0]) {
                              handleDownloadImage(
                                job.outputImageUrls[0],
                                `sync_result_${Date.now()}.png`,
                              );
                            }
                          }}
                          className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors"
                          title="Tải xuống"
                        >
                          <Icon name="download" className="text-xs" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setJobToDelete(job);
                          }}
                          className="w-6 h-6 rounded-full bg-[#EF5350]/20 text-[#EF5350] flex items-center justify-center hover:bg-[#EF5350] hover:text-white transition-colors"
                          title="Xóa"
                        >
                          <Icon name="delete" className="text-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-surface-container-low rounded-xl">
              <p className="text-sm text-on-surface-variant">
                Chưa có lịch sử đồng bộ.
              </p>
            </div>
          )}
        </div>
      </div>

      <ImageLibraryModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        target={libraryTarget}
        onSelectImages={(urls) => {
          if (urls.length > 0) {
            if (activeSubTab === "Đồng Bộ Công Trình") {
              setInputImage(urls[0]);
            } else {
              if (libraryTarget === "character") {
                setCharacterImage(urls[0]);
                setCharacterProvideType("upload");
              } else if (libraryTarget === "context") {
                setCharacterContextImages((prev) => [
                  ...prev,
                  ...urls.map((url) => ({ url, prompt: "" })),
                ]);
              }
            }
          }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-xl font-bold text-on-surface mb-2">
              Xác nhận xóa
            </h3>
            <p className="text-on-surface-variant mb-6">
              Bạn có chắc chắn muốn xóa ảnh này? Hành động này không thể hoàn
              tác.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setJobToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  try {
                    if (
                      jobToDelete.outputImageUrls &&
                      jobToDelete.outputImageUrls.length > 0
                    ) {
                      for (const url of jobToDelete.outputImageUrls) {
                        if (url.includes("cloudinary.com")) {
                          try {
                            await apiClient.delete("/api/v1/media", {
                              body: { publicId: url }
                            });
                          } catch (error) {
                            console.error("Error deleting image from Cloudinary:", error);
                          }
                        }
                      }
                    }
                    try {
                      await apiClient.delete(`/api/v1/render-jobs/${jobToDelete._id || jobToDelete.id}`);
                    } catch (error) {
                      console.error("Error deleting job:", error);
                    }
                    setJobToDelete(null);
                  } catch (error) {
                    console.error("Error deleting job:", error);
                  }
                }}
                className="px-4 py-2 text-sm font-medium bg-[#EF5350] text-white hover:bg-[#EF5350]/90 rounded-lg transition-colors"
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


