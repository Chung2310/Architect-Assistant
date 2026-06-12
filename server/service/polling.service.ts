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
      const taskId = job.piapiTaskId;
      if (!taskId) continue;

      try {
        const taskStatus = await piapiService.getTaskStatus(taskId);
        console.log(`[Polling Service] Polled Job ${job._id} (PiAPI Task: ${taskId}) -> Status: ${taskStatus.status}`);

        if (taskStatus.status === "completed" && taskStatus.outputUrl) {
          console.log(`[Polling Service] Task ${taskId} completed. Uploading image to Cloudinary...`);
          
          let finalUrl = taskStatus.outputUrl;
          try {
            finalUrl = await cloudinaryService.uploadMedia(taskStatus.outputUrl, "renders");
            console.log(`[Polling Service] Uploaded to Cloudinary: ${finalUrl}`);
          } catch (uploadErr) {
            console.error(`[Polling Service] Cloudinary upload failed for task ${taskId}:`, uploadErr);
          }

          job.status = "completed";
          job.progress = 100;
          job.outputImageUrls = [finalUrl];
          await job.save();

          emitToUser(job.userId.toString(), "renderJobUpdated", job);
          console.log(`[Polling Service] Job ${job._id} marked as completed.`);
        } else if (taskStatus.status === "failed") {
          console.error(`[Polling Service] Task ${taskId} failed:`, taskStatus.error);
          
          job.status = "failed";
          job.progress = 100;
          await job.save();

          emitToUser(job.userId.toString(), "renderJobUpdated", job);
          console.log(`[Polling Service] Job ${job._id} marked as failed.`);
        } else if (taskStatus.status === "processing" && taskStatus.progress !== undefined) {
          const newProgress = Math.max(job.progress || 0, taskStatus.progress);
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
