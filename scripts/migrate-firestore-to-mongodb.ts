import admin from "firebase-admin";
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

// Import Models
import { UserModel } from "../server/model/user.model";
import { RenderJobModel } from "../server/model/render-job.model";
import { TransactionModel } from "../server/model/transaction.model";

async function run() {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json";
  const saResolved = path.resolve(saPath);

  if (!fs.existsSync(saResolved)) {
    console.error(`[Migration] Tệp Service Account không tồn tại tại: ${saResolved}`);
    console.error("Vui lòng tải tệp Service Account JSON từ Firebase Console và đặt đường dẫn trong .env làm FIREBASE_SERVICE_ACCOUNT_PATH.");
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(saResolved, "utf8"));
  
  // Đọc databaseId từ firebase-applet-config.json nếu có
  let databaseId = "(default)";
  try {
    const appletConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
    if (appletConfig.firestoreDatabaseId) {
      databaseId = appletConfig.firestoreDatabaseId;
    }
  } catch (err) {
    // Bỏ qua
  }

  console.log(`[Migration] Đang kết nối Firebase Admin... Project: ${serviceAccount.project_id}`);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const firestore = admin.firestore();
  
  console.log("[Migration] Đang kết nối MongoDB...");
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/igen-architect";
  await mongoose.connect(mongoUri);
  console.log("[Migration] Kết nối MongoDB thành công.");

  // 1. Migrate Users
  console.log("[Migration] Đang migrate collection 'users'...");
  const usersSnapshot = await firestore.collection("users").get();
  console.log(`[Migration] Tìm thấy ${usersSnapshot.size} tài khoản trên Firestore.`);
  let userCount = 0;
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const email = data.email?.toLowerCase().trim();
    if (!email) continue;

    const exists = await UserModel.findOne({ email });
    if (!exists) {
      // Vì không thể truy xuất mật khẩu dạng plain-text từ Firebase Auth sang Firestore,
      // ta tạo mật khẩu mặc định là 'User@123456' ($2a$10$T8l6fX5/cWzN.aA/vIUpd.6aC7U6s0.D2aX7K5iYpWkH4r8eD8Z1O)
      await new UserModel({
        email,
        password: data.password || "$2a$10$T8l6fX5/cWzN.aA/vIUpd.6aC7U6s0.D2aX7K5iYpWkH4r8eD8Z1O",
        displayName: data.displayName || "",
        role: data.role || "user",
        apiKey: data.apiKey || "",
        credits: typeof data.credits === "number" ? data.credits : 10,
        hasSetupApiKey: !!data.apiKey,
        createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt.seconds * 1000) : new Date(),
      }).save();
      userCount++;
    }
  }
  console.log(`[Migration] Hoàn tất migrate users. Đã thêm mới ${userCount} users.`);

  // 2. Migrate Render Jobs
  console.log("[Migration] Đang migrate collection 'renderJobs'...");
  const jobsSnapshot = await firestore.collection("renderJobs").get();
  console.log(`[Migration] Tìm thấy ${jobsSnapshot.size} render jobs trên Firestore.`);
  let jobCount = 0;
  for (const doc of jobsSnapshot.docs) {
    const data = doc.data();
    
    // Tìm user tương ứng bằng email hoặc userId
    let userMongoId: mongoose.Types.ObjectId | null = null;
    if (data.email) {
      const u = await UserModel.findOne({ email: data.email.toLowerCase().trim() });
      if (u) userMongoId = u._id as mongoose.Types.ObjectId;
    }
    
    if (!userMongoId && data.userId) {
      // Tìm bằng matching display name hoặc email khác
      const u = await UserModel.findOne({ displayName: data.displayName });
      if (u) userMongoId = u._id as mongoose.Types.ObjectId;
    }

    if (userMongoId) {
      await new RenderJobModel({
        userId: userMongoId,
        type: data.type || "render",
        subType: data.subType || "",
        inputImageUrls: data.inputImageUrls || [],
        referenceImageUrls: data.referenceImageUrls || [],
        outputImageUrls: data.outputImageUrls || [],
        status: data.status || "completed",
        progress: typeof data.progress === "number" ? data.progress : 100,
        prompt: data.prompt || "",
        model: data.model || "",
        resolution: data.resolution || "1K",
        createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
      }).save();
      jobCount++;
    }
  }
  console.log(`[Migration] Hoàn tất migrate renderJobs. Đã thêm mới ${jobCount} jobs.`);

  // 3. Migrate Transactions
  console.log("[Migration] Đang migrate collection 'transactions'...");
  const txSnapshot = await firestore.collection("transactions").get();
  console.log(`[Migration] Tìm thấy ${txSnapshot.size} giao dịch trên Firestore.`);
  let txCount = 0;
  for (const doc of txSnapshot.docs) {
    const data = doc.data();
    
    let userMongoId: mongoose.Types.ObjectId | null = null;
    if (data.email) {
      const u = await UserModel.findOne({ email: data.email.toLowerCase().trim() });
      if (u) userMongoId = u._id as mongoose.Types.ObjectId;
    }

    if (userMongoId) {
      await new TransactionModel({
        userId: userMongoId,
        amount: typeof data.amount === "number" ? data.amount : 0,
        type: data.type || "add",
        model: data.model || "gemini",
        timestamp: data.timestamp ? new Date(data.timestamp.seconds * 1000) : new Date(),
      }).save();
      txCount++;
    }
  }
  console.log(`[Migration] Hoàn tất migrate transactions. Đã thêm mới ${txCount} giao dịch.`);

  console.log("[Migration] Đã đồng bộ toàn bộ dữ liệu từ Firestore sang MongoDB thành công!");
  process.exit(0);
}

run().catch((error) => {
  console.error("[Migration] Lỗi khi chạy migration script:", error);
  process.exit(1);
});
