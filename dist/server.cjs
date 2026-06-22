var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express8 = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_http = require("http");
var import_cookie_parser = __toESM(require("cookie-parser"), 1);
var import_swagger_ui_express = __toESM(require("swagger-ui-express"), 1);
var import_dotenv2 = __toESM(require("dotenv"), 1);

// server/utils/logger.ts
var import_winston = __toESM(require("winston"), 1);
var import_path = __toESM(require("path"), 1);
var levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};
var colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white"
};
import_winston.default.addColors(colors);
var logFormat = import_winston.default.format.combine(
  import_winston.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  import_winston.default.format.colorize({ all: true }),
  import_winston.default.format.printf(
    (info) => `[${info.timestamp}] [${info.level}]: ${info.message}`
  )
);
var fileFormat = import_winston.default.format.combine(
  import_winston.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  import_winston.default.format.printf(
    (info) => `[${info.timestamp}] [${info.level.toUpperCase()}]: ${info.message}`
  )
);
var logsDir = import_path.default.join(process.cwd(), "logs");
var transports = [
  new import_winston.default.transports.Console({
    format: logFormat
  }),
  new import_winston.default.transports.File({
    filename: import_path.default.join(logsDir, "error.log"),
    level: "error",
    format: fileFormat
  }),
  new import_winston.default.transports.File({
    filename: import_path.default.join(logsDir, "all.log"),
    format: fileFormat
  })
];
var logger = import_winston.default.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  levels,
  transports
});

// server/middleware/logger.middleware.ts
function loggerMiddleware(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;
  const bodyCopy = req.body ? { ...req.body } : {};
  if (bodyCopy.password) {
    bodyCopy.password = "[HIDDEN]";
  }
  if (bodyCopy.file && typeof bodyCopy.file === "string") {
    bodyCopy.file = `[BASE64 DATA: ${bodyCopy.file.length} chars]`;
  }
  logger.info(`[REQUEST] ${method} ${originalUrl} - IP: ${ip}`);
  if (Object.keys(bodyCopy).length > 0) {
    logger.info(`[REQUEST-BODY] ${JSON.stringify(bodyCopy)}`);
  }
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const userId = req.user?.userId || "Guest";
    logger.info(`[RESPONSE] ${method} ${originalUrl} - Status: ${statusCode} - User: ${userId} - Duration: ${duration}ms`);
  });
  next();
}

// server/config/database.ts
var import_mongoose2 = __toESM(require("mongoose"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_dns = __toESM(require("dns"), 1);

// server/model/user.model.ts
var import_mongoose = __toESM(require("mongoose"), 1);
var UserSchema = new import_mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    password: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      default: "",
      trim: true
    },
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
      index: true
    },
    apiKey: {
      type: String,
      default: ""
    },
    credits: {
      type: Number,
      default: 0
    },
    hasClaimedCredits: {
      type: Boolean,
      default: true
    },
    hasSetupApiKey: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);
var UserModel = import_mongoose.default.model("User", UserSchema);

// server/config/database.ts
async function seedSuperAdmin() {
  try {
    const saEmail = (process.env.SUPERADMIN_EMAIL || "admin@igen-architect.com").toLowerCase().trim();
    const saPassword = process.env.SUPERADMIN_PASSWORD || "Admin@123456";
    const saName = process.env.SUPERADMIN_NAME || "Super Admin";
    const existingSA = await UserModel.findOne({ role: { $in: ["superadmin", "admin"] } });
    if (existingSA) {
      logger.info("[Database] Admin \u0111\xE3 t\u1ED3n t\u1EA1i.");
      return;
    }
    const hashedPassword = await import_bcryptjs.default.hash(saPassword, 10);
    await new UserModel({
      email: saEmail,
      password: hashedPassword,
      displayName: saName,
      role: "superadmin",
      credits: 9999,
      hasSetupApiKey: true
    }).save();
    logger.info(`[Database] Kh\u1EDFi t\u1EA1o Super Admin th\xE0nh c\xF4ng: ${saEmail}`);
  } catch (error) {
    logger.error(`[Database] L\u1ED7i khi seed admin: ${error}`);
  }
}
async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/igen-architect";
  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";
  let connectionUri = uri;
  let hostname;
  try {
    const parsed = new URL(connectionUri);
    hostname = parsed.hostname;
  } catch {
    const match = connectionUri.match(/:\/\/([^:/]+)/);
    hostname = match ? match[1] : null;
  }
  if (hostname === "mongodb") {
    const isDocker = import_fs.default.existsSync("/.dockerenv") || import_fs.default.existsSync("/proc/1/cgroup") && import_fs.default.readFileSync("/proc/1/cgroup", "utf8").includes("docker");
    let isResolvable;
    if (isDocker) {
      isResolvable = true;
    } else {
      isResolvable = await new Promise((resolve) => {
        import_dns.default.lookup("mongodb", (err) => {
          resolve(!err);
        });
      });
    }
    if (!isResolvable) {
      logger.info("[Database] Host 'mongodb' kh\xF4ng th\u1EC3 ph\xE2n gi\u1EA3i v\xE0 kh\xF4ng \u1EDF trong Docker. T\u1EF1 \u0111\u1ED9ng chuy\u1EC3n \u0111\u1ED5i sang 'localhost'.");
      if (connectionUri.includes("://mongodb/")) {
        connectionUri = connectionUri.replace("://mongodb/", "://localhost/");
      } else if (connectionUri.includes("://mongodb:")) {
        connectionUri = connectionUri.replace("://mongodb:", "://localhost:");
      } else if (connectionUri === "mongodb://mongodb") {
        connectionUri = "mongodb://localhost";
      }
    }
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
  logger.info(`[Database] \u0110ang k\u1EBFt n\u1ED1i MongoDB: ${redactedUri}`);
  import_mongoose2.default.connection.on("connected", () => {
    logger.info(`[Database] Mongoose connection established successfully.`);
  });
  import_mongoose2.default.connection.on("error", (err) => {
    logger.error(`[Database] Mongoose connection error: ${err}`);
  });
  import_mongoose2.default.connection.on("disconnected", () => {
    logger.warn(`[Database] Mongoose connection disconnected.`);
  });
  import_mongoose2.default.connection.on("reconnected", () => {
    logger.info(`[Database] Mongoose connection reconnected.`);
  });
  try {
    await import_mongoose2.default.connect(connectionUri);
    logger.info("[Database] K\u1EBFt n\u1ED1i MongoDB th\xE0nh c\xF4ng.");
    await seedSuperAdmin();
  } catch (error) {
    const isDocker = import_fs.default.existsSync("/.dockerenv") || import_fs.default.existsSync("/proc/1/cgroup") && import_fs.default.readFileSync("/proc/1/cgroup", "utf8").includes("docker");
    if (!isDocker && user && pass && error instanceof Error && error.message.includes("Authentication failed")) {
      logger.warn(`[Database] K\u1EBFt n\u1ED1i c\xF3 t\xE0i kho\u1EA3n/m\u1EADt kh\u1EA9u th\u1EA5t b\u1EA1i (${error.message}). \u0110ang th\u1EED k\u1EBFt n\u1ED1i l\u1EA1i kh\xF4ng d\xF9ng t\xE0i kho\u1EA3n m\u1EADt kh\u1EA9u...`);
      try {
        let fallbackUri = uri;
        if (fallbackUri.includes("://mongodb/")) {
          fallbackUri = fallbackUri.replace("://mongodb/", "://localhost/");
        } else if (fallbackUri.includes("://mongodb:")) {
          fallbackUri = fallbackUri.replace("://mongodb:", "://localhost:");
        } else if (fallbackUri === "mongodb://mongodb") {
          fallbackUri = "mongodb://localhost";
        }
        logger.info(`[Database] \u0110ang k\u1EBFt n\u1ED1i MongoDB (fallback): ${fallbackUri}`);
        await import_mongoose2.default.connect(fallbackUri);
        logger.info("[Database] K\u1EBFt n\u1ED1i MongoDB kh\xF4ng c\u1EA7n t\xE0i kho\u1EA3n m\u1EADt kh\u1EA9u th\xE0nh c\xF4ng.");
        await seedSuperAdmin();
        return;
      } catch (fallbackError) {
        logger.error(`[Database] K\u1EBFt n\u1ED1i MongoDB fallback th\u1EA5t b\u1EA1i: ${fallbackError}`);
      }
    }
    logger.error(`[Database] L\u1ED7i k\u1EBFt n\u1ED1i MongoDB: ${error}`);
    process.exit(1);
  }
}

// server/router/index.ts
var import_express7 = require("express");
var import_mongoose8 = __toESM(require("mongoose"), 1);

// server/router/auth.router.ts
var import_express = require("express");

// server/service/auth.service.ts
var import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "igen_access_secret_change_me";
var REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "igen_refresh_secret_change_me";
var ACCESS_EXPIRES = "15m";
var REFRESH_EXPIRES = "30d";
function generateTokens(userId, role) {
  const accessToken = import_jsonwebtoken.default.sign({ userId, role }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
  const refreshToken = import_jsonwebtoken.default.sign({ userId, role }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
  return { accessToken, refreshToken };
}
function verifyAccessToken(token) {
  return import_jsonwebtoken.default.verify(token, ACCESS_SECRET);
}
function verifyRefreshToken(token) {
  return import_jsonwebtoken.default.verify(token, REFRESH_SECRET);
}
var authService = {
  async login(email, password) {
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      throw new Error("Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c.");
    }
    const isMatch = await import_bcryptjs2.default.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c.");
    }
    const { accessToken, refreshToken } = generateTokens(String(user._id), user.role);
    return { accessToken, refreshToken, user };
  },
  async register(email, password, displayName) {
    const existing = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      throw new Error("Email n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng. Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
    }
    if (password.length < 6) {
      throw new Error("M\u1EADt kh\u1EA9u qu\xE1 y\u1EBFu. Vui l\xF2ng \u0111\u1EB7t m\u1EADt kh\u1EA9u t\u1ED1i thi\u1EC3u 6 k\xFD t\u1EF1.");
    }
    const hashedPassword = await import_bcryptjs2.default.hash(password, 10);
    const isAdmin = email.toLowerCase() === "igen-architect@admin.com" || email.toLowerCase() === "igentech1@gmail.com";
    const user = await new UserModel({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      displayName: displayName.trim() || email.split("@")[0],
      role: isAdmin ? "admin" : "user",
      credits: 0,
      hasSetupApiKey: false
    }).save();
    const { accessToken, refreshToken } = generateTokens(String(user._id), user.role);
    return { accessToken, refreshToken, user };
  },
  async refreshToken(token) {
    const payload = verifyRefreshToken(token);
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      throw new Error("T\xE0i kho\u1EA3n kh\xF4ng t\u1ED3n t\u1EA1i tr\xEAn h\u1EC7 th\u1ED1ng.");
    }
    const { accessToken, refreshToken } = generateTokens(String(user._id), user.role);
    return { accessToken, refreshToken, user };
  },
  async getMe(userId) {
    return UserModel.findById(userId).select("-password");
  }
};

