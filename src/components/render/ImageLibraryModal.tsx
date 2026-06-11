import React, { useState, useEffect } from "react";
import { apiClient, ApiResponse } from "../../services/apiClient";
import { Icon } from "../Icon";
import { handleDownload } from "../../lib/renderUtils";

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImages: (imageUrls: string[]) => void;
  target?: "input" | "context" | "character" | "reference";
}

interface MediaItem {
  url: string;
  type: "user_image" | "ai_image" | "user_video" | "ai_video";
  timestamp: number;
}

interface RenderJob {
  createdAt: string | number | Date;
  outputImageUrls?: string[];
  inputImageUrls?: string[];
  referenceImageUrls?: string[];
}

export const ImageLibraryModal: React.FC<ImageLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectImages,
  target,
}) => {
  const [images, setImages] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<
    "all" | "user_image" | "ai_image" | "user_video" | "ai_video"
  >("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setSelectedImages([]);
        setPreviewImage(null);
        setShowDeleteConfirm(false);
        setBrokenUrls(new Set());
      }, 0);
    }
  }, [isOpen]);

  const handleSelectAndRecord = (selectedList: string[]) => {
    try {
      const stored = localStorage.getItem("recently_used_media") || "{}";
      const usedMap = JSON.parse(stored);
      const now = Date.now();
      selectedList.forEach((url) => {
        usedMap[url] = now;
      });
      localStorage.setItem("recently_used_media", JSON.stringify(usedMap));
    } catch (e) {
      console.error("Error setting recently used media:", e);
    }
    onSelectImages(selectedList);
  };

  useEffect(() => {
    if (!isOpen) return;

    setTimeout(() => {
      setIsLoading(true);
    }, 0);

    const fetchMedia = async () => {
      try {
        const res = await apiClient.get<ApiResponse<RenderJob[]>>("/api/v1/render-jobs?limit=200");
        if (res.success && Array.isArray(res.data)) {
          const fetched: MediaItem[] = [];
          const isVideo = (url: string) => /\.(mp4|webm|mov)/i.test(url);

          res.data.forEach((job: RenderJob) => {
            const timestamp = new Date(job.createdAt).getTime();
            
            if (job.outputImageUrls && job.outputImageUrls.length > 0) {
              job.outputImageUrls.forEach((url: string) => {
                if (url) {
                  fetched.push({
                    url,
                    type: isVideo(url) ? "ai_video" : "ai_image",
                    timestamp,
                  });
                }
              });
            }
            if (job.inputImageUrls && job.inputImageUrls.length > 0) {
              job.inputImageUrls.forEach((url: string) => {
                if (url) {
                  fetched.push({
                    url,
                    type: isVideo(url) ? "user_video" : "user_image",
                    timestamp,
                  });
                }
              });
            }
            if (job.referenceImageUrls && job.referenceImageUrls.length > 0) {
              job.referenceImageUrls.forEach((url: string) => {
                if (url) {
                  fetched.push({
                    url,
                    type: isVideo(url) ? "user_video" : "user_image",
                    timestamp,
                  });
                }
              });
            }
          });

          // Unique media items by URL
          const uniqueMedia = Array.from(
            new Map(fetched.map((item) => [item.url, item])).values(),
          );

          let recentlyUsed: Record<string, number> = {};
          try {
            const stored = localStorage.getItem("recently_used_media");
            if (stored) {
              recentlyUsed = JSON.parse(stored);
            }
          } catch (e) {
            console.error("Error parsing recently used media:", e);
          }

          uniqueMedia.sort((a, b) => {
            const timeA = Math.max(a.timestamp, recentlyUsed[a.url] || 0);
            const timeB = Math.max(b.timestamp, recentlyUsed[b.url] || 0);
            return timeB - timeA;
          });

          setImages(uniqueMedia);
        }
      } catch (error) {
        console.error("Error loading library media:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMedia();
  }, [isOpen, target]);

  const toggleSelection = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImages((prev) =>
      prev.includes(url) ? prev.filter((i) => i !== url) : [...prev, url],
    );
  };

  const handleDeleteImages = async () => {
    if (selectedImages.length === 0) return;

    setIsDeleting(true);
    try {
      for (const url of selectedImages) {
        try {
          await apiClient.delete("/api/v1/media", {
            body: { publicId: url }
          });
        } catch (error) {
          console.error("Error deleting image from media library:", error);
        }
      }

      setImages((prev) =>
        prev.filter((img) => !selectedImages.includes(img.url)),
      );
      setSelectedImages([]);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error in delete process:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest w-full max-w-5xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 relative">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <Icon name="photo_library" className="text-primary" />
            Thư viện media của bạn
          </h2>
          <div className="flex items-center gap-3">
            {selectedImages.length > 0 && (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-sm font-medium text-error hover:bg-error/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Icon name="delete" className="text-[18px]" />
                  Xoá đã chọn ({selectedImages.length})
                </button>
                <button
                  onClick={() => setSelectedImages([])}
                  className="text-sm font-medium text-on-surface-variant hover:text-on-surface px-3 py-1.5 rounded-lg hover:bg-surface-container-low transition-colors"
                >
                  Bỏ chọn tất cả
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-lowest">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === "all" ? "bg-primary text-white" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilter("user_image")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === "user_image" ? "bg-primary text-white" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
            >
              Ảnh tải lên
            </button>
            <button
              onClick={() => setFilter("ai_image")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === "ai_image" ? "bg-primary text-white" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
            >
              Ảnh AI tạo
            </button>
            <button
              onClick={() => setFilter("user_video")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === "user_video" ? "bg-primary text-white" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
            >
              Video tải lên
            </button>
            <button
              onClick={() => setFilter("ai_video")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === "ai_video" ? "bg-primary text-white" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
            >
              Video AI tạo
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-primary">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-medium">Đang tải thư viện...</p>
            </div>
          ) : (() => {
            const itemsToShow = images
              .filter((item) => filter === "all" || item.type === filter)
              .filter((item) => !brokenUrls.has(item.url));

            if (itemsToShow.length === 0) {
              return (
                <div className="h-full flex flex-col items-center justify-center text-on-surface-variant/50">
                  <Icon name="image_not_supported" className="text-6xl mb-4" />
                  <p className="font-medium">Chưa có media nào trong mục này.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                {itemsToShow.map((item, index) => {
                  const isSelected = selectedImages.includes(item.url);
                  const isVideo =
                    item.type === "user_video" || item.type === "ai_video";
                  return (
                    <div
                      key={index}
                      className={`relative aspect-square rounded-xl overflow-hidden group cursor-pointer border-2 transition-all shadow-sm ${isSelected ? "border-primary scale-[0.98]" : "border-outline-variant/20 hover:border-primary/50"}`}
                      onClick={() => setPreviewImage(item.url)}
                    >
                      {isVideo ? (
                        <video
                          src={item.url}
                          className="w-full h-full object-cover"
                          onError={() => {
                            setBrokenUrls((prev) => {
                              const next = new Set(prev);
                              next.add(item.url);
                              return next;
                            });
                          }}
                        />
                      ) : (
                        <img
                          src={item.url}
                          alt={`Library item ${index}`}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                          onError={() => {
                            setBrokenUrls((prev) => {
                              const next = new Set(prev);
                              next.add(item.url);
                              return next;
                            });
                          }}
                        />
                      )}

                      {isVideo && (
                        <div className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-md z-10">
                          <Icon name="play_circle" className="text-[16px]" />
                        </div>
                      )}

                      <div
                        className={`absolute top-3 left-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-10 ${isSelected ? "bg-primary border-primary text-white" : "border-white/80 bg-black/20 text-transparent group-hover:border-white"}`}
                        onClick={(e) => toggleSelection(item.url, e)}
                      >
                        <Icon name="check" className="text-[14px]" />
                      </div>

                      <div
                        className={`absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none ${isSelected ? "opacity-0" : ""}`}
                      >
                        <div className="bg-white/90 text-on-surface font-semibold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 text-sm transform translate-y-2 group-hover:translate-y-0 transition-all">
                          <Icon name="zoom_in" className="text-[16px]" /> Xem trước
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {selectedImages.length > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-outline-variant/30 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-center gap-3 md:gap-6 animate-in slide-in-from-bottom-8 w-max max-w-[90vw] z-20">
            <span className="font-bold text-on-surface whitespace-nowrap text-sm md:text-base">
              Đã chọn {selectedImages.length} ảnh
            </span>
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => handleDownload(selectedImages)}
                className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold transition-colors whitespace-nowrap text-xs md:text-sm"
              >
                <Icon name="download" className="text-[16px] md:text-[18px]" />
                Tải xuống
              </button>
              <button
                onClick={() => {
                  handleSelectAndRecord(selectedImages);
                  onClose();
                }}
                className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap text-xs md:text-sm"
              >
                <Icon
                  name="check_circle"
                  className="text-[16px] md:text-[18px]"
                />
                Sử dụng ảnh đã chọn
              </button>
            </div>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-outline-variant/20 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-error mb-4">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                <Icon name="warning" className="text-2xl" />
              </div>
              <h3 className="text-lg font-bold">Xác nhận xóa</h3>
            </div>
            <p className="text-on-surface-variant text-sm mb-6">
              Bạn có chắc chắn muốn xóa {selectedImages.length} ảnh đã chọn khỏi thư viện không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors disabled:opacity-50"
                disabled={isDeleting}
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteImages}
                className="px-4 py-2 text-sm font-bold bg-error text-white hover:bg-error/90 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Đang xóa...
                  </>
                ) : (
                  "Xóa vĩnh viễn"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          >
            <Icon name="close" className="text-2xl" />
          </button>

          <div className="absolute top-6 left-6 flex gap-3 z-10">
            <button
              onClick={() => handleDownload([previewImage])}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors backdrop-blur-sm"
            >
              <Icon name="download" /> Tải xuống
            </button>
            <button
              onClick={() => {
                setSelectedImages([previewImage]);
                setShowDeleteConfirm(true);
                setPreviewImage(null);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors backdrop-blur-sm shadow-lg"
            >
              <Icon name="delete" /> Xóa
            </button>
            <button
              onClick={() => {
                handleSelectAndRecord([previewImage]);
                setPreviewImage(null);
                onClose();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold transition-colors shadow-lg"
            >
              <Icon name="check" /> Sử dụng ảnh này
            </button>
          </div>

          <img
            src={previewImage}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
};
