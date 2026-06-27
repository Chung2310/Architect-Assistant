import mongoose from "mongoose";

async function run() {
  await mongoose.connect("mongodb://localhost/igen-architect");
  const job = await mongoose.connection.db.collection("renderjobs").findOne({ type: "Floorplan to 3D" }, { sort: { createdAt: -1 } });
  console.log("LATEST FLOORPLAN JOB MODEL:", job?.model);
  console.log("LATEST FLOORPLAN JOB PROMPT:");
  console.log(job?.prompt);
  await mongoose.disconnect();
}
run();