// server/controller/auth.controller.ts
var import_joi = __toESM(require("joi"), 1);
var loginSchema = import_joi.default.object({
  email: import_joi.default.string().email().required().messages({
    "string.email": "\u0110\u1ECBa ch\u1EC9 email kh\xF4ng \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng.",
    "any.required": "Email l\xE0 b\u1EAFt bu\u1ED9c."
  }),
  password: import_joi.default.string().min(6).required().messages({
    "string.min": "M\u1EADt kh\u1EA9u t\u1ED1i thi\u1EC3u 6 k\xFD t\u1EF1.",
    "any.required": "M\u1EADt kh\u1EA9u l\xE0 b\u1EAFt bu\u1ED9c."
  })
});
var registerSchema = import_joi.default.object({
  email: import_joi.default.string().email().required().messages({
    "string.email": "\u0110\u1ECBa ch\u1EC9 email kh\xF4ng \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng.",
    "any.required": "Email l\xE0 b\u1EAFt bu\u1ED9c."
  }),
  password: import_joi.default.string().min(6).required().messages({
    "string.min": "M\u1EADt kh\u1EA9u t\u1ED1i thi\u1EC3u 6 k\xFD t\u1EF1.",
    "any.required": "M\u1EADt kh\u1EA9u l\xE0 b\u1EAFt bu\u1ED9c."
  }),
  displayName: import_joi.default.string().trim().optional().allow("")
});
var authController = {
  async login(req, res) {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const { email, password } = req.body;
      const { accessToken, refreshToken, user } = await authService.login(email, password);
      logger.info(`[authController.login] User login success: ${user.email} (ID: ${user._id}, Role: ${user.role})`);
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1e3
        // 30 days
      });
      res.json({
        success: true,
        data: {
          accessToken,
          user: {
            _id: user._id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            apiKey: user.apiKey,
            credits: user.credits,
            hasSetupApiKey: user.hasSetupApiKey
          }
        }
      });
    } catch (error2) {
      logger.error(`[authController.login] Login error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\u0103ng nh\u1EADp th\u1EA5t b\u1EA1i.";
      res.status(401).json({ success: false, message: errMsg });
    }
  },
  async register(req, res) {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const { email, password, displayName } = req.body;
      const { accessToken, refreshToken, user } = await authService.register(email, password, displayName || "");
      logger.info(`[authController.register] User registration success: ${user.email} (ID: ${user._id})`);
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1e3
      });
      res.status(201).json({
        success: true,
        data: {
          accessToken,
          user: {
            _id: user._id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            apiKey: user.apiKey,
            credits: user.credits,
            hasSetupApiKey: user.hasSetupApiKey
          }
        }
      });
    } catch (error2) {
      logger.error(`[authController.register] Registration error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\u0103ng k\xFD th\u1EA5t b\u1EA1i.";
      res.status(400).json({ success: false, message: errMsg });
    }
  },
  async refreshToken(req, res) {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ success: false, message: "Kh\xF4ng c\xF3 refresh token." });
      return;
    }
    try {
      const { accessToken, refreshToken, user } = await authService.refreshToken(token);
      logger.info(`[authController.refreshToken] Token refreshed successfully for user: ${user.email} (ID: ${user._id})`);
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1e3
      });
      res.json({
        success: true,
        data: {
          accessToken,
          user: {
            _id: user._id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            apiKey: user.apiKey,
            credits: user.credits,
            hasSetupApiKey: user.hasSetupApiKey
          }
        }
      });
    } catch (error) {
      logger.error(`[authController.refreshToken] Refresh token error: ${error}`);
      res.status(401).json({ success: false, message: "Phi\xEAn l\xE0m vi\u1EC7c \u0111\xE3 h\u1EBFt h\u1EA1n. Vui l\xF2ng \u0111\u0103ng nh\u1EADp l\u1EA1i." });
    }
  },
  async getMe(req, res) {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp \u0111\u1EC3 ti\u1EBFp t\u1EE5c." });
        return;
      }
      const user = await authService.getMe(req.user.userId);
      if (!user) {
        res.status(404).json({ success: false, message: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n." });
        return;
      }
      res.json({ success: true, data: user });
    } catch (error) {
      logger.error(`[authController.getMe] Get user details error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "L\u1ED7i m\xE1y ch\u1EE7.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async logout(req, res) {
    res.clearCookie("refreshToken");
    logger.info("[authController.logout] User logged out successfully. Cookie cleared.");
    res.json({ success: true, message: "\u0110\xE3 \u0111\u0103ng xu\u1EA5t th\xE0nh c\xF4ng." });
  }
};

// server/middleware/auth.middleware.ts
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp \u0111\u1EC3 ti\u1EBFp t\u1EE5c." });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Phi\xEAn \u0111\u0103ng nh\u1EADp \u0111\xE3 h\u1EBFt h\u1EA1n. Vui l\xF2ng \u0111\u0103ng nh\u1EADp l\u1EA1i." });
  }
}
function adminMiddleware(req, res, next) {
  if (!req.user) {
    res.status(401).json({ success: false, message: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp \u0111\u1EC3 ti\u1EBFp t\u1EE5c." });
    return;
  }
  if (req.user.role !== "admin" && req.user.role !== "superadmin") {
    res.status(403).json({ success: false, message: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n truy c\u1EADp ch\u1EE9c n\u0103ng n\xE0y." });
    return;
  }
  next();
}

// server/router/auth.router.ts
var router = (0, import_express.Router)();
router.post("/login", authController.login);
router.post("/register", authController.register);
router.post("/refresh-token", authController.refreshToken);
router.get("/me", authMiddleware, authController.getMe);
router.post("/logout", authController.logout);

// server/router/user.router.ts
var import_express2 = require("express");

// server/model/transaction.model.ts
var import_mongoose3 = __toESM(require("mongoose"), 1);
var TransactionSchema = new import_mongoose3.Schema(
  {
    userId: {
      type: import_mongoose3.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ["topup", "image", "video", "audio", "text"],
      required: true,
      index: true
    },
    model: {
      type: String,
      default: ""
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);
var TransactionModel = import_mongoose3.default.model("Transaction", TransactionSchema);

// server/service/user.service.ts
var import_mongoose4 = require("mongoose");
var userService = {
  async getList(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      UserModel.find().select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit),
      UserModel.countDocuments()
    ]);
    return { users, total, page, limit };
  },
  async getById(userId) {
    return UserModel.findById(userId).select("-password");
  },
  async updateRole(userId, role) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select("-password");
    if (!user) throw new Error("Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n.");
    return user;
  },
  async updateApiKey(userId, apiKey) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { apiKey, hasSetupApiKey: true },
      { new: true }
    ).select("-password");
    if (!user) throw new Error("Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n.");
    return user;
  },
  async updateCredits(userId, amount, type = "topup", model = "Admin Top-up") {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n.");
    const delta = type === "deduct" ? -Math.abs(amount) : Math.abs(amount);
    user.credits = (user.credits || 0) + delta;
    await user.save();
    await new TransactionModel({
      userId: new import_mongoose4.Types.ObjectId(userId),
      amount: Math.abs(amount),
      type: type === "topup" ? "topup" : "text",
      model,
      timestamp: /* @__PURE__ */ new Date()
    }).save();
    return user;
  },
  async updateProfile(userId, data) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { ...data },
      { new: true }
    ).select("-password");
    if (!user) throw new Error("Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n.");
    return user;
  },
  async deleteUser(userId) {
    const user = await UserModel.findByIdAndDelete(userId);
    if (!user) throw new Error("Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n.");
    return user;
  },
  async getCredits(userId) {
    const user = await UserModel.findById(userId).select("credits");
    if (!user) throw new Error("Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n.");
    return user.credits || 0;
  },
  async deductCredits(userId, cost, type, model) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n.");
    if ((user.credits || 0) < cost) throw new Error("B\u1EA1n \u0111\xE3 h\u1EBFt Credits. Vui l\xF2ng n\u1EA1p th\xEAm.");
    user.credits = (user.credits || 0) - cost;
    await user.save();
    await new TransactionModel({
      userId: new import_mongoose4.Types.ObjectId(userId),
      amount: cost,
      type,
      model,
      timestamp: /* @__PURE__ */ new Date()
    }).save();
    return user.credits;
  }
};

// server/service/transaction.service.ts
var import_mongoose5 = require("mongoose");
var transactionService = {
  async getListByUser(userId, limit = 100) {
    return TransactionModel.find({ userId: new import_mongoose5.Types.ObjectId(userId) }).sort({ timestamp: -1 }).limit(limit);
  },
  async getAll(page = 1, limit = 100) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      TransactionModel.find().sort({ timestamp: -1 }).skip(skip).limit(limit),
      TransactionModel.countDocuments()
    ]);
    return { transactions, total, page, limit };
  },
  async create(data) {
    return new TransactionModel({
      userId: new import_mongoose5.Types.ObjectId(data.userId),
      amount: data.amount,
      type: data.type,
      model: data.model,
      timestamp: /* @__PURE__ */ new Date()
    }).save();
  },
  async deleteAllByUser(userId) {
    await TransactionModel.deleteMany({ userId: new import_mongoose5.Types.ObjectId(userId) });
  }
};

// server/model/render-job.model.ts
var import_mongoose6 = __toESM(require("mongoose"), 1);
var RenderJobSchema = new import_mongoose6.Schema(
  {
    userId: {
      type: import_mongoose6.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      index: true
    },
    subType: {
      type: String,
      default: ""
    },
    inputImageUrls: {
      type: [String],
      default: []
    },
    referenceImageUrls: {
      type: [String],
      default: []
    },
    outputImageUrls: {
      type: [String],
      default: []
    },
    prompt: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true
    },
    progress: {
      type: Number,
      default: 0
    },
    model: {
      type: String,
      default: ""
    },
    resolution: {
      type: String,
      default: "1K"
    },
    piapiTaskId: {
      type: String,
      default: "",
      index: true
    }
  },
  {
    timestamps: true
  }
);
var RenderJobModel = import_mongoose6.default.model("RenderJob", RenderJobSchema);

// server/service/render-job.service.ts
var import_mongoose7 = require("mongoose");
var renderJobService = {
  async create(data) {
    const job = await new RenderJobModel({
      userId: new import_mongoose7.Types.ObjectId(data.userId),
      type: data.type,
      subType: data.subType || "",
      inputImageUrls: data.inputImageUrls || [],
      referenceImageUrls: data.referenceImageUrls || [],
      outputImageUrls: data.outputImageUrls || [],
      prompt: data.prompt || "",
      status: data.status || "pending",
      progress: data.progress !== void 0 ? data.progress : 0,
      model: data.model || "",
      resolution: data.resolution || "1K",
      piapiTaskId: data.piapiTaskId || ""
    }).save();
    return job;
  },
  async getListByUser(userId, limit = 50) {
    return RenderJobModel.find({ userId: new import_mongoose7.Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(limit);
  },
  async getAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [jobs, total] = await Promise.all([
      RenderJobModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      RenderJobModel.countDocuments()
    ]);
    return { jobs, total, page, limit };
  },
  async getById(jobId) {
    return RenderJobModel.findById(jobId);
  },
  async updateStatus(jobId, status, outputImageUrls, progress) {
    const update = { status };
    if (outputImageUrls !== void 0) update.outputImageUrls = outputImageUrls;
    if (progress !== void 0) update.progress = progress;
    return RenderJobModel.findByIdAndUpdate(jobId, update, { new: true });
  },
  async deleteJob(jobId) {
    return RenderJobModel.findByIdAndDelete(jobId);
  },
  async deleteAllByUser(userId) {
    await RenderJobModel.deleteMany({ userId: new import_mongoose7.Types.ObjectId(userId) });
  }
};

// server/controller/user.controller.ts
var import_joi2 = __toESM(require("joi"), 1);
var roleSchema = import_joi2.default.object({
  role: import_joi2.default.string().valid("user", "admin").required().messages({
    "any.only": "Vai tr\xF2 kh\xF4ng h\u1EE3p l\u1EC7.",
    "any.required": "Vai tr\xF2 l\xE0 b\u1EAFt bu\u1ED9c."
  })
});
var creditsSchema = import_joi2.default.object({
  amount: import_joi2.default.number().required().messages({
    "number.base": "S\u1ED1 l\u01B0\u1EE3ng credits ph\u1EA3i l\xE0 s\u1ED1.",
    "any.required": "S\u1ED1 l\u01B0\u1EE3ng credits l\xE0 b\u1EAFt bu\u1ED9c."
  })
});
var apiKeySchema = import_joi2.default.object({
  apiKey: import_joi2.default.string().allow("").required()
});
var idParamSchema = import_joi2.default.object({
  id: import_joi2.default.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    "string.pattern.base": "ID kh\xF4ng \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng MongoDB ObjectId.",
    "any.required": "ID l\xE0 b\u1EAFt bu\u1ED9c."
  })
});
var apiKeyParamSchema = import_joi2.default.object({
  id: import_joi2.default.alternatives().try(
    import_joi2.default.string().valid("me"),
    import_joi2.default.string().regex(/^[0-9a-fA-F]{24}$/)
  ).optional()
});
var paginationQuerySchema = import_joi2.default.object({
  page: import_joi2.default.number().integer().min(1).optional().messages({
    "number.base": "Trang ph\u1EA3i l\xE0 s\u1ED1.",
    "number.integer": "Trang ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn.",
    "number.min": "Trang t\u1ED1i thi\u1EC3u l\xE0 1."
  }),
  limit: import_joi2.default.number().integer().min(1).optional().messages({
    "number.base": "Gi\u1EDBi h\u1EA1n ph\u1EA3i l\xE0 s\u1ED1.",
    "number.integer": "Gi\u1EDBi h\u1EA1n ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn.",
    "number.min": "Gi\u1EDBi h\u1EA1n t\u1ED1i thi\u1EC3u l\xE0 1."
  })
});
var userController = {
  async getList(req, res) {
    const { error } = paginationQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "50"), 10);
      const result = await userService.getList(page, limit);
      logger.info(`[userController.getList] Admin listed users. Page: ${page}, Limit: ${limit}`);
      res.json({ success: true, data: result });
    } catch (error2) {
      logger.error(`[userController.getList] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async getById(req, res) {
    const { error } = idParamSchema.validate(req.params);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const user = await userService.getById(req.params.id);
      if (!user) {
        res.status(404).json({ success: false, message: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n." });
        return;
      }
      logger.info(`[userController.getById] Retrieved user: ${req.params.id}`);
      res.json({ success: true, data: user });
    } catch (error2) {
      logger.error(`[userController.getById] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async updateRole(req, res) {
    const paramValidation = idParamSchema.validate(req.params);
    if (paramValidation.error) {
      res.status(400).json({ success: false, message: paramValidation.error.details[0].message });
      return;
    }
    const { error } = roleSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const user = await userService.updateRole(req.params.id, req.body.role);
      logger.info(`[userController.updateRole] Updated role for user: ${req.params.id} to: ${req.body.role}`);
      res.json({ success: true, data: user });
    } catch (error2) {
      logger.error(`[userController.updateRole] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async updateApiKey(req, res) {
    const paramValidation = apiKeyParamSchema.validate(req.params);
    if (paramValidation.error) {
      res.status(400).json({ success: false, message: paramValidation.error.details[0].message });
      return;
    }
    const { error } = apiKeySchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const isMe = req.params.id === "me" || !req.params.id || req.params.id === req.user.userId;
      const targetId = isMe ? req.user.userId : req.params.id;
      if (!isMe && req.user.role !== "admin" && req.user.role !== "superadmin") {
        res.status(403).json({ success: false, message: "Kh\xF4ng c\xF3 quy\u1EC1n th\u1EF1c hi\u1EC7n h\xE0nh \u0111\u1ED9ng n\xE0y." });
        return;
      }
      const user = await userService.updateApiKey(targetId, req.body.apiKey);
      logger.info(`[userController.updateApiKey] Updated API key for user: ${targetId}`);
      res.json({ success: true, data: user });
    } catch (error2) {
      logger.error(`[userController.updateApiKey] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async updateCredits(req, res) {
    const paramValidation = idParamSchema.validate(req.params);
    if (paramValidation.error) {
      res.status(400).json({ success: false, message: paramValidation.error.details[0].message });
      return;
    }
    const { error } = creditsSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const user = await userService.updateCredits(
        req.params.id,
        req.body.amount,
        "topup",
        "Admin Top-up"
      );
      logger.info(`[userController.updateCredits] Updated credits for user: ${req.params.id} by: ${req.body.amount}`);
      res.json({ success: true, data: user });
    } catch (error2) {
      logger.error(`[userController.updateCredits] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async deleteUser(req, res) {
    const { error } = idParamSchema.validate(req.params);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const userId = req.params.id;
      await renderJobService.deleteAllByUser(userId);
      await transactionService.deleteAllByUser(userId);
      await userService.deleteUser(userId);
      logger.info(`[userController.deleteUser] Deleted user: ${userId} and all related data.`);
      res.json({ success: true, message: "\u0110\xE3 x\xF3a ng\u01B0\u1EDDi d\xF9ng v\xE0 to\xE0n b\u1ED9 d\u1EEF li\u1EC7u li\xEAn quan th\xE0nh c\xF4ng." });
    } catch (error2) {
      logger.error(`[userController.deleteUser] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async getTransactions(req, res) {
    const { error } = paginationQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "100"), 10);
      const result = await transactionService.getAll(page, limit);
      logger.info(`[userController.getTransactions] Admin listed transactions. Page: ${page}, Limit: ${limit}`);
      res.json({ success: true, data: result });
    } catch (error2) {
      logger.error(`[userController.getTransactions] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async getMyTransactions(req, res) {
    const limitQuerySchema2 = import_joi2.default.object({
      limit: import_joi2.default.number().integer().min(1).optional().messages({
        "number.base": "Gi\u1EDBi h\u1EA1n ph\u1EA3i l\xE0 s\u1ED1.",
        "number.integer": "Gi\u1EDBi h\u1EA1n ph\u1EA3i s\u1ED1 nguy\xEAn.",
        "number.min": "Gi\u1EDBi h\u1EA1n t\u1ED1i thi\u1EC3u l\xE0 1."
      })
    });
    const { error } = limitQuerySchema2.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const limit = parseInt(String(req.query.limit || "100"), 10);
      const result = await transactionService.getListByUser(req.user.userId, limit);
      logger.info(`[userController.getMyTransactions] User ${req.user.userId} retrieved transactions. Limit: ${limit}`);
      res.json({ success: true, data: result });
    } catch (error2) {
      logger.error(`[userController.getMyTransactions] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  }
};

// server/router/user.router.ts
var router2 = (0, import_express2.Router)();
router2.get("/transactions", authMiddleware, adminMiddleware, userController.getTransactions);
router2.get("/me/transactions", authMiddleware, userController.getMyTransactions);
router2.get("/", authMiddleware, adminMiddleware, userController.getList);
router2.get("/:id", authMiddleware, adminMiddleware, userController.getById);
router2.patch("/me/api-key", authMiddleware, userController.updateApiKey);
router2.patch("/:id/role", authMiddleware, adminMiddleware, userController.updateRole);
router2.patch("/:id/credits", authMiddleware, adminMiddleware, userController.updateCredits);
router2.patch("/:id/api-key", authMiddleware, adminMiddleware, userController.updateApiKey);
router2.delete("/:id", authMiddleware, adminMiddleware, userController.deleteUser);

// server/router/render-job.router.ts
var import_express3 = require("express");

// server/service/piapi.service.ts
var import_dotenv = __toESM(require("dotenv"), 1);

// server/service/cloudinary.service.ts
var import_cloudinary = require("cloudinary");
var isConfigured = false;
function ensureConfigured() {
  if (isConfigured) return;
  import_cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  isConfigured = true;
}
var cloudinaryService = {
  /**
   * Upload file (Base64 hoặc URL công khai) lên Cloudinary
   */
  async uploadMedia(fileStr, folder) {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error("C\u1EA5u h\xECnh Cloudinary ch\u01B0a \u0111\u1EA7y \u0111\u1EE7 trong bi\u1EBFn m\xF4i tr\u01B0\u1EDDng.");
    }
    ensureConfigured();
    try {
      const response = await import_cloudinary.v2.uploader.upload(fileStr, {
        folder: folder || "igen_architect",
        resource_type: "auto"
      });
      return response.secure_url;
    } catch (error) {
      console.error("[cloudinaryService] L\u1ED7i upload:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`T\u1EA3i l\xEAn Cloudinary th\u1EA5t b\u1EA1i: ${errMsg}`, { cause: error });
    }
  },
  /**
   * Xóa file theo public_id từ Cloudinary
   */
  async deleteMedia(publicId) {
    ensureConfigured();
    try {
      await import_cloudinary.v2.uploader.destroy(publicId);
    } catch (error) {
      console.error("[cloudinaryService] L\u1ED7i x\xF3a media:", error);
    }
  },
  /**
   * Lấy public_id từ Cloudinary URL
   */
  extractPublicId(url) {
    try {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
};

// server/service/piapi.service.ts
import_dotenv.default.config();
var PIAPI_API_KEY = process.env.PIAPI_API_KEY || "";
var PIAPI_BASE_URL = process.env.PIAPI_BASE_URL || "https://api.piapi.ai/api/v1";
console.log(`[PiAPI Service] Loaded API Key status: ${PIAPI_API_KEY ? `Present (Length: ${PIAPI_API_KEY.length}, Prefix: ${PIAPI_API_KEY.substring(0, 8)}...)` : "Missing"}`);
var piapiService = {
  /**
   * Tạo task sinh ảnh bất đồng bộ trên PiAPI
   */
  async createImageTask(prompt, model, options) {
    if (!PIAPI_API_KEY) {
      console.log(`[PiAPI Image Task] Running in MOCK mode (No PIAPI_API_KEY). Model: ${model}`);
      const seed = Math.floor(Math.random() * 1e6);
      return {
        taskId: `mock-${seed}`,
        isMock: true,
        mockUrl: `https://picsum.photos/seed/${seed}/1024/1024`
      };
    }
    const aspect = options?.aspectRatio || "1:1";
    const randomSeed = Math.floor(Math.random() * 2147483647);
    let reqBody;
    if (model === "nano-banana-2" || model === "igen-image-flash") {
      throw new Error(`Model ${model} ph\u1EA3i d\xF9ng Gemini SDK tr\u1EF1c ti\u1EBFp, kh\xF4ng qua PiAPI. Vui l\xF2ng ki\u1EC3m tra l\u1EA1i controller.`);
    } else if (model === "nano-banana-pro") {
      reqBody = {
        model: "gemini",
        task_type: model,
        input: {
          prompt,
          output_format: "png",
          aspect_ratio: aspect,
          resolution: "1K",
          number_of_images: options?.numImages || 1,
          seed: randomSeed,
          ...options?.image ? { image: options.image } : {}
        }
      };
    } else {
      let piapiModel = model.replace("piapi-", "");
      if (piapiModel === "flux") {
        piapiModel = "Qubico/flux1-dev";
      }
      let finalPrompt = prompt;
      if (piapiModel === "midjourney" && !prompt.includes("--seed")) {
        finalPrompt = `${prompt} --seed ${randomSeed}`;
      }
      reqBody = {
        model: piapiModel,
        task_type: piapiModel === "midjourney" ? "imagine" : "txt2img",
        input: {
          prompt: finalPrompt,
          aspect_ratio: aspect,
          number_of_images: options?.numImages || 1,
          seed: randomSeed,
          ...options?.image ? { image: options.image } : {}
        }
      };
    }
    try {
      console.log(`[PiAPI Image Task] Requesting task for model ${model}. Body:`, JSON.stringify(reqBody, null, 2));
      const response = await fetch(`${PIAPI_BASE_URL}/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": PIAPI_API_KEY
        },
        body: JSON.stringify(reqBody)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PiAPI task creation failed: ${response.status} - ${errorText}`);
      }
      const json = await response.json();
      console.log(`[PiAPI Image Task] Task creation response:`, JSON.stringify(json, null, 2));
      const taskId = json.data?.task_id;
      if (!taskId) {
        throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c task_id t\u1EEB PiAPI");
      }
      return { taskId, isMock: false };
    } catch (error) {
      console.error("[PiAPI Image Task] Error:", error);
      throw error;
    }
  },
  /**
   * Truy vấn trạng thái task của PiAPI
   */
  async getTaskStatus(taskId) {
    if (taskId.startsWith("mock-")) {
      const mockUrl = `https://picsum.photos/seed/${taskId.replace("mock-", "")}/1024/1024`;
      return {
        status: "completed",
        progress: 100,
        outputUrl: mockUrl,
        outputUrls: [mockUrl]
      };
    }
    try {
      const response = await fetch(`${PIAPI_BASE_URL}/task/${taskId}`, {
        headers: { "x-api-key": PIAPI_API_KEY }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PiAPI task query failed: ${response.status} - ${errorText}`);
      }
      const json = await response.json();
      const task = json.data;
      console.log(`[PiAPI getTaskStatus] Task ${taskId} query result:`, JSON.stringify(json, null, 2));
      const status = task?.status;
      const progress = task?.progress || (status === "completed" ? 100 : 0);
      let outputUrl = "";
      let outputUrls = [];
      if (status === "completed") {
        if (task.output?.image_urls && task.output.image_urls.length > 0) {
          outputUrls = task.output.image_urls;
        } else {
          const singleUrl = task.output?.image_url || task.output?.url;
          if (singleUrl) {
            outputUrls = [singleUrl];
          }
        }
        outputUrl = outputUrls[0] || "";
      }
      return {
        status: status || "failed",
        progress,
        outputUrl,
        outputUrls,
        error: task?.error || void 0
      };
    } catch (error) {
      console.error("[PiAPI getTaskStatus] Error:", error);
      throw error;
    }
  },
  /**
   * Sinh ảnh bằng PiAPI (Midjourney, Flux, v.v.) - Đồng bộ (Polling nội bộ)
   */
  async generateImage(prompt, model, options) {
    const taskResult = await this.createImageTask(prompt, model, options);
    if (taskResult.isMock) {
      return { url: taskResult.mockUrl || "", isMock: true };
    }
    const taskId = taskResult.taskId;
    console.log(`[PiAPI Image Generation] Task created: ${taskId}. Polling for completion...`);
    let attempts = 0;
    const maxAttempts = 54;
    while (attempts < maxAttempts) {
      const pollInterval = attempts < 10 ? 3e3 : 5e3;
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      const taskStatus = await this.getTaskStatus(taskId);
      if (taskStatus.status === "completed") {
        if (!taskStatus.outputUrl) {
          throw new Error("T\xE1c v\u1EE5 ho\xE0n th\xE0nh nh\u01B0ng kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c URL h\xECnh \u1EA3nh.");
        }
        return { url: taskStatus.outputUrl, isMock: false };
      } else if (taskStatus.status === "failed") {
        throw new Error(`PiAPI task failed: ${taskStatus.error || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh"}`);
      }
      attempts++;
    }
    throw new Error("Qu\xE1 th\u1EDDi gian ch\u1EDD t\u1EA1o \u1EA3nh t\u1EEB PiAPI");
  },
  /**
   * Sinh video bằng PiAPI (Kling, Luma, v.v. và Veo 3.1) - Đồng bộ (Polling nội bộ)
   */
  async generateVideo(prompt, model, durationSeconds = 5, options) {
    if (!PIAPI_API_KEY) {
      console.log(`[PiAPI Video Generation] Running in MOCK mode (No PIAPI_API_KEY). Model: ${model}`);
      return { url: "https://www.w3schools.com/html/mov_bbb.mp4", isMock: true };
    }
    const aspect = options?.aspectRatio || "16:9";
    const piapiModel = model.replace("piapi-", "");
    let reqBody;
    if (piapiModel.includes("veo31") || piapiModel.includes("veo-3.1") || piapiModel.startsWith("veo3")) {
      let taskType = "veo3.1-video-fast";
      let generateAudio = true;
      if (piapiModel === "veo31-video-audio") {
        taskType = "veo3.1-video";
        generateAudio = true;
      } else if (piapiModel === "veo31-video-fast-audio") {
        taskType = "veo3.1-video-fast";
        generateAudio = true;
      } else if (piapiModel === "veo31-video-fast-no-audio") {
        taskType = "veo3.1-video-fast";
        generateAudio = false;
      }
      let imageUrl = void 0;
      if (options?.referenceImageUris && options.referenceImageUris.length > 0) {
        const firstImage = options.referenceImageUris[0];
        if (firstImage) {
          if (firstImage.startsWith("data:")) {
            try {
              console.log("[PiAPI Video Generation] Uploading reference image to Cloudinary...");
              imageUrl = await cloudinaryService.uploadMedia(firstImage, "igen_erp/video_refs");
              console.log(`[PiAPI Video Generation] Reference image uploaded: ${imageUrl}`);
            } catch (err) {
              console.error("[PiAPI Video Generation] Failed to upload reference image to Cloudinary:", err);
              imageUrl = firstImage;
            }
          } else {
            imageUrl = firstImage;
          }
        }
      }
      reqBody = {
        model: "veo3.1",
        task_type: taskType,
        input: {
          prompt,
          aspect_ratio: aspect,
          duration: `${durationSeconds}s`,
          generate_audio: generateAudio,
          ...imageUrl ? { image_url: imageUrl } : {}
        }
      };
    } else {
      reqBody = {
        model: piapiModel,
        task_type: "video_generation",
        input: {
          prompt,
          aspect_ratio: aspect,
          duration: durationSeconds
        }
      };
    }
    try {
      console.log(`[PiAPI Video Generation] Requesting task for model ${model}. Body:`, JSON.stringify(reqBody, null, 2));
      const response = await fetch(`${PIAPI_BASE_URL}/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": PIAPI_API_KEY
        },
        body: JSON.stringify(reqBody)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PiAPI task creation failed: ${response.status} - ${errorText}`);
      }
      const json = await response.json();
      console.log(`[PiAPI Video Generation] Task creation response:`, JSON.stringify(json, null, 2));
      const taskId = json.data?.task_id;
      if (!taskId) {
        throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c task_id t\u1EEB PiAPI");
      }
      console.log(`[PiAPI Video Generation] Task created: ${taskId}. Polling for completion...`);
      let attempts = 0;
      const maxAttempts = 60;
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1e4));
        const pollResponse = await fetch(`${PIAPI_BASE_URL}/task/${taskId}`, {
          headers: { "x-api-key": PIAPI_API_KEY }
        });
        if (pollResponse.ok) {
          const pollJson = await pollResponse.json();
          const task = pollJson.data;
          console.log(`[PiAPI Video Generation] Task ${taskId} poll result:`, JSON.stringify(pollJson, null, 2));
          if (task?.status === "completed") {
            const url = task.output?.video || task.output?.video_url || task.output?.url;
            if (!url) {
              throw new Error("T\xE1c v\u1EE5 ho\xE0n th\xE0nh nh\u01B0ng kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c URL video.");
            }
            return { url, isMock: false };
          } else if (task?.status === "failed") {
            throw new Error(`PiAPI task failed: ${task.error || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh"}`);
          }
        }
        attempts++;
      }
      throw new Error("Qu\xE1 th\u1EDDi gian ch\u1EDD t\u1EA1o video t\u1EEB PiAPI");
    } catch (error) {
      console.error("[PiAPI Video Generation] Error:", error);
      throw error;
    }
  }
};

// server/service/gemini.service.ts
var import_genai = require("@google/genai");
var geminiService = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async generate(params, userApiKey) {
    const modelName = params.model || "";
    const isImageModel = modelName.includes("image-preview") || modelName.includes("imagen") || modelName.includes("generateImages") || modelName.includes("banana");
    const isVideoModel = modelName.includes("veo");
    const isGeminiNativeImageModel = modelName === "nano-banana-2" || modelName === "igen-image-flash" || modelName === "gemini-3-pro-image" || modelName === "gemini-3.1-flash-image" || modelName.startsWith("imagen-");
    let apiKey = userApiKey && userApiKey.trim().length > 15 ? userApiKey.trim() : "";
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    }
    const isValidGeminiKey = (key) => key.startsWith("AIza") || key.startsWith("AQ.");
    if (apiKey && !isValidGeminiKey(apiKey)) {
      logger.warn(`[Gemini Service] API key format invalid (does not start with 'AIza' or 'AQ.'). Trying env fallback.`);
      const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
      if (envKey && isValidGeminiKey(envKey)) {
        apiKey = envKey;
      } else {
        logger.error(`[Gemini Service] No valid Gemini API key found! Both user key and .env key are invalid.`);
      }
    }
    logger.info(`[Gemini Service] Using API key prefix: ${apiKey ? apiKey.substring(0, 10) + "..." : "None"} (Length: ${apiKey.length}, Valid: ${apiKey ? isValidGeminiKey(apiKey) : false})`);
    const piapiKey = process.env.PIAPI_API_KEY;
    if (piapiKey && (isImageModel || isVideoModel) && !isGeminiNativeImageModel) {
      const { contents, generationConfig, config: reqConfig } = params;
      if (isImageModel) {
        let targetModel = "nano-banana-pro";
        if (modelName === "gemini-3-pro-image" || modelName === "nano-banana-pro" || modelName === "igen-image-pro") {
          targetModel = "nano-banana-pro";
        } else if (modelName === "gemini-3.1-flash-image" || modelName === "nano-banana-2" || modelName === "igen-image-flash") {
          targetModel = "nano-banana-2";
        } else if (modelName.includes("image-preview")) {
          targetModel = "nano-banana-pro";
        }
        let promptText = "";
        let inputImageBase64 = "";
        let inputImageMimeType = "";
        const contentsArray = Array.isArray(contents) ? contents : contents && contents.parts ? [{ parts: contents.parts }] : [];
        for (const content of contentsArray) {
          if (content.parts && Array.isArray(content.parts)) {
            for (const part of content.parts) {
              if (part.text) {
                promptText += part.text + "\n";
              } else if (part.inlineData && part.inlineData.data) {
                inputImageBase64 = part.inlineData.data;
                inputImageMimeType = part.inlineData.mimeType || "image/jpeg";
              }
            }
          }
        }
        promptText = promptText.trim();
        let aspectRatio = "1:1";
        const mergedConfig = { ...generationConfig || {}, ...reqConfig || {} };
        const imageConfig = mergedConfig?.imageConfig || {};
        if (imageConfig.aspectRatio) {
          aspectRatio = imageConfig.aspectRatio;
        }
        let uploadedImageUrl = "";
        if (inputImageBase64) {
          const fileStr = `data:${inputImageMimeType};base64,${inputImageBase64}`;
          logger.info(`[Gemini Service] Uploading input image to Cloudinary...`);
          uploadedImageUrl = await cloudinaryService.uploadMedia(fileStr, "temp_staging");
        }
        logger.info(`[Gemini Service] Generating image via PiAPI. Model: ${targetModel}, Aspect: ${aspectRatio}`);
        const piapiRes = await piapiService.generateImage(promptText, targetModel, {
          aspectRatio,
          image: uploadedImageUrl || void 0
        });
        const imgFetchRes = await fetch(piapiRes.url);
        if (!imgFetchRes.ok) {
          throw new Error(`Failed to download generated image: ${imgFetchRes.status}`);
        }
        const arrayBuffer = await imgFetchRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const mimeType = imgFetchRes.headers.get("content-type") || "image/png";
        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: base64,
                      mimeType
                    }
                  }
                ],
                role: "model"
              },
              finishReason: "STOP"
            }
          ]
        };
      }
      if (isVideoModel) {
        const normalizedModel = modelName.toLowerCase();
        let piapiVideoModel = "veo31-video-fast-audio";
        if (normalizedModel === "veo-3.1-generate-preview" || normalizedModel === "veo31-video-audio" || normalizedModel === "piapi-veo31-video-audio" || normalizedModel === "veo") {
          piapiVideoModel = "veo31-video-audio";
        } else if (normalizedModel === "veo-3.1-fast-generate-preview" || normalizedModel === "veo31-video-fast-audio" || normalizedModel === "piapi-veo31-video-fast-audio") {
          piapiVideoModel = "veo31-video-fast-audio";
        } else if (normalizedModel === "veo-3.1-lite-generate-preview" || normalizedModel === "veo31-video-fast-no-audio" || normalizedModel === "piapi-veo31-video-fast-no-audio") {
          piapiVideoModel = "veo31-video-fast-no-audio";
        } else if (normalizedModel.includes("veo-3.1") || normalizedModel.includes("veo31") || normalizedModel.startsWith("veo3")) {
          piapiVideoModel = "veo31-video-audio";
        }
        let promptText = "";
        const referenceImageUris = [];
        const contentsArray = Array.isArray(contents) ? contents : contents && contents.parts ? [{ parts: contents.parts }] : [];
        for (const content of contentsArray) {
          if (content.parts && Array.isArray(content.parts)) {
            for (const part of content.parts) {
              if (part.text) {
                promptText += part.text + "\n";
              } else if (part.inlineData && part.inlineData.data) {
                referenceImageUris.push(`data:${part.inlineData.mimeType || "image/jpeg"};base64,${part.inlineData.data}`);
              } else if (part.fileData && part.fileData.fileUri) {
                referenceImageUris.push(part.fileData.fileUri);
              }
            }
          }
        }
        promptText = promptText.trim();
        const mergedConfig = { ...generationConfig || {}, ...reqConfig || {} };
        const videoConfig = mergedConfig?.videoConfig || mergedConfig?.imageConfig || {};
        const aspectRatio = videoConfig.aspectRatio || mergedConfig.aspectRatio || "16:9";
        const durationSeconds = videoConfig.durationSeconds || mergedConfig.durationSeconds || 5;
        logger.info(`[Gemini Service] Generating video via PiAPI. Model: ${piapiVideoModel}, Aspect: ${aspectRatio}, Duration: ${durationSeconds}s`);
        const piapiVideoRes = await piapiService.generateVideo(
          promptText,
          piapiVideoModel,
          durationSeconds,
          {
            aspectRatio,
            referenceImageUris: referenceImageUris.length > 0 ? referenceImageUris : void 0
          }
        );
        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    fileData: {
                      mimeType: "video/mp4",
                      fileUri: piapiVideoRes.url
                    }
                  }
                ],
                role: "model"
              },
              finishReason: "STOP"
            }
          ]
        };
      }
    }
    if (isGeminiNativeImageModel) {
      if (!apiKey) {
        throw new Error("API Key kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c kh\xF4ng c\xF3 quy\u1EC1n truy c\u1EADp.");
      }
      const ai2 = new import_genai.GoogleGenAI({ apiKey });
      logger.info(`[Gemini Service] Calling Google SDK for Gemini Image model: ${modelName}`);
      let promptText = "";
      const contentsArray = Array.isArray(params.contents) ? params.contents : params.contents && params.contents.parts ? [{ parts: params.contents.parts }] : [];
      for (const content of contentsArray) {
        if (content.parts && Array.isArray(content.parts)) {
          for (const part of content.parts) {
            if (part.text) {
              promptText += part.text + "\n";
            }
          }
        }
      }
      promptText = promptText.trim();
      const imageConfig = params.config?.imageConfig || params.generationConfig?.imageConfig || {};
      const aspectRatio = imageConfig.aspectRatio || "1:1";
      const isFlashVariant = modelName === "nano-banana-2" || modelName === "igen-image-flash" || modelName === "gemini-3.1-flash-image";
      const IMAGE_GEN_MODEL = isFlashVariant ? "gemini-3.1-flash-image" : "gemini-3-pro-image";
      logger.info(`[Gemini Service] Using model: ${IMAGE_GEN_MODEL} (variant: ${isFlashVariant ? "flash" : "pro"}), aspect: ${aspectRatio}`);
      const finalPromptText = aspectRatio && aspectRatio !== "1:1" ? `${promptText}
[Aspect ratio: ${aspectRatio}]` : promptText;
      const response2 = await ai2.models.generateContent({
        model: IMAGE_GEN_MODEL,
        contents: finalPromptText,
        config: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      });
      const parts = response2.candidates?.[0]?.content?.parts || [];
      const imageParts = parts.filter((p) => p.inlineData?.data);
      if (imageParts.length === 0) {
        throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u \u1EA3nh t\u1EEB Gemini Image API.");
      }
      return {
        generatedImages: imageParts.map((p) => ({
          image: {
            imageBytes: p.inlineData.data,
            mimeType: p.inlineData.mimeType || "image/jpeg"
          }
        })),
        // Cũng giữ candidates để tương thích ngược
        candidates: response2.candidates
      };
    }
    if (!apiKey) {
      throw new Error("API Key kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c kh\xF4ng c\xF3 quy\u1EC1n truy c\u1EADp.");
    }
    const ai = new import_genai.GoogleGenAI({ apiKey });
    logger.info(`[Gemini Service] Calling Google SDK for text model: ${modelName}`);
    const rawConfig = params.config || params.generationConfig || {};
    const sanitizedConfig = { ...rawConfig };
    const isThinkingModel = modelName.toLowerCase().includes("thinking");
    if (!isThinkingModel) {
      if ("thinkingConfig" in sanitizedConfig) {
        delete sanitizedConfig.thinkingConfig;
      }
      if ("thinking_config" in sanitizedConfig) {
        delete sanitizedConfig.thinking_config;
      }
    }
    const response = await ai.models.generateContent({
      model: modelName,
      contents: params.contents,
      config: sanitizedConfig
    });
    return response;
  }
};

