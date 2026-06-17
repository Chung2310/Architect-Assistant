import React, { useState, useEffect, useRef } from "react";
import { Icon } from "../Icon";
import { useAuth } from "../../context/useAuth";
import { apiClient } from "../../services/apiClient";
import { toast } from "sonner";
import { Type } from "@google/genai";
import { convertPdfToImage } from "../../lib/pdfUtils";
import { ImageLibraryModal } from "./ImageLibraryModal";
import { uploadMedia, getAIClient, checkUserCredits, generateContentWithRetry, getImageBase64, cacheImage, scaleToResolution } from "../../lib/renderUtils";

const MODELS = [
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

export const UpscaleTabContent: React.FC = () => {
  const { user } = useAuth();
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    "gemini-3-pro-image-preview",
  );
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleProgress, setUpscaleProgress] = useState(0);
  const [upscaledImage, setUpscaledImage] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isUpscaling) {
      setTimeout(() => setUpscaleProgress(0), 0);
      interval = setInterval(() => {
        setUpscaleProgress((prev) => {
          if (prev < 90) {
            return prev + Math.random() * 5;
          } else if (prev < 99) {
            return prev + Math.random() * 0.5;
          }
          return prev;
        });
      }, 500);
    } else {
      setTimeout(() => setUpscaleProgress(100), 0);
    }
    return () => clearInterval(interval);
  }, [isUpscaling]);

  const [upscaleHistory, setUpscaleHistory] = useState<
    {
      id: string;
      original: string;
      upscaled: string;
      model: string;
      resolution: string;
      timestamp: string;
    }[]
  >(() => {
    const saved = localStorage.getItem("iGen_upscaleHistory");
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
      "iGen_upscaleHistory",
      JSON.stringify(upscaleHistory.slice(0, 20)),
    );
  }, [upscaleHistory]);

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    await processFiles(files);
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

      const processedFiles = processedFilesNested
        .flat()
        .filter((f): f is File => f !== null);

      if (processedFiles.length === 0) {
        setIsUploading(false);
        return;
      }

      const fileToUpload = processedFiles[0];

      setUploadProgress(30);
      const downloadURL = await uploadMedia(fileToUpload, "uploads");
      setUploadProgress(100);
      cacheImage(downloadURL, fileToUpload);
      setInputImage(downloadURL);
      setIsUploading(false);
    } catch (error) {
      console.error("Error processing files:", error);
      setIsUploading(false);
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []) as File[];
    await processFiles(files);
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
      toast.error("Có lỗi xảy ra khi tải ảnh.");
    }
  };

  const handleUpscale = async (resolution: string) => {
    if (!inputImage) {
      toast.error("Vui lòng tải lên ảnh gốc trước khi upscale.");
      return;
    }

    if (!user) {
      toast.error("Vui lòng đăng nhập để upscale.");
      return;
    }

    setIsUpscaling(true);
    setUpscaledImage(null);

    try {
      let base64Data = "";
      let mimeType = "image/jpeg";

      try {
        const imageData = await getImageBase64(inputImage, false);
        mimeType = imageData.mimeType;
        base64Data = imageData.base64Data;
      } catch (error) {
        console.error("Failed to fetch image:", error);
        toast.error("Không thể tải ảnh gốc. Vui lòng thử lại.");
        setIsUpscaling(false);
        return;
      }

      let preciseAspectRatio = "1:1";
      if (typeof window !== "undefined") {
        await new Promise<void>((resolve) => {
          const img = new window.Image();
          img.onload = () => {
            const ratio = img.width / img.height;
            if (ratio > 1.7) preciseAspectRatio = "16:9";
            else if (ratio > 1.2 && ratio <= 1.7) preciseAspectRatio = "4:3";
            else if (ratio >= 0.81 && ratio <= 1.2) preciseAspectRatio = "1:1";
            else if (ratio >= 0.6 && ratio <= 0.8) preciseAspectRatio = "3:4";
            else preciseAspectRatio = "9:16";
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `data:${mimeType};base64,${base64Data}`;
        });
      }

      const promptAi = await getAIClient("gemini-2.5-flash");

      const generationConfigText = {
        temperature: 1.0,
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingLevel: "medium",
        },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            image_content_analysis: {
              type: Type.STRING,
              description:
                "Deeply analyze the low-resolution input image. Identify every visible subject, color, lighting, and layout with 100% accuracy.",
            },
            optimized_upscale_prompt: {
              type: Type.STRING,
              description:
                "The English prompt to reconstruct the image. Must describe the exact content and append 2K high-fidelity enhancement keywords.",
            },
            negative_prompt: {
              type: Type.STRING,
              description:
                "Strict negative prompt avoiding blur, noise, pixelation, and hallucination.",
            },
          },
          required: [
            "image_content_analysis",
            "optimized_upscale_prompt",
            "negative_prompt",
          ],
        },
      };

      const systemInstructionText = `<role>
You are the "iGen Image Enhancer", an elite spatial and visual analyzer. Your objective is to examine a low-resolution, blurry, or pixelated Reference Image and generate a precise reconstruction prompt for \`gemini-3.1-flash-image-preview\` to upscale it to crisp 2K resolution.
</role>

<core_directives>
1. ZERO HALLUCINATION: You MUST describe exactly what is in the blurry image. Do NOT invent new subjects, change the time of day, or alter the structural layout. Your goal is restoration, not alteration.
2. UPSCALE ENHANCEMENT KEYWORDS: After accurately describing the image's content, you MUST append these exact enhancement keywords to the \`optimized_upscale_prompt\`: "ultra-sharp, highly detailed, 2K resolution, crystal clear, noise-free, high-fidelity restoration, crisp edges, masterpiece".
</core_directives>

<content_translation_protocol>
- If the image contains text, logos, or signs that are readable, preserve them exactly in double quotes (e.g., a sign saying "Cà Phê").
- Translate all visual descriptions into professional, descriptive English to maximize the rendering engine's output quality.
</content_translation_protocol>

<negative_prompting_rules>
For the \`negative_prompt\` field, strictly list upscale-related artifacts:
"blurry, pixelated, jpeg artifacts, noise, low resolution, out of focus, structural changes, mutated subjects, hallucinated details, distorted geometry, chromatic aberration".
</negative_prompting_rules>

<fallback_protocol>
If the image is too blurry to identify specific details, describe the general shapes, colors, and lighting composition, and emphasize "ultra-sharp abstract/general enhancement".
</fallback_protocol>`;

      console.log("Analyzing image to generate upscale prompt...");
      const textResponse = await generateContentWithRetry(promptAi, {
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
              {
                text: "Analyze this image and generate the upscaling prompt.",
              },
            ],
          },
        ],
        systemInstruction: systemInstructionText,
        generationConfig: generationConfigText,
      });

      const textResult =
        textResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) {
        throw new Error("Failed to generate prompt from image.");
      }

      let parsedResult;
      try {
        parsedResult = JSON.parse(textResult);
        console.log("Upscale AI Analysis Result:", parsedResult);
      } catch (e) {
        console.error("Parse JSON error", e);
        throw new Error("Invalid output format from AI.", { cause: e });
      }

      const finalPrompt =
        parsedResult.optimized_upscale_prompt ||
        "Upscale this image, extremely high quality, 2K resolution, sharp.";
      const negativePrompt =
        parsedResult.negative_prompt || "blurry, distortion";
      const detectedAspectRatio = preciseAspectRatio;

      const ai = await getAIClient(selectedModel);

      const imageConfig: {
        aspectRatio: string;
        imageSize?: string;
        negativePrompt?: string;
      } = {
        aspectRatio: detectedAspectRatio,
      };

      if (
        selectedModel === "gemini-3.1-flash-image-preview" ||
        selectedModel === "gemini-3-pro-image-preview"
      ) {
        imageConfig.imageSize = resolution;
        imageConfig.negativePrompt = negativePrompt;
      }

      console.log("Generating upscaled image...");
      const response = await generateContentWithRetry(ai, {
        model: selectedModel,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
              {
                text: finalPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          imageConfig:
            Object.keys(imageConfig).length > 0 ? imageConfig : undefined,
        },
      });

      let newImageUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          let base64EncodeString = part?.inlineData?.data;
          let outMimeType = part?.inlineData?.mimeType || "image/png";

          if (resolution === "2K" || resolution === "4K") {
            const scaled = await scaleToResolution(
              base64EncodeString,
              outMimeType,
              resolution,
            );
            base64EncodeString = scaled.base64Data;
            outMimeType = scaled.mimeType;
          }

          const binary = atob(base64EncodeString);
          const array = [];
          for (let k = 0; k < binary.length; k++) {
            array.push(binary.charCodeAt(k));
          }
          const blob = new Blob([new Uint8Array(array)], { type: outMimeType });
          newImageUrl = await uploadMedia(blob, "upscales");
          break;
        }
      }

      if (newImageUrl) {
        setUpscaledImage(newImageUrl);
        setUpscaleHistory((prev) => [
          {
            id: Date.now().toString(),
            original: inputImage,
            upscaled: newImageUrl!,
            model: selectedModel,
            resolution: resolution,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        toast.error("Không thể tạo ảnh upscale. Vui lòng thử lại.");
      }
    } catch (error) {
      console.error("Upscale error:", error);
      toast.error("Có lỗi xảy ra trong quá trình upscale. Vui lòng thử lại.");
    } finally {
      setIsUpscaling(false);
    }
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column */}
        <div className="w-full lg:w-[380px] flex flex-col gap-6 shrink-0">
          {/* Panel 1: Tải Lên Ảnh Gốc */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-on-surface">
                1. Tải Lên Ảnh Gốc
              </h3>
              <button
                onClick={() => setShowLibraryModal(true)}
                className="text-xs font-bold text-[#00BCD4] bg-[#00BCD4]/10 hover:bg-[#00BCD4]/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Icon name="photo_library" className="text-[16px]" />
                Thư viện ảnh
              </button>
            </div>
            <div
              className={`h-48 ${!inputImage ? "border-2 border-dashed cursor-pointer hover:border-primary/50 hover:bg-surface-container-low" : "border border-outline-variant/20"} ${isDragging && !inputImage ? "border-primary bg-primary/10" : !inputImage ? "border-outline-variant/40 bg-surface-container-low/50" : "bg-surface-container-lowest"} rounded-xl flex flex-col items-center justify-center text-center group transition-colors relative overflow-hidden`}
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
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-[#00BCD4] border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-sm font-semibold text-[#00BCD4]">
                    Đang tải lên... {Math.round(uploadProgress)}%
                  </p>
                </div>
              ) : inputImage ? (
                <div className="relative w-full h-full p-2 group">
                  <img
                    src={inputImage}
                    alt="Uploaded"
                    className="w-full h-full object-contain rounded-lg cursor-zoom-in"
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
                    className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Xóa ảnh"
                  >
                    <Icon name="close" className="text-[16px]" />
                  </button>
                </div>
              ) : (
                <>
                  <Icon
                    name="cloud_upload"
                    className="text-4xl text-on-surface-variant/50 mb-4"
                  />
                  <p className="text-sm font-medium text-on-surface mb-1">
                    {isDragging ? "Thả ảnh vào đây" : "Tải Lên Ảnh Cần Upscale"}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Kéo thả hoặc nhấp để tải lên (PNG, JPG, WEBP, PDF)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Panel 2: Chọn Độ Phân Giải */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-on-surface mb-1">
                2. Bắt đầu quá trình
              </h3>
              <p className="text-xs text-on-surface-variant">
                Sử dụng mô hình AI để tăng độ phân giải và chi tiết.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-2">
                  AI Engine
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-white border border-[#00BCD4] rounded-xl px-4 py-3 text-sm font-medium text-on-surface outline-none appearance-none cursor-pointer pr-10"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    {MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="expand_more"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00BCD4] pointer-events-none"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => handleUpscale("2K")}
                  disabled={isUpscaling || !inputImage}
                  className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Icon name="aspect_ratio" className="text-lg" />
                  Upscale lên 2K
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-sm flex flex-col min-h-[500px]">
          <h3 className="text-base font-bold text-on-surface mb-4">
            3. Kết Quả Upscale
          </h3>
          <div className="flex-1 bg-surface-container-low rounded-xl flex flex-col items-center justify-center text-center p-8 relative overflow-hidden">
            {isUpscaling ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-medium text-primary">
                  Đang xử lý Upscale... {Math.round(upscaleProgress)}%
                </p>
                <p className="text-xs text-on-surface-variant mt-2">
                  Quá trình này có thể mất vài phút.
                </p>
              </div>
            ) : upscaledImage ? (
              <div className="relative w-full h-full group">
                <img
                  src={upscaledImage}
                  alt="Upscaled Result"
                  className="w-full h-full object-contain rounded-lg cursor-zoom-in"
                  referrerPolicy="no-referrer"
                  onClick={() => setPreviewImageUrl(upscaledImage)}
                />

                {/* Action Buttons Overlay */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      localStorage.setItem(
                        "iGen_editReferenceImage",
                        upscaledImage,
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
                      setInputImage(upscaledImage);
                      toast.success("Đã thêm ảnh vào mục tải lên ảnh gốc!");
                    }}
                    className="w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                    title="Đổi góc chụp"
                  >
                    <Icon name="360" className="text-[18px]" />
                  </button>
                  <button
                    onClick={() => setPreviewImageUrl(upscaledImage)}
                    className="w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                    title="Phóng to"
                  >
                    <Icon name="zoom_in" className="text-[18px]" />
                  </button>
                  <button
                    onClick={() =>
                      handleDownloadImage(
                        upscaledImage,
                        `upscaled_${Date.now()}.png`,
                      )
                    }
                    className="w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                    title="Tải xuống"
                  >
                    <Icon name="download" className="text-[18px]" />
                  </button>
                  <button
                    onClick={() => setUpscaledImage(null)}
                    className="w-8 h-8 bg-red-500/80 hover:bg-red-600 backdrop-blur-md rounded-lg text-white flex items-center justify-center transition-colors shadow-lg"
                    title="Xóa"
                  >
                    <Icon name="delete" className="text-[18px]" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Icon
                  name="zoom_out_map"
                  className="text-4xl text-on-surface-variant/30 mb-4"
                />
                <p className="text-sm text-on-surface-variant">
                  Kết quả upscale sẽ xuất hiện ở đây.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Lịch Sử Upscale */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-sm min-h-[200px] flex flex-col">
        <h3 className="text-base font-bold text-on-surface mb-4">
          Lịch Sử Upscale
        </h3>
        {upscaleHistory.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {upscaleHistory.slice(0, 20).map((item) => (
              <div
                key={item.id}
                className="w-48 shrink-0 bg-surface-container-low rounded-xl p-3 border border-outline-variant/20"
              >
                <div
                  className="aspect-video bg-black/5 rounded-lg mb-3 overflow-hidden cursor-zoom-in"
                  onClick={() => setUpscaledImage(item.upscaled)}
                >
                  <img
                    src={item.upscaled}
                    alt="History"
                    className="w-full h-full object-contain hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-medium text-on-surface">
                    {item.resolution}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-on-surface-variant">
              Chưa có lịch sử Upscale.
            </p>
          </div>
        )}
      </div>

      <ImageLibraryModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        onSelectImages={(urls) => {
          if (urls.length > 0) {
            setInputImage(urls[0]);
          }
          setShowLibraryModal(false);
        }}
      />

      {/* Preview Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-10"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="absolute top-6 right-6 flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadImage(
                  previewImageUrl,
                  `upscaled_${Date.now()}.png`,
                );
              }}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all"
              title="Tải xuống"
            >
              <Icon name="download" className="text-2xl" />
            </button>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all"
              title="Đóng"
            >
              <Icon name="close" className="text-2xl" />
            </button>
          </div>
          <img
            src={previewImageUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
