type RenderJobIdentity = {
  _id?: string;
  id?: string;
};

type RenderJobSelection = RenderJobIdentity & {
  status?: string;
  outputImageUrls?: string[];
};

const getJobId = (job: RenderJobIdentity) => job._id || job.id || "";

export function upsertRenderJob<T extends RenderJobIdentity>(
  jobs: T[],
  updatedJob: T,
): T[] {
  const updatedId = getJobId(updatedJob);
  if (!updatedId) return jobs;

  const existingIndex = jobs.findIndex((job) => getJobId(job) === updatedId);
  if (existingIndex === -1) return [updatedJob, ...jobs];

  return jobs.map((job, index) => (index === existingIndex ? updatedJob : job));
}

export function getInitialRenderResultId(job: RenderJobSelection): string | null {
  const jobId = getJobId(job);
  if (!jobId) return null;

  if (job.status === "completed" && job.outputImageUrls?.length) {
    return `completed-${jobId}-0`;
  }
  if (job.status === "pending" || job.status === "processing") {
    return `pending-${jobId}`;
  }
  return `error-${jobId}`;
}