// server/socket.ts
var import_socket = require("socket.io");
var io = null;
function initSocket(server) {
  const allowedOrigins = process.env.LINK_COR ? process.env.LINK_COR.split(",").map((o) => o.trim()) : ["http://localhost:3000", "http://localhost:5173"];
  io = new import_socket.Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    socket.on("join", (userId) => {
      if (userId) {
        socket.join(userId);
        console.log(`[Socket] User ${userId} joined room ${userId}`);
      }
    });
    socket.on("leave", (userId) => {
      if (userId) {
        socket.leave(userId);
        console.log(`[Socket] User ${userId} left room ${userId}`);
      }
    });
    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
  return io;
}
function emitToUser(userId, event, data) {
  if (io) {
    io.to(userId.toString()).emit(event, data);
  }
}

// server/controller/render-job.controller.ts
var import_joi3 = __toESM(require("joi"), 1);
var createJobSchema = import_joi3.default.object({
  type: import_joi3.default.string().required().messages({ "any.required": "Lo\u1EA1i render l\xE0 b\u1EAFt bu\u1ED9c." }),
  subType: import_joi3.default.string().allow("").optional(),
  inputImageUrls: import_joi3.default.array().items(import_joi3.default.string().uri()).optional(),
  referenceImageUrls: import_joi3.default.array().items(import_joi3.default.string().uri()).optional(),
  prompt: import_joi3.default.string().allow("").optional(),
  model: import_joi3.default.string().allow("").optional(),
  resolution: import_joi3.default.string().valid("1K", "2K", "4K").optional(),
  settings: import_joi3.default.object({
    description: import_joi3.default.string().allow("").optional(),
    style: import_joi3.default.string().allow("").optional(),
    context: import_joi3.default.string().allow("").optional(),
    lighting: import_joi3.default.string().allow("").optional(),
    colorTone: import_joi3.default.string().allow("").optional(),
    prompt: import_joi3.default.string().allow("").optional(),
    numImages: import_joi3.default.number().optional(),
    aspectRatio: import_joi3.default.string().allow("").optional(),
    model: import_joi3.default.string().allow("").optional(),
    resolution: import_joi3.default.string().valid("1K", "2K", "4K").optional()
  }).optional()
}).unknown();
var idParamSchema2 = import_joi3.default.object({
  id: import_joi3.default.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    "string.pattern.base": "ID kh\xF4ng \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng MongoDB ObjectId.",
    "any.required": "ID l\xE0 b\u1EAFt bu\u1ED9c."
  })
});
var limitQuerySchema = import_joi3.default.object({
  limit: import_joi3.default.number().integer().min(1).optional().messages({
    "number.base": "Gi\u1EDBi h\u1EA1n ph\u1EA3i l\xE0 s\u1ED1.",
    "number.integer": "Gi\u1EDBi h\u1EA1n ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn.",
    "number.min": "Gi\u1EDBi h\u1EA1n t\u1ED1i thi\u1EC3u l\xE0 1."
  })
});
var paginationQuerySchema2 = import_joi3.default.object({
  page: import_joi3.default.number().integer().min(1).optional().messages({
    "number.base": "Trang ph\u1EA3i l\xE0 s\u1ED1.",
    "number.integer": "Trang ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn.",
    "number.min": "Trang t\u1ED1i thi\u1EC3u l\xE0 1."
  }),
  limit: import_joi3.default.number().integer().min(1).optional().messages({
    "number.base": "Gi\u1EDBi h\u1EA1n ph\u1EA3i l\xE0 s\u1ED1.",
    "number.integer": "Gi\u1EDBi h\u1EA1n ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn.",
    "number.min": "Gi\u1EDBi h\u1EA1n t\u1ED1i thi\u1EC3u l\xE0 1."
  })
});
var updateJobSchema = import_joi3.default.object({
  status: import_joi3.default.string().valid("pending", "processing", "completed", "failed").required().messages({
    "any.only": "Tr\u1EA1ng th\xE1i kh\xF4ng h\u1EE3p l\u1EC7.",
    "any.required": "Tr\u1EA1ng th\xE1i l\xE0 b\u1EAFt bu\u1ED9c."
  }),
  outputImageUrls: import_joi3.default.array().items(import_joi3.default.string().uri()).optional(),
  progress: import_joi3.default.number().min(0).max(100).optional().messages({
    "number.min": "Ti\u1EBFn tr\xECnh kh\xF4ng \u0111\u01B0\u1EE3c nh\u1ECF h\u01A1n 0.",
    "number.max": "Ti\u1EBFn tr\xECnh kh\xF4ng \u0111\u01B0\u1EE3c l\u1EDBn h\u01A1n 100."
  })
});
var renderJobController = {
  async getMyJobs(req, res) {
    const { error } = limitQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const limit = parseInt(String(req.query.limit || "50"), 10);
      const jobs = await renderJobService.getListByUser(req.user.userId, limit);
      logger.info(`[renderJobController.getMyJobs] Retrieved ${jobs.length} jobs for user: ${req.user.userId}`);
      res.json({ success: true, data: jobs });
    } catch (error2) {
      logger.error(`[renderJobController.getMyJobs] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async getAllJobs(req, res) {
    const { error } = paginationQuerySchema2.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "100"), 10);
      const result = await renderJobService.getAll(page, limit);
      res.json({ success: true, data: result });
    } catch (error2) {
      logger.error(`[renderJobController.getAllJobs] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async createJob(req, res) {
    const { error } = createJobSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const credits = await userService.getCredits(req.user.userId);
      if (credits <= 0) {
        res.status(402).json({ success: false, message: "B\u1EA1n \u0111\xE3 h\u1EBFt Credits. Vui l\xF2ng n\u1EA1p th\xEAm \u0111\u1EC3 ti\u1EBFp t\u1EE5c." });
        return;
      }
      const settings = req.body.settings || {};
      const model = req.body.model || settings.model;
      const prompt = req.body.prompt || settings.prompt;
      const inputImageUrls = req.body.inputImageUrls || [];
      const referenceImageUrls = req.body.referenceImageUrls || [];
      const aspectRatio = req.body.aspectRatio || settings.aspectRatio;
      const resolution = req.body.resolution || settings.resolution || "1K";
      const numImages = req.body.numImages || settings.numImages || 1;
      const GEMINI_NATIVE_MODELS = [
        "nano-banana-2",
        "igen-image-flash",
        "gemini-3.1-flash-image",
        "gemini-3-pro-image"
      ];
      const isGeminiNativeModel = GEMINI_NATIVE_MODELS.includes(model);
      let piapiModel = model || "piapi-flux";
      if (!isGeminiNativeModel && !piapiModel.startsWith("piapi-") && piapiModel !== "nano-banana-pro") {
        piapiModel = "piapi-flux";
      }
      let piapiTaskId = "";
      let status = "pending";
      let progress = 0;
      let outputImageUrls = [];
      let parsedPrompt = prompt || "";
      try {
        const parsed = JSON.parse(prompt);
        parsedPrompt = parsed.prompt_tieng_viet_toi_uu || parsed.optimized_english_prompt || prompt;
      } catch {
      }
      let finalPrompt = parsedPrompt;
      if (inputImageUrls && inputImageUrls.length > 0) {
        finalPrompt = inputImageUrls.join(" ") + " " + finalPrompt;
      }
      const aspect = aspectRatio || "1:1";
      const isGeminiModel = isGeminiNativeModel;
      if (isGeminiModel) {
        try {
          const user = await userService.getById(req.user.userId);
          const userApiKey = user?.apiKey || "";
          logger.info(`[renderJobController] Generating image synchronously via Gemini for model: ${piapiModel}`);
          const generatedUrls = [];
          for (let i = 0; i < numImages; i++) {
            const geminiRes = await geminiService.generate({
              model: model || "gemini-3-pro-image",
              contents: [{ parts: [{ text: finalPrompt }] }],
              config: {
                imageConfig: {
                  aspectRatio: aspect
                }
              }
            }, userApiKey);
            const base64Data = geminiRes.generatedImages?.[0]?.image?.imageBytes;
            if (!base64Data) {
              throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u \u1EA3nh t\u1EEB Imagen API.");
            }
            const fileStr = `data:image/jpeg;base64,${base64Data}`;
            const uploadedUrl = await cloudinaryService.uploadMedia(fileStr, "renders");
            generatedUrls.push(uploadedUrl);
          }
          outputImageUrls = generatedUrls;
          status = "completed";
          progress = 100;
        } catch (apiErr) {
          logger.error(`[renderJobController] Failed to generate Gemini image: ${apiErr}`);
          res.status(500).json({ success: false, message: "Kh\xF4ng th\u1EC3 t\u1EA1o \u1EA3nh t\u1EEB Gemini: " + apiErr.message });
          return;
        }
      } else {
        try {
          logger.info(`[renderJobController] Creating ${numImages} PiAPI tasks for model: ${piapiModel}`);
          const taskIds = [];
          for (let i = 0; i < numImages; i++) {
            const taskResult = await piapiService.createImageTask(finalPrompt, piapiModel, {
              aspectRatio: aspect,
              numImages: 1
              // Generate 1 image per call
            });
            taskIds.push(taskResult.taskId);
          }
          piapiTaskId = taskIds.join(",");
          status = "processing";
          progress = 10;
        } catch (apiErr) {
          logger.error(`[renderJobController] Failed to create PiAPI tasks: ${apiErr}`);
          res.status(500).json({ success: false, message: "Kh\xF4ng th\u1EC3 kh\u1EDFi t\u1EA1o t\xE1c v\u1EE5 tr\xEAn PiAPI: " + apiErr.message });
          return;
        }
      }
      const job = await renderJobService.create({
        userId: req.user.userId,
        type: req.body.type,
        subType: req.body.subType,
        inputImageUrls,
        referenceImageUrls,
        outputImageUrls,
        prompt: finalPrompt,
        model: piapiModel,
        resolution,
        status,
        progress,
        piapiTaskId
      });
      logger.info(`[renderJobController.createJob] Job created successfully: ${job._id} | Model: ${piapiModel} | User: ${req.user.userId}`);
      emitToUser(req.user.userId, "renderJobUpdated", job);
      res.status(201).json({ success: true, data: job });
    } catch (error2) {
      logger.error(`[renderJobController.createJob] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async updateJob(req, res) {
    const paramValidation = idParamSchema2.validate(req.params);
    if (paramValidation.error) {
      res.status(400).json({ success: false, message: paramValidation.error.details[0].message });
      return;
    }
    const { error } = updateJobSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const { status, outputImageUrls, progress } = req.body;
      const job = await renderJobService.updateStatus(req.params.id, status, outputImageUrls, progress);
      if (!job) {
        res.status(404).json({ success: false, message: "Kh\xF4ng t\xECm th\u1EA5y render job." });
        return;
      }
      logger.info(`[renderJobController.updateJob] Job updated successfully: ${job._id} | Status: ${status} | Progress: ${progress}%`);
      emitToUser(job.userId.toString(), "renderJobUpdated", job);
      res.json({ success: true, data: job });
    } catch (error2) {
      logger.error(`[renderJobController.updateJob] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async deleteJob(req, res) {
    const { error } = idParamSchema2.validate(req.params);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const job = await renderJobService.deleteJob(req.params.id);
      if (!job) {
        res.status(404).json({ success: false, message: "Kh\xF4ng t\xECm th\u1EA5y render job." });
        return;
      }
      logger.info(`[renderJobController.deleteJob] Job deleted successfully: ${req.params.id}`);
      res.json({ success: true, message: "\u0110\xE3 x\xF3a render job." });
    } catch (error2) {
      logger.error(`[renderJobController.deleteJob] Error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async deductCredits(req, res) {
    try {
      const { cost, type, model } = req.body;
      if (typeof cost !== "number" || cost <= 0) {
        res.status(400).json({ success: false, message: "S\u1ED1 credits kh\xF4ng h\u1EE3p l\u1EC7." });
        return;
      }
      const remainingCredits = await userService.deductCredits(
        req.user.userId,
        cost,
        type || "text",
        model || "unknown"
      );
      logger.log("info", `[renderJobController.deductCredits] Deducted ${cost} credits for user: ${req.user.userId}. Remaining: ${remainingCredits}`);
      res.json({ success: true, data: { remainingCredits } });
    } catch (error) {
      logger.error(`[renderJobController.deductCredits] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      const statusCode = errMsg.includes("h\u1EBFt Credits") ? 402 : 500;
      res.status(statusCode).json({ success: false, message: errMsg });
    }
  }
};

// server/router/render-job.router.ts
var router3 = (0, import_express3.Router)();
router3.post("/deduct-credits", authMiddleware, renderJobController.deductCredits);
router3.get("/all", authMiddleware, adminMiddleware, renderJobController.getAllJobs);
router3.get("/", authMiddleware, renderJobController.getMyJobs);
router3.post("/", authMiddleware, renderJobController.createJob);
router3.patch("/:id", authMiddleware, renderJobController.updateJob);
router3.delete("/:id", authMiddleware, renderJobController.deleteJob);

// server/router/media.router.ts
var import_express4 = require("express");

// server/controller/media.controller.ts
var import_joi4 = __toESM(require("joi"), 1);
var uploadSchema = import_joi4.default.object({
  file: import_joi4.default.string().required().messages({ "any.required": "D\u1EEF li\u1EC7u file l\xE0 b\u1EAFt bu\u1ED9c." }),
  folder: import_joi4.default.string().allow("").optional()
});
var deleteMediaSchema = import_joi4.default.object({
  publicId: import_joi4.default.string().required().messages({
    "any.required": "publicId l\xE0 b\u1EAFt bu\u1ED9c."
  })
});
var mediaController = {
  async upload(req, res) {
    const { error } = uploadSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const { file, folder } = req.body;
      const folderPath = folder || `igen_architect/${req.user.userId}`;
      const url = await cloudinaryService.uploadMedia(file, folderPath);
      logger.info(`[mediaController.upload] Uploaded media successfully. Folder: ${folderPath} | User: ${req.user.userId}`);
      res.json({ success: true, data: { url, secure_url: url } });
    } catch (error2) {
      logger.error(`[mediaController] Upload error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "T\u1EA3i l\xEAn th\u1EA5t b\u1EA1i.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
  async deleteMedia(req, res) {
    const { error } = deleteMediaSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      let { publicId } = req.body;
      if (publicId && (publicId.startsWith("http://") || publicId.startsWith("https://"))) {
        const extracted = cloudinaryService.extractPublicId(publicId);
        if (extracted) {
          publicId = extracted;
        }
      }
      await cloudinaryService.deleteMedia(publicId);
      logger.info(`[mediaController.deleteMedia] Deleted media successfully. PublicId: ${publicId} | User: ${req.user.userId}`);
      res.json({ success: true, message: "\u0110\xE3 x\xF3a media th\xE0nh c\xF4ng." });
    } catch (error2) {
      logger.error(`[mediaController.deleteMedia] Delete media error: ${error2}`);
      const errMsg = error2 instanceof Error ? error2.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  }
};

// server/router/media.router.ts
var router4 = (0, import_express4.Router)();
router4.post("/upload", authMiddleware, mediaController.upload);
router4.delete("/", authMiddleware, mediaController.deleteMedia);

// server/router/piapi.router.ts
var import_express5 = require("express");

// server/controller/piapi.controller.ts
var import_joi5 = __toESM(require("joi"), 1);
var webhookSchema = import_joi5.default.object({
  task_id: import_joi5.default.string().required().messages({
    "any.required": "task_id l\xE0 b\u1EAFt bu\u1ED9c."
  }),
  status: import_joi5.default.string().valid("pending", "processing", "completed", "failed").required().messages({
    "any.only": "Tr\u1EA1ng th\xE1i kh\xF4ng h\u1EE3p l\u1EC7.",
    "any.required": "Tr\u1EA1ng th\xE1i l\xE0 b\u1EAFt bu\u1ED9c."
  }),
  progress: import_joi5.default.number().min(0).max(100).optional().messages({
    "number.min": "Ti\u1EBFn tr\xECnh kh\xF4ng h\u1EE3p l\u1EC7.",
    "number.max": "Ti\u1EBFn tr\xECnh kh\xF4ng h\u1EE3p l\u1EC7."
  }),
  output: import_joi5.default.object({
    image_urls: import_joi5.default.array().items(import_joi5.default.string().uri()).optional(),
    image_url: import_joi5.default.string().uri().optional(),
    video_url: import_joi5.default.string().uri().optional(),
    video: import_joi5.default.string().uri().optional(),
    url: import_joi5.default.string().uri().optional()
  }).unknown(true).allow(null).optional(),
  error: import_joi5.default.string().allow(null, "").optional()
}).unknown(true);
var piapiController = {
  /**
   * Xử lý webhook cập nhật trạng thái tác vụ gửi từ PiAPI
   */
  async handleWebhook(req, res) {
    const { error } = webhookSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const { task_id, status, progress, output, error: taskError } = req.body;
      console.log(`[PiAPI Webhook] Received status update for task ${task_id}: ${status}`);
      const job = await RenderJobModel.findOne({ piapiTaskId: task_id });
      if (!job) {
        console.warn(`[PiAPI Webhook] Render job not found for task_id: ${task_id}`);
        res.json({ success: true, message: "Kh\xF4ng t\xECm th\u1EA5y render job t\u01B0\u01A1ng \u1EE9ng." });
        return;
      }
      if (job.status === "completed" || job.status === "failed") {
        console.log(`[PiAPI Webhook] Job ${job._id} is already in final state: ${job.status}`);
        res.json({ success: true });
        return;
      }
      if (status === "completed" && output) {
        const rawUrl = output.image_urls && output.image_urls[0] || output.image_url || output.url || output.video || output.video_url;
        if (!rawUrl) {
          res.status(400).json({ success: false, message: "Kh\xF4ng t\xECm th\u1EA5y URL k\u1EBFt qu\u1EA3 trong output." });
          return;
        }
        console.log(`[PiAPI Webhook] Task ${task_id} completed. Uploading image to Cloudinary...`);
        let finalUrl = rawUrl;
        try {
          finalUrl = await cloudinaryService.uploadMedia(rawUrl, "renders");
          console.log(`[PiAPI Webhook] Uploaded to Cloudinary: ${finalUrl}`);
        } catch (uploadErr) {
          console.error(`[PiAPI Webhook] Cloudinary upload failed for task ${task_id}:`, uploadErr);
        }
        job.status = "completed";
        job.progress = 100;
        job.outputImageUrls = [finalUrl];
        await job.save();
        emitToUser(job.userId.toString(), "renderJobUpdated", job);
        console.log(`[PiAPI Webhook] Job ${job._id} marked as completed.`);
      } else if (status === "failed") {
        console.error(`[PiAPI Webhook] Task ${task_id} failed:`, taskError);
        job.status = "failed";
        job.progress = 100;
        await job.save();
        emitToUser(job.userId.toString(), "renderJobUpdated", job);
        console.log(`[PiAPI Webhook] Job ${job._id} marked as failed.`);
      } else if (status === "processing" && progress !== void 0) {
        const newProgress = Math.max(job.progress || 0, progress);
        if (newProgress !== job.progress) {
          job.progress = newProgress;
          job.status = "processing";
          await job.save();
          emitToUser(job.userId.toString(), "renderJobUpdated", job);
        }
      }
      res.json({ success: true });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
      console.error("[PiAPI Webhook] Internal Error:", err);
      res.status(500).json({ success: false, message: errMsg });
    }
  }
};

// server/router/piapi.router.ts
var router5 = (0, import_express5.Router)();
router5.post("/webhook", piapiController.handleWebhook);

// server/router/gemini.router.ts
var import_express6 = require("express");

// server/controller/gemini.controller.ts
var import_joi6 = __toESM(require("joi"), 1);
var generateSchema = import_joi6.default.object({
  params: import_joi6.default.object({
    model: import_joi6.default.string().required().messages({
      "any.required": "T\xEAn model l\xE0 b\u1EAFt bu\u1ED9c.",
      "string.base": "T\xEAn model ph\u1EA3i l\xE0 chu\u1ED7i k\xFD t\u1EF1."
    }),
    contents: import_joi6.default.any().required().messages({
      "any.required": "D\u1EEF li\u1EC7u contents l\xE0 b\u1EAFt bu\u1ED9c."
    }),
    config: import_joi6.default.object().optional(),
    generationConfig: import_joi6.default.object().optional(),
    systemInstruction: import_joi6.default.any().optional()
  }).required().messages({
    "any.required": "Tham s\u1ED1 params l\xE0 b\u1EAFt bu\u1ED9c."
  })
});
var geminiController = {
  async generate(req, res) {
    const { error } = generateSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const { params } = req.body;
      const userApiKey = req.headers["x-user-api-key"] || req.headers["X-User-Api-Key"] || req.body.userApiKey || "";
      logger.info(`[Gemini Controller] Handling generate request for model: ${params?.model}, hasUserKey: ${!!userApiKey}`);
      const response = await geminiService.generate(params, userApiKey);
      return res.status(200).json({
        success: true,
        data: response
      });
    } catch (err) {
      const error2 = err;
      logger.error(`[Gemini Controller] Error: ${error2.message}`);
      const statusCode = error2.status || 500;
      let errMsg = error2.message || "L\u1ED7i x\u1EED l\xFD y\xEAu c\u1EA7u AI.";
      if (statusCode === 403) {
        errMsg = "D\u1EF1 \xE1n Google Cloud c\u1EE7a b\u1EA1n b\u1ECB t\u1EEB ch\u1ED1i truy c\u1EADp API Gemini. Vui l\xF2ng ki\u1EC3m tra l\u1EA1i API Key ho\u1EB7c li\xEAn h\u1EC7 h\u1ED7 tr\u1EE3.";
      } else if (statusCode === 400) {
        errMsg = "Tham s\u1ED1 y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c b\u1ECB t\u1EEB ch\u1ED1i b\u1EDFi quy t\u1EAFc an to\xE0n c\u1EE7a Google AI.";
      } else if (statusCode === 429) {
        errMsg = "Y\xEAu c\u1EA7u v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n t\u1EA7n su\u1EA5t (Rate Limit) c\u1EE7a API Key. Vui l\xF2ng th\u1EED l\u1EA1i sau.";
      } else if (statusCode === 503) {
        errMsg = "D\u1ECBch v\u1EE5 AI c\u1EE7a Gemini hi\u1EC7n \u0111ang qu\xE1 t\u1EA3i ho\u1EB7c t\u1EA1m th\u1EDDi kh\xF4ng kh\u1EA3 d\u1EE5ng. Vui l\xF2ng th\u1EED l\u1EA1i sau.";
      }
      return res.status(statusCode).json({
        success: false,
        message: errMsg,
        details: error2.message
      });
    }
  }
};

// server/router/gemini.router.ts
var router6 = (0, import_express6.Router)();
router6.post("/generate", authMiddleware, geminiController.generate);

// server/router/index.ts
var router7 = (0, import_express7.Router)();
router7.use("/auth", router);
router7.use("/users", router2);
router7.use("/render-jobs", router3);
router7.use("/media", router4);
router7.use("/piapi", router5);
router7.use("/gemini", router6);
router7.get("/health", (req, res) => {
  const dbStatus = import_mongoose8.default.connection.readyState === 1 ? "connected" : "disconnected";
  const status = dbStatus === "connected" ? "ok" : "error";
  res.status(status === "ok" ? 200 : 500).json({
    status,
    db: dbStatus,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime()
  });
});

// server/swagger/auth.swagger.ts
var authSwagger = {
  "/auth/register": {
    post: {
      tags: ["Auth"],
      summary: "\u0110\u0103ng k\xFD t\xE0i kho\u1EA3n m\u1EDBi",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: { type: "string", example: "test@example.com" },
                password: { type: "string", example: "password123" },
                displayName: { type: "string", example: "Nguyen Van A" }
              }
            }
          }
        }
      },
      responses: {
        201: { description: "\u0110\u0103ng k\xFD th\xE0nh c\xF4ng" },
        400: { description: "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7" }
      }
    }
  },
  "/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "\u0110\u0103ng nh\u1EADp b\u1EB1ng email/password",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: { type: "string", example: "test@example.com" },
                password: { type: "string", example: "password123" }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "\u0110\u0103ng nh\u1EADp th\xE0nh c\xF4ng v\xE0 set httpOnly cookie" },
        401: { description: "Sai th\xF4ng tin \u0111\u0103ng nh\u1EADp" }
      }
    }
  },
  "/auth/refresh-token": {
    post: {
      tags: ["Auth"],
      summary: "L\u1EA5y access token m\u1EDBi b\u1EB1ng refresh token t\u1EEB cookie",
      responses: {
        200: { description: "Refresh token th\xE0nh c\xF4ng" },
        401: { description: "Kh\xF4ng c\xF3 refresh token ho\u1EB7c kh\xF4ng h\u1EE3p l\u1EC7" }
      }
    }
  },
  "/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "L\u1EA5y th\xF4ng tin t\xE0i kho\u1EA3n hi\u1EC7n t\u1EA1i",
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: "Th\xE0nh c\xF4ng" },
        401: { description: "Ch\u01B0a x\xE1c th\u1EF1c" }
      }
    }
  },
  "/auth/logout": {
    post: {
      tags: ["Auth"],
      summary: "\u0110\u0103ng xu\u1EA5t t\xE0i kho\u1EA3n (x\xF3a cookie)",
      responses: {
        200: { description: "\u0110\u0103ng xu\u1EA5t th\xE0nh c\xF4ng" }
      }
    }
  }
};

// server/swagger/user.swagger.ts
var userSwagger = {
  "/users": {
    get: {
      tags: ["User"],
      summary: "L\u1EA5y danh s\xE1ch ng\u01B0\u1EDDi d\xF9ng (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50 } }
      ],
      responses: {
        200: { description: "Th\xE0nh c\xF4ng" },
        401: { description: "Ch\u01B0a x\xE1c th\u1EF1c" },
        403: { description: "Kh\xF4ng c\xF3 quy\u1EC1n admin" }
      }
    }
  },
  "/users/{id}": {
    get: {
      tags: ["User"],
      summary: "L\u1EA5y th\xF4ng tin chi ti\u1EBFt ng\u01B0\u1EDDi d\xF9ng b\u1EB1ng ID (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: { description: "Th\xE0nh c\xF4ng" },
        404: { description: "Kh\xF4ng t\xECm th\u1EA5y user" }
      }
    },
    delete: {
      tags: ["User"],
      summary: "X\xF3a ng\u01B0\u1EDDi d\xF9ng (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: { description: "X\xF3a th\xE0nh c\xF4ng" },
        404: { description: "Kh\xF4ng t\xECm th\u1EA5y user" }
      }
    }
  },
  "/users/me/api-key": {
    patch: {
      tags: ["User"],
      summary: "C\u1EADp nh\u1EADt API Key c\u1EE7a ch\xEDnh m\xECnh (User)",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["apiKey"],
              properties: { apiKey: { type: "string", example: "your-gemini-key" } }
            }
          }
        }
      },
      responses: {
        200: { description: "C\u1EADp nh\u1EADt th\xE0nh c\xF4ng" }
      }
    }
  },
  "/users/{id}/role": {
    patch: {
      tags: ["User"],
      summary: "C\u1EADp nh\u1EADt vai tr\xF2 ng\u01B0\u1EDDi d\xF9ng (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["role"],
              properties: { role: { type: "string", enum: ["user", "admin", "superadmin"] } }
            }
          }
        }
      },
      responses: {
        200: { description: "C\u1EADp nh\u1EADt th\xE0nh c\xF4ng" }
      }
    }
  },
  "/users/{id}/credits": {
    patch: {
      tags: ["User"],
      summary: "C\u1EADp nh\u1EADt credits c\u1EE7a ng\u01B0\u1EDDi d\xF9ng (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["credits"],
              properties: { credits: { type: "number", example: 100 } }
            }
          }
        }
      },
      responses: {
        200: { description: "C\u1EADp nh\u1EADt th\xE0nh c\xF4ng" }
      }
    }
  },
  "/users/{id}/api-key": {
    patch: {
      tags: ["User"],
      summary: "C\u1EADp nh\u1EADt API Key ng\u01B0\u1EDDi d\xF9ng (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["apiKey"],
              properties: { apiKey: { type: "string" } }
            }
          }
        }
      },
      responses: {
        200: { description: "C\u1EADp nh\u1EADt th\xE0nh c\xF4ng" }
      }
    }
  },
  "/users/transactions": {
    get: {
      tags: ["User"],
      summary: "L\u1EA5y t\u1EA5t c\u1EA3 c\xE1c giao d\u1ECBch (Admin)",
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: "Th\xE0nh c\xF4ng" }
      }
    }
  }
};

// server/swagger/render-job.swagger.ts
var renderJobSwagger = {
  "/render-jobs": {
    get: {
      tags: ["Render Job"],
      summary: "L\u1EA5y danh s\xE1ch render jobs c\u1EE7a user hi\u1EC7n t\u1EA1i",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 50 } }],
      responses: {
        200: { description: "Th\xE0nh c\xF4ng" }
      }
    },
    post: {
      tags: ["Render Job"],
      summary: "T\u1EA1o render job m\u1EDBi",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["type"],
              properties: {
                type: { type: "string", example: "render" },
                subType: { type: "string", example: "exterior" },
                inputImageUrls: { type: "array", items: { type: "string" } },
                referenceImageUrls: { type: "array", items: { type: "string" } },
                prompt: { type: "string", example: "modern villa" },
                model: { type: "string", example: "gemini" },
                resolution: { type: "string", enum: ["1K", "2K", "4K"], default: "1K" }
              }
            }
          }
        }
      },
      responses: {
        201: { description: "T\u1EA1o th\xE0nh c\xF4ng" }
      }
    }
  },
  "/render-jobs/{id}": {
    patch: {
      tags: ["Render Job"],
      summary: "C\u1EADp nh\u1EADt tr\u1EA1ng th\xE1i/output c\u1EE7a render job",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["pending", "processing", "completed", "failed"] },
                outputImageUrls: { type: "array", items: { type: "string" } },
                progress: { type: "number", example: 100 }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "C\u1EADp nh\u1EADt th\xE0nh c\xF4ng" }
      }
    },
    delete: {
      tags: ["Render Job"],
      summary: "X\xF3a render job",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: { description: "X\xF3a th\xE0nh c\xF4ng" }
      }
    }
  },
  "/render-jobs/deduct-credits": {
    post: {
      tags: ["Render Job"],
      summary: "Tr\u1EEB credits ng\u01B0\u1EDDi d\xF9ng sau khi d\xF9ng AI",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["cost"],
              properties: {
                cost: { type: "number", example: 1 },
                type: { type: "string", example: "text" },
                model: { type: "string", example: "gemini-1.5-pro" }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "Tr\u1EEB credits th\xE0nh c\xF4ng" },
        402: { description: "Kh\xF4ng \u0111\u1EE7 credits" }
      }
    }
  }
};

// server/swagger/media.swagger.ts
var mediaSwagger = {
  "/media/upload": {
    post: {
      tags: ["Media"],
      summary: "Upload file l\xEAn Cloudinary",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["file"],
              properties: {
                file: { type: "string", description: "Base64 string c\u1EE7a file" },
                folder: { type: "string", default: "igen-architect" }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "Upload th\xE0nh c\xF4ng" }
      }
    }
  },
  "/media": {
    delete: {
      tags: ["Media"],
      summary: "X\xF3a file tr\xEAn Cloudinary b\u1EB1ng public ID ho\u1EB7c URL",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["publicId"],
              properties: {
                publicId: { type: "string", example: "igen-architect/abc" }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "X\xF3a th\xE0nh c\xF4ng" }
      }
    }
  }
};

// server/swagger/piapi.swagger.ts
var piapiSwagger = {
  "/piapi/webhook": {
    post: {
      tags: ["PiAPI"],
      summary: "Webhook nh\u1EADn c\u1EADp nh\u1EADt tr\u1EA1ng th\xE1i t\u1EEB PiAPI",
      description: "\u0110\u01B0\u1EE3c g\u1ECDi b\u1EDFi PiAPI \u0111\u1EC3 c\u1EADp nh\u1EADt tr\u1EA1ng th\xE1i c\xF4ng vi\u1EC7c k\u1EBFt xu\u1EA5t.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["task_id", "status"],
              properties: {
                task_id: { type: "string", description: "M\xE3 \u0111\u1ECBnh danh t\xE1c v\u1EE5 PiAPI" },
                status: {
                  type: "string",
                  enum: ["pending", "processing", "completed", "failed"],
                  description: "Tr\u1EA1ng th\xE1i t\xE1c v\u1EE5"
                },
                progress: { type: "integer", minimum: 0, maximum: 100, description: "Ti\u1EBFn tr\xECnh k\u1EBFt xu\u1EA5t (%)" },
                output: {
                  type: "object",
                  properties: {
                    image_urls: { type: "array", items: { type: "string" }, description: "M\u1EA3ng ch\u1EE9a li\xEAn k\u1EBFt h\xECnh \u1EA3nh k\u1EBFt qu\u1EA3" },
                    image_url: { type: "string" },
                    video_url: { type: "string" },
                    video: { type: "string" },
                    url: { type: "string" }
                  }
                },
                error: { type: "string", description: "Chi ti\u1EBFt l\u1ED7i n\u1EBFu c\xF3", nullable: true }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Nh\u1EADn webhook th\xE0nh c\xF4ng",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true }
                }
              }
            }
          }
        },
        400: { description: "L\u1ED7i ki\u1EC3m tra d\u1EEF li\u1EC7u \u0111\u1EA7u v\xE0o (Validation)" },
        500: { description: "L\u1ED7i x\u1EED l\xFD n\u1ED9i b\u1ED9 c\u1EE7a Server" }
      }
    }
  }
};

// server/swagger/index.ts
var swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "iGen AI Architect Assistant API Documentation",
    version: "1.0.0",
    description: "T\xE0i li\u1EC7u API cho h\u1EC7 th\u1ED1ng iGen AI Architect Assistant"
  },
  servers: [
    {
      url: "/api/v1",
      description: "API Version 1 Endpoint"
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "\u0110i\u1EC1n Access Token v\xE0o \u0111\xE2y (kh\xF4ng c\u1EA7n ch\u1EEF Bearer)"
      }
    }
  },
  paths: {
    ...authSwagger,
    ...userSwagger,
    ...renderJobSwagger,
    ...mediaSwagger,
    ...piapiSwagger
  }
};

// server/service/polling.service.ts
var pollingService = {
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
    }, 15e3);
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
              return { status: "failed", progress: 0, error: String(err) };
            }
          })
        );
        const completedResults = results.filter((r) => r.status === "completed");
        const failedResults = results.filter((r) => r.status === "failed");
        const processingResults = results.filter((r) => r.status === "processing" || r.status === "pending");
        console.log(`[Polling Service] Polled Job ${job._id} (${taskIds.length} tasks) -> Completed: ${completedResults.length}, Failed: ${failedResults.length}, Processing: ${processingResults.length}`);
        if (completedResults.length + failedResults.length === taskIds.length) {
          if (completedResults.length > 0) {
            console.log(`[Polling Service] Tasks completed. Uploading ${completedResults.length} images to Cloudinary...`);
            const uploadedUrls = [];
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
            job.status = "failed";
            job.progress = 100;
            await job.save();
            emitToUser(job.userId.toString(), "renderJobUpdated", job);
            console.log(`[Polling Service] Job ${job._id} marked as failed.`);
          }
        } else {
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

// server.ts
import_dotenv2.default.config();
async function startServer() {
  await connectDB();
  pollingService.init();
  const app = (0, import_express8.default)();
  app.use(loggerMiddleware);
  const server = (0, import_http.createServer)(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  initSocket(server);
  app.use((0, import_cookie_parser.default)());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = (process.env.LINK_COR || "").split(",").map((o) => o.trim());
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-User-Api-Key,x-user-api-key");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(import_express8.default.json({ limit: "50mb" }));
  app.use("/api-docs", import_swagger_ui_express.default.serve, import_swagger_ui_express.default.setup(swaggerDocument));
  app.use("/api/v1", router7);
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/proxy-image", async (req, res) => {
    const url = req.query.url;
    if (!url) {
      res.status(400).send("Missing url parameter");
      return;
    }
    try {
      const fetchRes = await fetch(url);
      if (!fetchRes.ok) {
        res.status(fetchRes.status).send(`HTTP ${fetchRes.status}`);
        return;
      }
      const buffer = await fetchRes.arrayBuffer();
      res.setHeader("Content-Type", fetchRes.headers.get("content-type") || "application/octet-stream");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(Buffer.from(buffer));
    } catch (e) {
      res.status(500).send(String(e));
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express8.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.use((err, req, res, _next) => {
    logger.error(`[UNHANDLED ERROR] ${req.method} ${req.originalUrl}: ${err}`);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "\u0110\xE3 c\xF3 l\u1ED7i h\u1EC7 th\u1ED1ng x\u1EA3y ra." });
    }
  });
  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
