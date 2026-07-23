import assert from "node:assert/strict";
import {
  getInitialRenderResultId,
  upsertRenderJob,
} from "../src/components/render/renderResultState";

const existing = [
  { _id: "job-1", status: "processing", progress: 20, outputImageUrls: [] },
];

const inserted = upsertRenderJob(existing, {
  _id: "job-2",
  status: "completed",
  progress: 100,
  outputImageUrls: ["https://example.com/output.jpg"],
});
assert.equal(inserted.length, 2);
assert.equal(inserted[0]._id, "job-2");

const updated = upsertRenderJob(inserted, {
  _id: "job-1",
  status: "completed",
  progress: 100,
  outputImageUrls: ["https://example.com/job-1.jpg"],
});
assert.equal(updated.length, 2);
assert.equal(updated.find((job) => job._id === "job-1")?.status, "completed");

assert.equal(getInitialRenderResultId(updated[0]), "completed-job-2-0");
assert.equal(
  getInitialRenderResultId({ id: "job-3", status: "processing", outputImageUrls: [] }),
  "pending-job-3",
);
assert.equal(
  getInitialRenderResultId({ id: "job-4", status: "failed", outputImageUrls: [] }),
  "error-job-4",
);
assert.equal(getInitialRenderResultId({ status: "completed" }), null);
