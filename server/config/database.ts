import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";

async function seedSuperAdmin() {
  try {
    const saEmail = (process.env.SUPERADMIN_EMAIL || "admin@igen-architect.com").toLowerCase().trim();
    const saPassword = process.env.SUPERADMIN_PASSWORD || "Admin@123456";
    const saName = process.env.SUPERADMIN_NAME || "Super Admin";

    const existingSA = await UserModel.findOne({ role: { $in: ["superadmin", "admin"] } });
    if (existingSA) {
      console.log("[Database] Admin đã tồn tại.");
      return;
    }

    const hashedPassword = await bcrypt.hash(saPassword, 10);
    await new UserModel({
      email: saEmail,
      password: hashedPassword,
      displayName: saName,
      role: "superadmin",
      credits: 9999,
      hasSetupApiKey: true,
    }).save();
    console.log(`[Database] Khởi tạo Super Admin thành công: ${saEmail}`);
  } catch (error) {
    console.error("[Database] Lỗi khi seed admin:", error);
  }
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/igen-architect";
  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";

  let connectionUri = uri;
  if (user && pass) {
    const protocol = uri.startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://";
    const uriWithoutProtocol = uri.replace(protocol, "");
    if (!uriWithoutProtocol.includes("@")) {
      connectionUri = `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${uriWithoutProtocol}`;
    }
    if (authSource && !connectionUri.includes("authSource=")) {
      const separator = connectionUri.includes("?") ? "&" : "?";
      connectionUri = `${connectionUri}${separator}authSource=${authSource}`;
    }
  }

  const redactedUri = connectionUri.replace(/:([^:@]+)@/, ":******@");
  console.log(`[Database] Đang kết nối MongoDB: ${redactedUri}`);

  try {
    await mongoose.connect(connectionUri);
    console.log("[Database] Kết nối MongoDB thành công.");
    await seedSuperAdmin();
  } catch (error) {
    console.error("[Database] Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
}
