import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load Environment Variables pointing to workspace .env
dotenv.config();

// Import Models and Services
import { UserModel } from "../server/model/user.model";
import { RenderJobModel } from "../server/model/render-job.model";
import { TransactionModel } from "../server/model/transaction.model";
import { cloudinaryService } from "../server/service/cloudinary.service";

// Helper function to safely parse any date format (Timestamp, ISO string, milliseconds, etc.)
function parseDateSafely(dateValue: any): Date {
  if (!dateValue) return new Date();
  
  // If it's a Firestore Timestamp (has seconds property)
  if (dateValue && typeof dateValue === "object" && typeof dateValue.seconds === "number") {
    return new Date(dateValue.seconds * 1000);
  }
  
  const parsed = new Date(dateValue);
  if (isNaN(parsed.getTime())) {
    return new Date(); // Fallback to current date if parsing fails
  }
  return parsed;
}

// Helper function to extract file path in the bucket from a Firebase Storage URL
function getStoragePathFromUrl(url: string): string | null {
  try {
    if (!url.includes("firebasestorage.googleapis.com")) {
      return null;
    }
    const match = url.match(/\/o\/(.+?)(?:\?|$)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

// Helper function to migrate an image URL from Firebase Storage to Cloudinary
async function migrateImageUrl(url: string, bucket: any, folder: string): Promise<string> {
  if (!url || typeof url !== "string") return url;
  
  if (!url.includes("firebasestorage.googleapis.com")) {
    return url;
  }
  
  try {
    const storagePath = getStoragePathFromUrl(url);
    if (!storagePath) {
      console.log(`[Migration] URL is not in Firebase Storage format: ${url}`);
      return url;
    }
    
    console.log(`[Migration] Downloading file from Firebase Storage: ${storagePath}`);
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`[Migration] File not found in Firebase Storage: ${storagePath}`);
      return url;
    }
    
    const [buffer] = await file.download();
    const contentType = file.metadata.contentType || "image/png";
    const base64Str = `data:${contentType};base64,${buffer.toString("base64")}`;
    
    console.log(`[Migration] Uploading file to Cloudinary...`);
    const cloudinaryUrl = await cloudinaryService.uploadMedia(base64Str, folder);
    console.log(`[Migration] Upload success: ${url} -> ${cloudinaryUrl}`);
    return cloudinaryUrl;
  } catch (error) {
    console.error(`[Migration] Error migrating URL ${url}:`, error);
    return url; // Return original URL if failed to not lose reference
  }
}

async function run() {
  // Read firebase-applet-config.json
  if (!fs.existsSync("./firebase-applet-config.json")) {
    console.error("[Migration] Missing firebase-applet-config.json in the workspace root!");
    process.exit(1);
  }
  const appletConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
  
  const projectId = appletConfig.projectId;
  const databaseId = appletConfig.firestoreDatabaseId || "(default)";
  const storageBucket = appletConfig.storageBucket || `${projectId}.firebasestorage.app`;

  console.log(`[Migration] Project: ${projectId}`);
  console.log(`[Migration] Firestore Database ID: ${databaseId}`);
  console.log(`[Migration] Storage Bucket: ${storageBucket}`);

  // Resolve Service Account or fallback to ADC
  let credential;
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json";
  const saResolved = path.resolve(saPath);

  if (fs.existsSync(saResolved)) {
    console.log(`[Migration] Using Service Account JSON file from: ${saResolved}`);
    const serviceAccount = JSON.parse(fs.readFileSync(saResolved, "utf8"));
    credential = admin.credential.cert(serviceAccount);
  } else {
    console.log("[Migration] No Service Account JSON key found. Falling back to Application Default Credentials (ADC)...");
    console.log("[Migration] Note: Please make sure you have run 'gcloud auth application-default login' on your machine.");
    credential = admin.credential.applicationDefault();
  }

  const app = admin.initializeApp({
    credential,
    storageBucket,
    projectId,
  });

  const firestore = getFirestore(app, databaseId);
  const bucket = admin.storage().bucket();
  
  console.log("[Migration] Connecting to MongoDB...");
  let uri = process.env.MONGODB_URI || "mongodb://localhost:27017/igen-architect";
  
  // Rewrite Docker host 'mongodb' to 'localhost' for local host execution
  if (uri.includes("://mongodb/")) {
    console.log("[Migration] Rewriting MongoDB docker host 'mongodb' to 'localhost' for local script run.");
    uri = uri.replace("://mongodb/", "://localhost/");
  } else if (uri.includes("://mongodb:")) {
    console.log("[Migration] Rewriting MongoDB docker host 'mongodb' to 'localhost' for local script run.");
    uri = uri.replace("://mongodb:", "://localhost:");
  } else if (uri === "mongodb://mongodb") {
    console.log("[Migration] Rewriting MongoDB docker host 'mongodb' to 'localhost' for local script run.");
    uri = "mongodb://localhost";
  }

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
  console.log(`[Migration] Connecting to MongoDB: ${redactedUri}`);

  try {
    await mongoose.connect(connectionUri);
    console.log("[Migration] MongoDB connection successful.");
  } catch (error: any) {
    if (error.message?.includes("Authentication failed") && (user || pass)) {
      console.warn("[Migration] Authentication failed with credentials. Trying to connect without credentials...");
      await mongoose.connect(uri);
      console.log("[Migration] MongoDB connection successful (without credentials).");
    } else {
      throw error;
    }
  }

  // Map of Firestore User ID (doc.id) -> MongoDB User ID (_id)
  const firestoreUserToMongoIdMap = new Map<string, string>();

  // 1. Migrate Users
  console.log("[Migration] Migrating collection 'users'...");
  const usersSnapshot = await firestore.collection("users").get();
  console.log(`[Migration] Found ${usersSnapshot.size} accounts in Firestore.`);
  let userCount = 0;
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const email = data.email?.toLowerCase().trim();
    if (!email) continue;

    let mongoUser = await UserModel.findOne({ email });
    if (!mongoUser) {
      const defaultPassword = data.password || "$2a$10$T8l6fX5/cWzN.aA/vIUpd.6aC7U6s0.D2aX7K5iYpWkH4r8eD8Z1O";
      mongoUser = await new UserModel({
        email,
        password: defaultPassword,
        displayName: data.displayName || "",
        role: data.role || "user",
        apiKey: data.apiKey || "",
        credits: typeof data.credits === "number" ? data.credits : 10,
        hasClaimedCredits: typeof data.hasClaimedCredits === "boolean" ? data.hasClaimedCredits : true,
        hasSetupApiKey: !!data.apiKey,
        createdAt: parseDateSafely(data.createdAt),
        updatedAt: parseDateSafely(data.updatedAt),
      }).save();
      userCount++;
    }
    
    // Store mapping
    firestoreUserToMongoIdMap.set(doc.id, mongoUser._id.toString());
  }
  console.log(`[Migration] Users migration completed. Added ${userCount} new users. Map size: ${firestoreUserToMongoIdMap.size}`);

  // 2. Migrate Transactions
  console.log("[Migration] Migrating collection 'transactions'...");
  const txSnapshot = await firestore.collection("transactions").get();
  console.log(`[Migration] Found ${txSnapshot.size} transactions in Firestore.`);
  let txCount = 0;
  for (const doc of txSnapshot.docs) {
    const data = doc.data();
    
    let userMongoIdStr = "";
    if (data.userId) {
      userMongoIdStr = firestoreUserToMongoIdMap.get(data.userId) || "";
    }
    if (!userMongoIdStr && data.email) {
      const u = await UserModel.findOne({ email: data.email.toLowerCase().trim() });
      if (u) userMongoIdStr = u._id.toString();
    }

    if (userMongoIdStr) {
      const parsedTimestamp = parseDateSafely(data.timestamp);
      const txExists = await TransactionModel.findOne({
        userId: userMongoIdStr,
        amount: data.amount,
        type: data.type,
        timestamp: parsedTimestamp,
      });
      
      if (!txExists) {
        await new TransactionModel({
          userId: userMongoIdStr,
          amount: typeof data.amount === "number" ? data.amount : 0,
          type: data.type || "add",
          model: data.model || "gemini",
          timestamp: parsedTimestamp,
        }).save();
        txCount++;
      }
    }
  }
  console.log(`[Migration] Transactions migration completed. Added ${txCount} new transactions.`);

  // 3. Migrate Render Jobs and Storage Files
  console.log("[Migration] Migrating collection 'renderJobs' and files to Cloudinary...");
  const jobsSnapshot = await firestore.collection("renderJobs").get();
  console.log(`[Migration] Found ${jobsSnapshot.size} render jobs in Firestore.`);
  let jobCount = 0;
  let updatedJobCount = 0;
  let fileCount = 0;

  for (const doc of jobsSnapshot.docs) {
    const data = doc.data();
    
    let userMongoIdStr = "";
    if (data.userId) {
      userMongoIdStr = firestoreUserToMongoIdMap.get(data.userId) || "";
    }
    if (!userMongoIdStr && data.email) {
      const u = await UserModel.findOne({ email: data.email.toLowerCase().trim() });
      if (u) userMongoIdStr = u._id.toString();
    }

    if (userMongoIdStr) {
      const parsedCreatedAt = parseDateSafely(data.createdAt);
      
      // Check if job exists in MongoDB
      const jobExists = await RenderJobModel.findOne({
        userId: userMongoIdStr,
        createdAt: parsedCreatedAt,
      });

      if (jobExists) {
        // If job already exists, check if there are any Firebase Storage URLs to migrate to Cloudinary
        const hasFirebaseUrls = [
          ...jobExists.inputImageUrls,
          ...jobExists.referenceImageUrls,
          ...jobExists.outputImageUrls
        ].some(url => url && url.includes("firebasestorage.googleapis.com"));

        if (hasFirebaseUrls) {
          console.log(`[Migration] Existing job ${jobExists._id} (User ID: ${data.userId}) contains Firebase Storage URLs. Updating to Cloudinary...`);
          
          const migratedInputUrls: string[] = [];
          for (const url of jobExists.inputImageUrls) {
            const newUrl = await migrateImageUrl(url, bucket, "input_images");
            if (newUrl !== url) fileCount++;
            migratedInputUrls.push(newUrl);
          }

          const migratedReferenceUrls: string[] = [];
          for (const url of jobExists.referenceImageUrls) {
            const newUrl = await migrateImageUrl(url, bucket, "reference_images");
            if (newUrl !== url) fileCount++;
            migratedReferenceUrls.push(newUrl);
          }

          const migratedOutputUrls: string[] = [];
          for (const url of jobExists.outputImageUrls) {
            const newUrl = await migrateImageUrl(url, bucket, "output_images");
            if (newUrl !== url) fileCount++;
            migratedOutputUrls.push(newUrl);
          }

          jobExists.inputImageUrls = migratedInputUrls;
          jobExists.referenceImageUrls = migratedReferenceUrls;
          jobExists.outputImageUrls = migratedOutputUrls;
          await jobExists.save();
          updatedJobCount++;
        }
      } else {
        console.log(`[Migration] Processing NEW render job ${doc.id} for user ID ${data.userId}...`);

        let rawInputUrls: string[] = [];
        if (data.inputImageUrl) {
          rawInputUrls.push(data.inputImageUrl);
        }
        if (Array.isArray(data.inputImageUrls)) {
          rawInputUrls = rawInputUrls.concat(data.inputImageUrls);
        }
        rawInputUrls = [...new Set(rawInputUrls)];

        const rawReferenceUrls: string[] = Array.isArray(data.referenceImageUrls) ? data.referenceImageUrls : [];
        const rawOutputUrls: string[] = Array.isArray(data.outputImageUrls) ? data.outputImageUrls : [];

        const migratedInputUrls: string[] = [];
        for (const url of rawInputUrls) {
          const newUrl = await migrateImageUrl(url, bucket, "input_images");
          if (newUrl !== url) fileCount++;
          migratedInputUrls.push(newUrl);
        }

        const migratedReferenceUrls: string[] = [];
        for (const url of rawReferenceUrls) {
          const newUrl = await migrateImageUrl(url, bucket, "reference_images");
          if (newUrl !== url) fileCount++;
          migratedReferenceUrls.push(newUrl);
        }

        const migratedOutputUrls: string[] = [];
        for (const url of rawOutputUrls) {
          const newUrl = await migrateImageUrl(url, bucket, "output_images");
          if (newUrl !== url) fileCount++;
          migratedOutputUrls.push(newUrl);
        }

        await new RenderJobModel({
          userId: userMongoIdStr,
          type: data.type || "render",
          subType: data.subType || "",
          inputImageUrls: migratedInputUrls,
          referenceImageUrls: migratedReferenceUrls,
          outputImageUrls: migratedOutputUrls,
          status: data.status || "completed",
          progress: typeof data.progress === "number" ? data.progress : 100,
          prompt: data.prompt || "",
          model: data.model || "",
          resolution: data.resolution || "1K",
          piapiTaskId: data.piapiTaskId || "",
          createdAt: parsedCreatedAt,
          updatedAt: parseDateSafely(data.updatedAt),
        }).save();

        jobCount++;
      }
    }
  }
  console.log(`[Migration] Render jobs migration completed. Added ${jobCount} new jobs, updated ${updatedJobCount} existing jobs, and migrated ${fileCount} files to Cloudinary.`);

  console.log("\n================ MIGRATION REPORT ================");
  console.log(`- Users Migrated: ${userCount}`);
  console.log(`- Transactions Migrated: ${txCount}`);
  console.log(`- Render Jobs Migrated (New): ${jobCount}`);
  console.log(`- Render Jobs Updated (Cloudinary): ${updatedJobCount}`);
  console.log(`- Files Migrated to Cloudinary: ${fileCount}`);
  console.log("==================================================");

  await mongoose.disconnect();
  console.log("[Migration] Disconnected from MongoDB. Completed successfully.");
  process.exit(0);
}

run().catch((error) => {
  console.error("[Migration] Error during migration script run:", error);
  process.exit(1);
});
