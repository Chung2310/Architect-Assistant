import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";
import { logger } from "../utils/logger";

async function seedSuperAdmin() {
  try {
    const saEmail = (process.env.SUPERADMIN_EMAIL || "admin@igen-architect.com").toLowerCase().trim();
    const saPassword = process.env.SUPERADMIN_PASSWORD || "Admin@123456";
    const saName = process.env.SUPERADMIN_NAME || "Super Admin";

    const existingSA = await UserModel.findOne({ role: { $in: ["superadmin", "admin"] } });
    if (existingSA) {
      logger.info("[Database] Admin đã tồn tại.");
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
    logger.info(`[Database] Khởi tạo Super Admin thành công: ${saEmail}`);
  } catch (error) {
    logger.error(`[Database] Lỗi khi seed admin: ${error}`);
  }
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/igen-architect";
  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";

  let connectionUri = uri;
  
  // Rewrite Docker host 'mongodb' to 'localhost' for local execution
  if (connectionUri.includes("://mongodb/")) {
    connectionUri = connectionUri.replace("://mongodb/", "://localhost/");
  } else if (connectionUri.includes("://mongodb:")) {
    connectionUri = connectionUri.replace("://mongodb:", "://localhost:");
  } else if (connectionUri === "mongodb://mongodb") {
    connectionUri = "mongodb://localhost";
  }

  if (user && pass) {
    const protocol = connectionUri.startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://";
    const uriWithoutProtocol = connectionUri.replace(protocol, "");
    if (!uriWithoutProtocol.includes("@")) {
      connectionUri = `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${uriWithoutProtocol}`;
    }
    if (authSource && !connectionUri.includes("authSource=")) {
      const separator = connectionUri.includes("?") ? "&" : "?";
      connectionUri = `${connectionUri}${separator}authSource=${authSource}`;
    }
  }

  const redactedUri = connectionUri.replace(/:([^:@]+)@/, ":******@");
  logger.info(`[Database] Đang kết nối MongoDB: ${redactedUri}`);

  // Set up connection event listeners for detailed logging
  mongoose.connection.on("connected", () => {
    logger.info(`[Database] Mongoose connection established successfully.`);
  });

  mongoose.connection.on("error", (err) => {
    logger.error(`[Database] Mongoose connection error: ${err}`);
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn(`[Database] Mongoose connection disconnected.`);
  });

  mongoose.connection.on("reconnected", () => {
    logger.info(`[Database] Mongoose connection reconnected.`);
  });

  try {
    await mongoose.connect(connectionUri);
    logger.info("[Database] Kết nối MongoDB thành công.");
    await seedSuperAdmin();
  } catch (error) {
    logger.error(`[Database] Lỗi kết nối MongoDB: ${error}`);
    process.exit(1);
  }
}
