import { RenderJobModel } from "../model/render-job.model";
import { piapiService } from "./piapi.service";
import { cloudinaryService } from "./cloudinary.service";
import { emitToUser } from "../socket";

export const pollingService = {
  /**
   * Khởi chạy Polling Worker quét các jobs đang xử lý định kỳ mỗi 15 giây
   */
  init() {
    console.log("[Polling Service] Initializing PiAPI background polling worker...");
    setInterval(async () => {
      try {
        await this.pollActiveJobs();
      } catch (err) {
        console.error("[Polling Service] Error in pollActiveJobs loop:", err);
      }
    }, 15000);
  },

  async pollActiveJobs() {
    const activeJobs = await RenderJobModel.find({
      status: "processing",
      piapiTaskId: { $ne: "" }
    });

    if (activeJobs.length === 0) return;

    for (const job of activeJobs) {
      const taskIdStr = job.piapiTaskId;
      if (!taskIdStr) continue;

      const taskIds = taskIdStr.split(",");
      try {
        const results = await Promise.all(
          taskIds.map(async (tid) => {
            try {
              return await piapiService.getTaskStatus(tid);
            } catch (err) {
              console.error(`[Polling Service] Error querying status for task ${tid}:`, err);
              return { status: "failed" as const, progress: 0, error: String(err) };
            }
          })
        );

        const completedResults = results.filter(r => r.status === "completed");
        const failedResults = results.filter(r => r.status === "failed");
        const processingResults = results.filter(r => r.status === "processing" || r.status === "pending");

        console.log(`[Polling Service] Polled Job ${job._id} (${taskIds.length} tasks) -> Completed: ${completedResults.length}, Failed: ${failedResults.length}, Processing: ${processingResults.length}`);

        if (completedResults.length + failedResults.length === taskIds.length) {
          // All tasks are finished
          if (completedResults.length > 0) {
            console.log(`[Polling Service] Tasks completed. Uploading ${completedResults.length} images to Cloudinary...`);
            
            const uploadedUrls: string[] = [];
            for (const res of completedResults) {
              if (res.outputUrls && res.outputUrls.length > 0) {
                for (const url of res.outputUrls) {
                  try {
                    const finalUrl = await cloudinaryService.uploadMedia(url, "renders");
                    uploadedUrls.push(finalUrl);
                    console.log(`[Polling Service] Uploaded to Cloudinary: ${finalUrl}`);
                  } catch (uploadErr) {
                    console.error(`[Polling Service] Cloudinary upload failed:`, uploadErr);
                    uploadedUrls.push(url);
                  }
                }
              } else if (res.outputUrl) {
                try {
                  const finalUrl = await cloudinaryService.uploadMedia(res.outputUrl, "renders");
                  uploadedUrls.push(finalUrl);
                  console.log(`[Polling Service] Uploaded to Cloudinary: ${finalUrl}`);
                } catch (uploadErr) {
                  console.error(`[Polling Service] Cloudinary upload failed:`, uploadErr);
                  uploadedUrls.push(res.outputUrl);
                }
              }
            }

            job.status = "completed";
            job.progress = 100;
            job.outputImageUrls = uploadedUrls;
            await job.save();

            emitToUser(job.userId.toString(), "renderJobUpdated", job);
            console.log(`[Polling Service] Job ${job._id} marked as completed with ${uploadedUrls.length} images.`);
          } else {
            // All tasks failed
            job.status = "failed";
            job.progress = 100;
            await job.save();

            emitToUser(job.userId.toString(), "renderJobUpdated", job);
            console.log(`[Polling Service] Job ${job._id} marked as failed.`);
          }
        } else {
          // Still processing
          const totalProgress = results.reduce((acc, curr) => acc + (curr.progress || (curr.status === "completed" ? 100 : 0)), 0);
          const averageProgress = Math.min(99, Math.round(totalProgress / taskIds.length));
          
          const newProgress = Math.max(job.progress || 0, averageProgress);
          if (newProgress !== job.progress) {
            job.progress = newProgress;
            await job.save();
            emitToUser(job.userId.toString(), "renderJobUpdated", job);
          }
        }
      } catch (jobErr) {
        console.error(`[Polling Service] Error polling job ${job._id}:`, jobErr);
      }
    }
  }
};
