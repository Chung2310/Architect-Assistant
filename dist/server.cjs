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
  async updateApiKey(userId, _apiKey) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { apiKey: "", hasSetupApiKey: true },
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
async function fetchImageAsBase64(url) {
  if (url.startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`H\xECnh \u1EA3nh \u0111\u1EA7u v\xE0o kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c \u0111\xE3 b\u1ECB x\xF3a kh\u1ECFi Cloudinary (m\xE3 l\u1ED7i: ${response.status}). Vui l\xF2ng t\u1EA3i l\u1EA1i \u1EA3nh m\u1EDBi l\xEAn.`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = response.headers.get("content-type") || "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
var piapiService = {
  /**
   * Tạo task sinh ảnh bất đồng bộ trên PiAPI
   */
  async createImageTask(prompt, model, options) {
    const openRouterKey = process.env.OPENROUTER_API_KEY || "";
    const openRouterModels = [
      "google/gemini-3.1-flash-image",
      "google/gemini-3-pro-image",
      "google/gemini-3.1-flash-image-preview",
      "google/gemini-3-pro-image-preview"
    ];
    const isMatchedModel = model === "nano-banana-2" || model === "igen-image-flash" || model === "nano-banana-pro" || openRouterModels.includes(model);
    if (openRouterKey && isMatchedModel) {
      console.log(`[OpenRouter Image Task] Creating image synchronously for model: ${model}`);
      let openRouterModel;
      if (openRouterModels.includes(model)) {
        openRouterModel = model;
      } else if (model === "nano-banana-pro") {
        openRouterModel = "google/gemini-3-pro-image";
      } else {
        openRouterModel = "google/gemini-3.1-flash-image";
      }
      const allowedAspects = [
        "1:1",
        "1:4",
        "1:8",
        "2:3",
        "3:2",
        "3:4",
        "4:1",
        "4:3",
        "4:5",
        "5:4",
        "8:1",
        "9:16",
        "16:9",
        "21:9"
      ];
      let aspect2 = options?.aspectRatio || "1:1";
      if (aspect2 === "T\u1EF1 \u0111\u1ED9ng" || aspect2 === "auto" || !allowedAspects.includes(aspect2)) {
        aspect2 = "1:1";
      }
      const headers = {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://staging-architect.igentechsolutions.com",
        "X-Title": "iGen Architect Assistant"
      };
      const content = [{ type: "text", text: prompt }];
      if (options?.image) {
        try {
          console.log(`[OpenRouter Image Task] Converting image to base64 for OpenRouter: ${options.image}`);
          const base64Image = await fetchImageAsBase64(options.image);
          content.push({
            type: "image_url",
            image_url: {
              url: base64Image
            }
          });
        } catch (fetchErr) {
          console.error(`[OpenRouter Image Task] Failed to convert image to base64:`, fetchErr);
          throw fetchErr;
        }
      }
      const body = {
        model: openRouterModel,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
        image_config: {
          aspect_ratio: aspect2
        }
      };
      try {
        console.log(`[OpenRouter Image Task] Requesting OpenRouter chat completions endpoint. Model: ${openRouterModel}`);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter image generation failed: ${response.status} - ${errorText}`);
        }
        const json = await response.json();
        console.log("[OpenRouter Image Debug] Raw response:", JSON.stringify(json).slice(0, 1e3));
        const images = json.choices?.[0]?.message?.images;
        let imgUrl = "";
        if (Array.isArray(images) && images.length > 0) {
          imgUrl = images[0]?.image_url?.url;
        }
        if (!imgUrl) {
          const messageContent = json.choices?.[0]?.message?.content;
          if (typeof messageContent === "string") {
            if (messageContent.startsWith("http") || messageContent.startsWith("data:")) {
              imgUrl = messageContent;
            }
          } else if (Array.isArray(messageContent)) {
            for (const part of messageContent) {
              if (part?.type === "image_url" && part?.image_url?.url) {
                imgUrl = part.image_url.url;
                break;
              }
              if (part?.type === "image" && part?.source?.data) {
                imgUrl = `data:${part.source.media_type || "image/png"};base64,${part.source.data}`;
                break;
              }
            }
          }
        }
        let finalImageUrl = "";
        if (imgUrl) {
          finalImageUrl = await cloudinaryService.uploadMedia(imgUrl, "renders");
        } else {
          throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u h\xECnh \u1EA3nh t\u1EEB OpenRouter Image API");
        }
        console.log(`[OpenRouter Image Task] Successfully generated and uploaded image: ${finalImageUrl}`);
        const seed = Math.floor(Math.random() * 1e6);
        return {
          taskId: `openrouter-${seed}`,
          isMock: false,
          outputUrl: finalImageUrl
        };
      } catch (error) {
        console.error("[OpenRouter Image Task] Error generating image:", error);
        throw error;
      }
    }
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
    const isFloorplanJob = String(options?.jobType || "").toLowerCase().includes("floorplan") || String(options?.jobType || "").toLowerCase().includes("masterplan");
    const isNanoModel = model === "nano-banana-2" || model === "igen-image-flash" || model === "nano-banana-pro" || model.startsWith("google/gemini-3.1-flash-image") || model.startsWith("google/gemini-3-pro-image");
    if (isNanoModel) {
      let taskType = model === "igen-image-flash" ? "nano-banana-2" : model;
      if (taskType.includes("pro-image")) {
        taskType = "nano-banana-pro";
      } else if (taskType.includes("flash-image")) {
        taskType = "nano-banana-2";
      }
      const hasImage = !!options?.image;
      reqBody = {
        model: "gemini",
        task_type: taskType,
        input: {
          prompt,
          output_format: "png",
          aspect_ratio: aspect,
          resolution: "1K",
          number_of_images: options?.numImages || 1,
          seed: randomSeed,
          ...hasImage ? { image: options.image, strength: isFloorplanJob ? 0.85 : 0.35 } : {}
        }
      };
    } else {
      let piapiModel = model.replace("piapi-", "");
      if (piapiModel === "flux") {
        piapiModel = "Qubico/flux1-dev";
      }
      let finalPrompt = prompt;
      if (piapiModel === "midjourney") {
        if (!prompt.includes("--seed")) {
          finalPrompt = `${prompt} --seed ${randomSeed}`;
        }
        if (options?.image && !finalPrompt.includes("--iw") && !isFloorplanJob) {
          finalPrompt = `${finalPrompt} --iw 2.0`;
        }
      }
      const hasImage = !!options?.image && piapiModel !== "midjourney";
      reqBody = {
        model: piapiModel,
        task_type: piapiModel === "midjourney" ? "imagine" : hasImage ? "img2img" : "txt2img",
        input: {
          prompt: finalPrompt,
          aspect_ratio: aspect,
          number_of_images: options?.numImages || 1,
          seed: randomSeed,
          ...options?.image ? { image: options.image } : {},
          ...hasImage ? { strength: isFloorplanJob ? 0.85 : 0.35 } : {}
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
    if (taskResult.outputUrl) {
      return { url: taskResult.outputUrl, isMock: false };
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
function extractTextFromContents(contents) {
  const contentsArray = Array.isArray(contents) ? contents : contents && typeof contents === "object" && "parts" in contents ? [contents] : [];
  let promptText = "";
  for (const content of contentsArray) {
    if (content && typeof content === "object" && "parts" in content) {
      const parts = content.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (typeof part?.text === "string") {
            promptText += part.text + "\n";
          }
        }
      }
    }
  }
  return promptText.trim();
}
function summarizeContents(contents) {
  if (typeof contents === "string") {
    return `string:${contents.slice(0, 120)}`;
  }
  if (!Array.isArray(contents)) {
    return "non-array";
  }
  return contents.map((content, index) => {
    if (!content || typeof content !== "object" || !("parts" in content)) {
      return `item${index}:no-parts`;
    }
    const parts = content.parts || [];
    const partSummary = parts.map((part) => {
      if (typeof part?.text === "string") return "text";
      if (part?.inlineData) return "inlineData";
      if (part?.fileData) return "fileData";
      return "other";
    });
    return `item${index}:${partSummary.join(",")}`;
  }).join(" | ");
}
function mapToOpenRouterModel(modelName) {
  if (!modelName) {
    return "google/gemini-2.5-flash";
  }
  if (modelName.includes("/")) {
    return modelName;
  }
  const name = modelName.toLowerCase().trim();
  const mapping = {
    "gemini-2.5-flash": "google/gemini-2.5-flash",
    "gemini-2.0-flash": "google/gemini-2.0-flash",
    "gemini-1.5-flash": "google/gemini-flash-1.5",
    "gemini-1.5-pro": "google/gemini-pro-1.5",
    "gemini-1.5-flash-8b": "google/gemini-flash-1.5-8b",
    "gemini-2.0-flash-exp": "google/gemini-2.0-flash-exp",
    "gemini-2.0-flash-thinking-exp": "google/gemini-2.0-flash-thinking-exp",
    "gemini-2.0-pro-exp": "google/gemini-2.0-pro-exp",
    "gemini-2.5-pro": "google/gemini-2.5-pro"
  };
  if (mapping[name]) {
    return mapping[name];
  }
  return `google/${modelName}`;
}
async function callOpenRouterChat(messages, model, openRouterKey, isJsonRequested) {
  const requestBody = {
    model,
    messages
  };
  if (isJsonRequested) {
    requestBody.response_format = { type: "json_object" };
  }
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://staging-architect.igentechsolutions.com",
      "X-Title": "iGen Architect Assistant"
    },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
  }
  const data = await response.json();
  const textResult = data.choices?.[0]?.message?.content || "";
  return { textResult, data };
}
async function callOpenRouterImage(prompt, model, openRouterKey, aspectRatio, inputImageBase64, inputImageMimeType) {
  const headers = {
    "Authorization": `Bearer ${openRouterKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://staging-architect.igentechsolutions.com",
    "X-Title": "iGen Architect Assistant"
  };
  const content = [{ type: "text", text: prompt }];
  if (inputImageBase64) {
    const mime = inputImageMimeType || "image/jpeg";
    const dataUri = `data:${mime};base64,${inputImageBase64}`;
    content.push({
      type: "image_url",
      image_url: {
        url: dataUri
      }
    });
  }
  const allowedAspects = [
    "1:1",
    "1:4",
    "1:8",
    "2:3",
    "3:2",
    "3:4",
    "4:1",
    "4:3",
    "4:5",
    "5:4",
    "8:1",
    "9:16",
    "16:9",
    "21:9"
  ];
  let aspect = aspectRatio || "1:1";
  if (aspect === "T\u1EF1 \u0111\u1ED9ng" || aspect === "auto" || !allowedAspects.includes(aspect)) {
    aspect = "1:1";
  }
  const body = {
    model,
    messages: [{ role: "user", content }],
    modalities: ["image", "text"],
    image_config: {
      aspect_ratio: aspect
    }
  };
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter image generation failed: ${response.status} - ${errorText}`);
  }
  const json = await response.json();
  const images = json.choices?.[0]?.message?.images;
  let imgUrl = "";
  if (Array.isArray(images) && images.length > 0) {
    imgUrl = images[0]?.image_url?.url;
  }
  if (!imgUrl) {
    const messageContent = json.choices?.[0]?.message?.content;
    if (typeof messageContent === "string") {
      if (messageContent.startsWith("http") || messageContent.startsWith("data:")) {
        imgUrl = messageContent;
      }
    } else if (Array.isArray(messageContent)) {
      for (const part of messageContent) {
        if (part?.type === "image_url" && part?.image_url?.url) {
          imgUrl = part.image_url.url;
          break;
        }
        if (part?.type === "image" && part?.source?.data) {
          imgUrl = `data:${part.source.media_type || "image/png"};base64,${part.source.data}`;
          break;
        }
      }
    }
  }
  if (!imgUrl) {
    throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u h\xECnh \u1EA3nh t\u1EEB OpenRouter Image API");
  }
  return imgUrl;
}
var geminiService = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async generate(params, _userApiKey) {
    const modelName = params.model || "";
    const systemInstruction = params.systemInstruction || params.config?.systemInstruction || params.generationConfig?.systemInstruction;
    const isImageModel = modelName.includes("image-preview") || modelName.includes("imagen") || modelName.includes("generateImages") || modelName.includes("banana");
    const isVideoModel = modelName.includes("veo");
    const isGeminiNativeImageModel = modelName === "gemini-3-pro-image" || modelName === "gemini-3.1-flash-image" || modelName === "gemini-3.1-flash-image-preview" || modelName.startsWith("imagen-");
    let apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
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
    const openRouterKey = process.env.OPENROUTER_API_KEY || "";
    logger.info(
      `[Gemini Service] Request summary - model: ${modelName}, hasSystemInstruction: ${!!systemInstruction}, contents: ${summarizeContents(params.contents)}`
    );
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
        if (systemInstruction) {
          promptText = `${String(systemInstruction).trim()}

${promptText}`.trim();
        }
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
        logger.info(`[Gemini Service] Provider: PiAPI image. Model: ${targetModel}, Aspect: ${aspectRatio}`);
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
        if (systemInstruction) {
          promptText = `${String(systemInstruction).trim()}

${promptText}`.trim();
        }
        const mergedConfig = { ...generationConfig || {}, ...reqConfig || {} };
        const videoConfig = mergedConfig?.videoConfig || mergedConfig?.imageConfig || {};
        const aspectRatio = videoConfig.aspectRatio || mergedConfig.aspectRatio || "16:9";
        const durationSeconds = videoConfig.durationSeconds || mergedConfig.durationSeconds || 5;
        logger.info(`[Gemini Service] Provider: PiAPI video. Model: ${piapiVideoModel}, Aspect: ${aspectRatio}, Duration: ${durationSeconds}s`);
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
      const ai = new import_genai.GoogleGenAI({ apiKey });
      logger.info(`[Gemini Service] Provider: Gemini native image. Requested model: ${modelName}`);
      const imageConfig = params.config?.imageConfig || params.generationConfig?.imageConfig || {};
      const aspectRatio = imageConfig.aspectRatio || "1:1";
      const isFlashVariant = modelName === "gemini-3.1-flash-image" || modelName === "gemini-3.1-flash-image-preview";
      const IMAGE_GEN_MODEL = isFlashVariant ? "gemini-3.1-flash-image" : "gemini-3-pro-image";
      logger.info(`[Gemini Service] Using model: ${IMAGE_GEN_MODEL} (variant: ${isFlashVariant ? "flash" : "pro"}), aspect: ${aspectRatio}`);
      const contentsArray = Array.isArray(params.contents) ? params.contents : params.contents ? [params.contents] : [];
      const aspectRatioPart = aspectRatio && aspectRatio !== "1:1" ? [{ text: `[Aspect ratio: ${aspectRatio}]` }] : [];
      const finalContents = contentsArray.length > 0 ? contentsArray.map((content, index) => {
        if (index === contentsArray.length - 1 && content && typeof content === "object" && "parts" in content && Array.isArray(content.parts)) {
          const typedContent = content;
          return {
            role: typedContent.role,
            parts: [...typedContent.parts, ...aspectRatioPart]
          };
        }
        return content;
      }) : typeof params.contents === "string" ? `${params.contents}${aspectRatioPart.length > 0 ? `
[Aspect ratio: ${aspectRatio}]` : ""}` : extractTextFromContents(params.contents);
      const imageConfigForSdk = {
        responseModalities: ["TEXT", "IMAGE"]
      };
      if (systemInstruction) {
        imageConfigForSdk.systemInstruction = systemInstruction;
      }
      let response;
      try {
        response = await ai.models.generateContent({
          model: IMAGE_GEN_MODEL,
          contents: finalContents,
          config: imageConfigForSdk
        });
      } catch (err) {
        const errStr = err?.message || JSON.stringify(err) || "";
        const statusCode = err?.status || err?.statusCode || 0;
        logger.error(`[Gemini Service] Native Image generation failed (Status: ${statusCode}, Msg: ${errStr}).`);
        const fallbackOpenRouterKey = process.env.OPENROUTER_API_KEY || "";
        if (fallbackOpenRouterKey) {
          const fallbackFluxModel = process.env.OPENROUTER_FALLBACK_IMAGE_MODEL || "black-forest-labs/flux.2-pro";
          logger.info(`[Gemini Service] Fallback: calling Flux model (${fallbackFluxModel}) via OpenRouter due to Gemini Native Image failure...`);
          try {
            let promptText = "";
            let inputImageBase64 = "";
            let inputImageMimeType = "";
            const contentsArray2 = Array.isArray(params.contents) ? params.contents : params.contents && params.contents.parts ? [{ parts: params.contents.parts }] : [];
            for (const content of contentsArray2) {
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
            if (systemInstruction) {
              promptText = `${String(systemInstruction).trim()}

${promptText}`.trim();
            }
            const imageUrl = await callOpenRouterImage(
              promptText,
              fallbackFluxModel,
              fallbackOpenRouterKey,
              aspectRatio,
              inputImageBase64,
              inputImageMimeType
            );
            const imgFetchRes = await fetch(imageUrl);
            if (!imgFetchRes.ok) {
              throw new Error(`Failed to download generated Flux image: ${imgFetchRes.status}`);
            }
            const arrayBuffer = await imgFetchRes.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            const mimeType = imgFetchRes.headers.get("content-type") || "image/png";
            logger.info(`[Gemini Service] Fallback Flux image generated and downloaded successfully.`);
            return {
              generatedImages: [
                {
                  image: {
                    imageBytes: base64,
                    mimeType
                  }
                }
              ],
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
          } catch (fallbackErr) {
            logger.error(`[Gemini Service] Fallback to Flux via OpenRouter also failed: ${fallbackErr.message || fallbackErr}`);
            throw err;
          }
        } else {
          throw err;
        }
      }
      const parts = response.candidates?.[0]?.content?.parts || [];
      const imageParts3 = parts.filter((p) => p.inlineData?.data);
      if (imageParts3.length === 0) {
        throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u \u1EA3nh t\u1EEB m\xF4 h\xECnh native c\u1EE7a Gemini.");
      }
      return {
        generatedImages: imageParts3.map((p) => ({
          image: {
            imageBytes: p.inlineData.data,
            mimeType: p.inlineData.mimeType || "image/jpeg"
          }
        })),
        // Cũng giữ candidates để tương thích ngược
        candidates: response.candidates
      };
    }
    if (!isImageModel && !isVideoModel) {
      const messages = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: String(systemInstruction) });
      }
      const contentsArr = Array.isArray(params.contents) ? params.contents : params.contents ? [params.contents] : [];
      for (const item of contentsArr) {
        if (!item || typeof item !== "object") continue;
        const role = item.role === "model" ? "assistant" : "user";
        const parts = item.parts || [];
        const text = parts.map((p) => p.text || "").join("");
        if (text.trim()) messages.push({ role, content: text.trim() });
      }
      if (messages.length === 0) {
        const rawText = extractTextFromContents(params.contents);
        if (rawText) messages.push({ role: "user", content: rawText });
      }
      const isJsonRequested = params.config?.responseMimeType === "application/json" || params.generationConfig?.responseMimeType === "application/json" || params.config?.response_mime_type === "application/json";
      const fallbackQwenModel = process.env.OPENROUTER_FALLBACK_MODEL || "qwen/qwen-2.5-72b-instruct";
      const performQwenFallback = async (primaryError) => {
        if (!openRouterKey) {
          throw primaryError;
        }
        logger.warn(`[Gemini Service] Fallback: calling Qwen model (${fallbackQwenModel}) via OpenRouter API due to primary error: ${primaryError.message || primaryError}`);
        try {
          if (messages.length === 0) {
            throw new Error("Kh\xF4ng c\xF3 n\u1ED9i dung \u0111\u1EC3 g\u1EEDi \u0111\u1EBFn OpenRouter.");
          }
          const { textResult } = await callOpenRouterChat(messages, fallbackQwenModel, openRouterKey, isJsonRequested);
          logger.info(`[Gemini Service] Fallback OpenRouter Qwen response received (${textResult.length} chars): ${textResult.slice(0, 100)}...`);
          return {
            candidates: [{
              content: {
                parts: [{ text: textResult }],
                role: "model"
              },
              finishReason: "STOP"
            }],
            text: textResult
          };
        } catch (fallbackErr) {
          logger.error(`[Gemini Service] Fallback to Qwen via OpenRouter also failed: ${fallbackErr.message || fallbackErr}`);
          throw primaryError;
        }
      };
      const hasValidNativeKey = apiKey && isValidGeminiKey(apiKey);
      if (hasValidNativeKey) {
        const ai = new import_genai.GoogleGenAI({ apiKey });
        logger.info(`[Gemini Service] Provider: Gemini Native. Model: ${modelName}`);
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
        if (systemInstruction && !("systemInstruction" in sanitizedConfig)) {
          sanitizedConfig.systemInstruction = systemInstruction;
        }
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: params.contents,
            config: sanitizedConfig
          });
          return response;
        } catch (err) {
          logger.error(`[Gemini Service] Gemini Native API call failed: ${err.message || err}`);
          return await performQwenFallback(err);
        }
      } else if (openRouterKey) {
        const openRouterModel = mapToOpenRouterModel(modelName);
        logger.info(`[Gemini Service] Provider: OpenRouter (Primary). Model: ${openRouterModel}`);
        try {
          if (messages.length === 0) {
            throw new Error("Kh\xF4ng c\xF3 n\u1ED9i dung \u0111\u1EC3 g\u1EEDi \u0111\u1EBFn OpenRouter.");
          }
          const { textResult } = await callOpenRouterChat(messages, openRouterModel, openRouterKey, isJsonRequested);
          logger.info(`[Gemini Service] OpenRouter Gemini response received (${textResult.length} chars): ${textResult.slice(0, 100)}...`);
          return {
            candidates: [{
              content: {
                parts: [{ text: textResult }],
                role: "model"
              },
              finishReason: "STOP"
            }],
            text: textResult
          };
        } catch (err) {
          logger.error(`[Gemini Service] Gemini via OpenRouter failed: ${err.message || err}`);
          return await performQwenFallback(err);
        }
      } else {
        throw new Error("Kh\xF4ng t\xECm th\u1EA5y API Key h\u1EE3p l\u1EC7 cho Gemini Native ho\u1EB7c OpenRouter.");
      }
    }
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
function appendFloorplanCleanupDirective(type, prompt) {
  const normalizedType = String(type || "").toLowerCase().trim();
  if (normalizedType !== "floorplan to 3d" && normalizedType !== "floorplan to 3d floorplan") {
    return prompt;
  }
  const cleanupDirective = " IMPORTANT: chi giu bo cuc khong gian, tuong, cua, cua so, cau thang va vi tri noi that theo ban ve. Tuyet doi khong duoc them, bot, doi cho, tach, noi, mo rong, thu hep, xoay hoac tai cau truc bat ky thanh phan kien truc nao so voi ban ve goc. Xoa hoan toan moi chu, nhan phong, so kich thuoc, hatch, net dut, ky hieu CAD, mui ten, khung ten, watermark va moi dau vet do hoa 2D cua ban ve goc. Anh cuoi phai la phoi canh 3D sach, khong con annotation hay text ky thuat.";
  if (prompt.includes(cleanupDirective.trim())) {
    return prompt;
  }
  return `${prompt}${cleanupDirective}`;
}
function appendFloorplanNegativePrompt(type, prompt) {
  const normalizedType = String(type || "").toLowerCase().trim();
  if (normalizedType !== "floorplan to 3d" && normalizedType !== "floorplan to 3d floorplan") {
    return prompt;
  }
  const negativePrompt = " Negative prompt: no text, no room labels, no dimensions, no dimension lines, no annotations, no arrows, no hatch patterns, no CAD lines, no dashed lines, no blueprint look, no technical drawing overlay, no title block, no watermark, no 2D graphic remnants, no missing walls, no extra walls, no shifted doors, no shifted windows, no altered room boundaries, no changed circulation, no invented architectural elements, no deleted architectural elements.";
  if (prompt.includes(negativePrompt.trim())) {
    return prompt;
  }
  return `${prompt}${negativePrompt}`;
}
function appendFloorplanCameraDirective(type, prompt) {
  const normalizedType = String(type || "").toLowerCase().trim();
  if (normalizedType !== "floorplan to 3d") {
    return prompt;
  }
  const cameraDirective = " Camera angle: eye-level (ngang tam mat), shot from room entrance, no bird's eye view, no top-down, no panorama from above. All furniture must remain in exact positions from the floorplan.";
  if (prompt.includes("eye-level") || prompt.includes("ngang tam mat")) {
    return prompt;
  }
  return `${prompt}${cameraDirective}`;
}
function extractPromptPayload(rawPrompt) {
  const fallback = {
    finalPrompt: rawPrompt || "",
    negativePrompt: ""
  };
  try {
    const parsed = JSON.parse(rawPrompt);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    const promptObject = parsed;
    return {
      finalPrompt: String(
        promptObject.prompt_tieng_viet_toi_uu || promptObject.optimized_english_prompt || rawPrompt || ""
      ),
      negativePrompt: String(
        promptObject.prompt_phu_dinh || promptObject.negative_prompt || ""
      )
    };
  } catch {
    return fallback;
  }
}
function buildGeminiImageContents(promptText, inputImageUrls, referenceImageUrls) {
  const parts = [];
  if (inputImageUrls.length > 0) {
    parts.push({ text: "Reference floorplan images to preserve exactly:" });
    for (const url of inputImageUrls) {
      parts.push({
        fileData: {
          mimeType: "image/jpeg",
          fileUri: url
        }
      });
    }
  }
  if (referenceImageUrls.length > 0) {
    parts.push({ text: "Additional reference images:" });
    for (const url of referenceImageUrls) {
      parts.push({
        fileData: {
          mimeType: "image/jpeg",
          fileUri: url
        }
      });
    }
  }
  parts.push({ text: promptText });
  return [{ role: "user", parts }];
}
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
  async getJobById(req, res) {
    const paramValidation = idParamSchema2.validate(req.params);
    if (paramValidation.error) {
      res.status(400).json({ success: false, message: paramValidation.error.details[0].message });
      return;
    }
    try {
      const jobId = req.params.id;
      const job = await renderJobService.getById(jobId);
      if (!job) {
        res.status(404).json({ success: false, message: "Kh\xF4ng t\xECm th\u1EA5y render job." });
        return;
      }
      if (job.userId.toString() !== req.user.userId) {
        res.status(403).json({ success: false, message: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n truy c\u1EADp render job n\xE0y." });
        return;
      }
      res.json({ success: true, data: job });
    } catch (error) {
      logger.error(`[renderJobController.getJobById] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra.";
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
        "gemini-3.1-flash-image",
        "gemini-3-pro-image"
      ];
      const isGeminiNativeModel = GEMINI_NATIVE_MODELS.includes(model);
      let piapiModel = model || "piapi-flux";
      if (!isGeminiNativeModel && !piapiModel.startsWith("piapi-") && piapiModel !== "nano-banana-pro" && piapiModel !== "nano-banana-2" && piapiModel !== "igen-image-flash") {
        piapiModel = "piapi-flux";
      }
      logger.info(`[renderJobController.createJob] Model: ${model} | piapiModel: ${piapiModel} | type: ${req.body.type}`);
      logger.info(`[renderJobController.createJob] inputImageUrls: ${JSON.stringify(inputImageUrls)} | referenceImageUrls: ${JSON.stringify(referenceImageUrls)}`);
      let piapiTaskId = "";
      let status = "pending";
      let progress = 0;
      let outputImageUrls = [];
      const promptPayload = extractPromptPayload(prompt || "");
      const parsedPrompt = promptPayload.finalPrompt;
      const parsedNegativePrompt = promptPayload.negativePrompt;
      let finalPrompt = parsedPrompt;
      if (!isGeminiNativeModel && inputImageUrls && inputImageUrls.length > 0) {
        finalPrompt = inputImageUrls.join(" ") + " " + finalPrompt;
      }
      if (parsedNegativePrompt) {
        finalPrompt = `${finalPrompt}
Negative prompt: ${parsedNegativePrompt}`;
      }
      finalPrompt = appendFloorplanCleanupDirective(req.body.type, finalPrompt);
      finalPrompt = appendFloorplanNegativePrompt(req.body.type, finalPrompt);
      finalPrompt = appendFloorplanCameraDirective(req.body.type, finalPrompt);
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
              contents: buildGeminiImageContents(
                finalPrompt,
                inputImageUrls,
                referenceImageUrls
              ),
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
          const generatedUrls = [];
          let hasOutputUrl = false;
          for (let i = 0; i < numImages; i++) {
            const taskResult = await piapiService.createImageTask(finalPrompt, piapiModel, {
              aspectRatio: aspect,
              numImages: 1,
              // Generate 1 image per call
              image: inputImageUrls && inputImageUrls.length > 0 ? inputImageUrls[0] : void 0,
              jobType: req.body.type
            });
            taskIds.push(taskResult.taskId);
            if (taskResult.outputUrl) {
              generatedUrls.push(taskResult.outputUrl);
              hasOutputUrl = true;
            }
          }
          piapiTaskId = taskIds.join(",");
          if (hasOutputUrl) {
            outputImageUrls = generatedUrls;
            status = "completed";
            progress = 100;
          } else {
            status = "processing";
            progress = 10;
          }
        } catch (apiErr) {
          logger.error(`[renderJobController] Failed to create image generation tasks: ${apiErr}`);
          res.status(500).json({ success: false, message: "Kh\xF4ng th\u1EC3 kh\u1EDFi t\u1EA1o t\xE1c v\u1EE5 sinh \u1EA3nh: " + apiErr.message });
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
router3.get("/:id", authMiddleware, renderJobController.getJobById);
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

// server/service/prompt-template-pass3.service.ts
function imageParts(images = []) {
  return images.map((image) => ({
    inlineData: {
      data: image.data,
      mimeType: image.mimeType || "image/jpeg"
    }
  }));
}
function resolvePass3PromptTemplate(templateKey, input) {
  switch (templateKey) {
    case "sync_character_composite_prompt":
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts(input.images || []),
              {
                text: `B\u1EA1n l\xE0 chuy\xEAn gia gh\xE9p nh\xE2n v\u1EADt v\xE0o b\u1ED1i c\u1EA3nh ki\u1EBFn tr\xFAc theo c\xE1ch si\xEAu th\u1EF1c.
Nhi\u1EC7m v\u1EE5:
- Gi\u1EEF nguy\xEAn khu\xF4n m\u1EB7t, v\xF3c d\xE1ng, qu\u1EA7n \xE1o v\xE0 nh\u1EADn di\u1EC7n c\u1EE7a ch\u1EE7 th\u1EC3 tham kh\u1EA3o.
- N\u1EBFu y\xEAu c\u1EA7u ng\u01B0\u1EDDi d\xF9ng tr\u1ED1ng, t\u1EF1 suy lu\u1EADn v\u1ECB tr\xED v\xE0 t\u01B0 th\u1EBF ph\xF9 h\u1EE3p v\u1EDBi \u1EA3nh n\u1EC1n.
- \u0110\u1ED3ng b\u1ED9 tuy\u1EC7t \u0111\u1ED1i \xE1nh s\xE1ng, m\xE0u m\xF4i tr\u01B0\u1EDDng, \u0111\u1ED5 b\xF3ng ti\u1EBFp x\xFAc v\xE0 ph\u1ED1i c\u1EA3nh.
- Cho ph\xE9p vi ch\u1EC9nh r\u1EA5t nh\u1EB9 v\u1EADt th\u1EC3 n\u1EC1n n\u1EBFu c\u1EA7n \u0111\u1EC3 t\u1EA1o ti\u1EBFp x\xFAc v\u1EADt l\xFD h\u1EE3p l\xFD.
- Kh\xF4ng \u0111\u1EC3 ch\u1EE7 th\u1EC3 b\u1ECB d\xE1n l\xEAn \u1EA3nh, l\u01A1 l\u1EEDng, sai t\u1EF7 l\u1EC7 ho\u1EB7c l\u1EC7ch h\u01B0\u1EDBng s\xE1ng.

Y\xEAu c\u1EA7u ng\u01B0\u1EDDi d\xF9ng: ${String(input.userAction || "")}`
              }
            ]
          }
        ],
        config: {
          imageConfig: input.imageConfig
        }
      };
    case "utility_layout_prompt": {
      const toolName = String(input.toolName || "");
      const selectedStyle = String(input.selectedStyle || "Kh\xF4ng c\xF3");
      let systemInstruction = "";
      const projectName = String(input.projectName || "ARCHITECTURAL PRESENTATION");
      let prompt = `T\u1EA1o m\u1ED9t advanced architectural presentation board kh\u1ED5 d\u1ECDc 3:4 cho c\xF4ng tr\xECnh tham kh\u1EA3o theo phong c\xE1ch ${selectedStyle}. C\xF3 ti\xEAu \u0111\u1EC1 ${projectName}, b\u1ED1 c\u1EE5c 3 c\u1ED9t d\xE0y th\xF4ng tin, massing evolution, axonometric, n\u1ED9i th\u1EA5t, m\u1EB7t b\u1EB1ng, m\u1EB7t \u0111\u1EE9ng v\xE0 footer \u0111\u1ED3 \xE1n.`;
      if (toolName === "Presentation Board") {
        systemInstruction = "B\u1EA1n l\xE0 chuy\xEAn gia thi\u1EBFt k\u1EBF \u0111\u1ED3 h\u1ECDa ki\u1EBFn tr\xFAc b\u1EADc th\u1EA7y. T\u1EA5t c\u1EA3 ch\u1EEF v\xE0 ch\xFA th\xEDch xu\u1EA5t hi\u1EC7n trong \u1EA3nh ph\u1EA3i b\u1EB1ng ti\u1EBFng Vi\u1EC7t r\xF5 r\xE0ng, tr\xECnh b\xE0y nh\u01B0 m\u1ED9t b\u1EA3ng thuy\u1EBFt tr\xECnh ki\u1EBFn tr\xFAc cao c\u1EA5p.";
        prompt = `T\u1EA1o m\u1ED9t b\u1EA3ng thuy\u1EBFt tr\xECnh ki\u1EBFn tr\xFAc ho\xE0n ch\u1EC9nh theo phong c\xE1ch ${selectedStyle}. \u1EA2nh ch\xEDnh l\xE0 c\xF4ng tr\xECnh tham kh\u1EA3o, xung quanh c\xF3 c\xE1c s\u01A1 \u0111\u1ED3 ph\xE2n t\xEDch, m\u1EB7t b\u1EB1ng, chi ti\u1EBFt v\u1EADt li\u1EC7u v\xE0 ch\xFA th\xEDch ti\u1EBFng Vi\u1EC7t s\u1EAFc n\xE9t. B\u1ED1 c\u1EE5c s\u1EA1ch, c\xE2n \u0111\u1ED1i, tr\xECnh b\xE0y nh\u01B0 poster ki\u1EBFn tr\xFAc chuy\xEAn nghi\u1EC7p.`;
      } else if (toolName === "Overall") {
        prompt = `Bi\u1EBFn c\xF4ng tr\xECnh tham kh\u1EA3o th\xE0nh m\u1ED9t b\u1EA3ng tr\xECnh b\xE0y t\u1ED5ng th\u1EC3 landscape 16:9 theo phong c\xE1ch ${selectedStyle}. \u1EA2nh ph\u1EA3i ph\u1EE7 k\xEDn n\u1EC1n, c\xF3 ti\xEAu \u0111\u1EC1 ki\u1EBFn tr\xFAc sang tr\u1ECDng, hai inset ph\xE2n t\xEDch nh\u1ECF, b\u1ED1 c\u1EE5c editorial cao c\u1EA5p, \u0111\u1ED3ng b\u1ED9 th\u1EA9m m\u1EF9.`;
      } else if (toolName === "Layout") {
        prompt = `T\u1EA1o m\u1ED9t competition board landscape 16:9 cho c\xF4ng tr\xECnh tham kh\u1EA3o theo phong c\xE1ch ${selectedStyle}. Trung t\xE2m l\xE0 exploded axonometric, xung quanh c\xF3 s\u01A1 \u0111\u1ED3 massing, m\u1EB7t c\u1EAFt, context map v\xE0 c\xE1c text block ng\u1EAFn, b\u1ED1 c\u1EE5c theo l\u01B0\u1EDBi Swiss Grid nghi\xEAm ng\u1EB7t.`;
      } else if (toolName === "Interior Moodboard") {
        prompt = `T\u1EA1o m\u1ED9t interior moodboard landscape cao c\u1EA5p cho kh\xF4ng gian tham kh\u1EA3o theo phong c\xE1ch ${selectedStyle}. Ph\u1EA3i c\xF3 hero render, material swatches, isometric cutaway v\xE0 v\xE0i furniture cutout n\u1ED5i tr\xEAn n\u1EC1n, b\u1ED1 c\u1EE5c catalogue hi\u1EC7n \u0111\u1EA1i.`;
      }
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts(input.images || []),
              { text: prompt }
            ]
          }
        ],
        systemInstruction: systemInstruction || void 0,
        config: {
          ...input.requestConfig
        }
      };
    }
    case "utility_process_prompt":
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts(input.images || []),
              { text: String(input.userPrompt || "") }
            ]
          }
        ],
        systemInstruction: String(input.systemInstruction || ""),
        generationConfig: {
          imageConfig: {
            aspectRatio: String(input.aspectRatio || "1:1"),
            imageSize: String(input.imageSize || "1K")
          }
        }
      };
    case "virtual_staging_prompt": {
      const mode = String(input.mode || "virtual");
      const roomType = String(input.roomType || "");
      const style = String(input.style || "");
      const requestNotes = String(input.requestNotes || "");
      const extraPrompt = String(input.extraPrompt || "");
      const shapesDescription = String(input.shapesDescription || "");
      const basePrompt = mode === "virtual" ? `B\u1EA1n l\xE0 chuy\xEAn gia thi\u1EBFt k\u1EBF n\u1ED9i th\u1EA5t v\xE0 d\xE0n d\u1EF1ng kh\xF4ng gian. H\xE3y th\u1EF1c hi\u1EC7n virtual staging cho c\u0103n ph\xF2ng tr\u1ED1ng n\xE0y theo phong c\xE1ch ${style}, c\xF4ng n\u0103ng ${roomType}. B\u1ED5 sung n\u1ED9i th\u1EA5t cao c\u1EA5p, \xE1nh s\xE1ng chuy\xEAn nghi\u1EC7p v\xE0 v\u1EADt li\u1EC7u ch\xE2n th\u1EF1c, nh\u01B0ng ph\u1EA3i gi\u1EEF chu\u1EA9n h\xECnh h\u1ECDc kh\xF4ng gian g\u1ED1c.` : shapesDescription ? "B\u1EA1n l\xE0 chuy\xEAn gia c\u1EA3i t\u1EA1o n\u1ED9i th\u1EA5t ch\xEDnh x\xE1c theo v\xF9ng ch\u1ECDn. Ch\u1EC9 \u0111\u01B0\u1EE3c ch\u1EC9nh s\u1EEDa b\xEAn trong c\xE1c marker \u0111\xE3 \u0111\xE1nh d\u1EA5u, m\u1ECDi khu v\u1EF1c ngo\xE0i marker ph\u1EA3i gi\u1EEF nguy\xEAn 1:1 so v\u1EDBi \u1EA3nh g\u1ED1c." : "B\u1EA1n l\xE0 chuy\xEAn gia c\u1EA3i t\u1EA1o n\u1ED9i th\u1EA5t. H\xE3y c\u1EA3i t\u1EA1o kh\xF4ng gian theo ghi ch\xFA ng\u01B0\u1EDDi d\xF9ng nh\u01B0ng ph\u1EA3i gi\u1EEF nguy\xEAn layout, c\u1EA5u tr\xFAc ki\u1EBFn tr\xFAc v\xE0 c\xE1c \u0111\u1ED3 v\u1EADt kh\xF4ng \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u thay \u0111\u1ED5i.";
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts(input.images || []),
              {
                text: `${basePrompt}
${shapesDescription}
Ghi ch\xFA ng\u01B0\u1EDDi d\xF9ng: ${requestNotes || "Kh\xF4ng c\xF3"}
Y\xEAu c\u1EA7u b\u1ED5 sung: ${extraPrompt || "Kh\xF4ng c\xF3"}`
              }
            ]
          }
        ],
        systemInstruction: [
          "T\u1EA5t c\u1EA3 suy lu\u1EADn ph\u1EA3i \u01B0u ti\xEAn b\u1EA3o to\xE0n ph\u1ED1i c\u1EA3nh, t\u1EF7 l\u1EC7, c\u1EA5u tr\xFAc kh\xF4ng gian v\xE0 \xE1nh s\xE1ng th\u1EF1c t\u1EBF.",
          "N\u1EBFu l\xE0 ch\u1EC9nh s\u1EEDa ch\u1ECDn v\xF9ng, tuy\u1EC7t \u0111\u1ED1i kh\xF4ng l\xE0m thay \u0111\u1ED5i \u0111\u1ED3 v\u1EADt, c\xE2y xanh, v\u1EADt d\u1EE5ng hay chi ti\u1EBFt ngo\xE0i v\xF9ng \u0111\xE1nh d\u1EA5u.",
          "\u0110\u1EA7u ra ph\u1EA3i l\xE0 \u1EA3nh n\u1ED9i th\u1EA5t ch\xE2n th\u1EF1c, s\u1EA1ch l\u1ED7i, kh\xF4ng m\xE9o h\xECnh, kh\xF4ng th\xEAm v\u1EADt th\u1EC3 v\xF4 l\xFD."
        ].join(" ")
      };
    }
    default:
      return null;
  }
}

// server/service/prompt-template.service.ts
function normalizeKey(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function imageParts2(images = []) {
  return images.map((image) => ({
    inlineData: {
      data: image.data,
      mimeType: image.mimeType || "image/jpeg"
    }
  }));
}
function objectSchema(properties, required) {
  return {
    type: "OBJECT",
    properties,
    required
  };
}
function stringField(description) {
  return { type: "STRING", description };
}
function numberField() {
  return { type: "NUMBER" };
}
function isPhotorealStyle(style) {
  const normalizedStyle = normalizeKey(style);
  return normalizedStyle.includes("anh chup thuc te") || normalizedStyle.includes("phoi canh thuc te") || normalizedStyle.includes("photoreal") || normalizedStyle.includes("realistic");
}
function buildPhotorealismDirective(style, subject) {
  if (!isPhotorealStyle(style)) return "";
  const subjectLabel = subject === "exterior" ? "ngoai that cong trinh" : "noi that cong trinh";
  return [
    `\u01AFu ti\xEAn ng\xF4n ng\u1EEF \u1EA3nh ch\u1EE5p ${subjectLabel} ch\xE2n th\u1EF1c, kh\xF4ng ph\u1EA3i CGI hay concept art.`,
    "M\xF4 t\u1EA3 nh\u01B0 \u1EA3nh ch\u1EE5p b\u1EB1ng m\xE1y \u1EA3nh full-frame chuy\xEAn nghi\u1EC7p, ph\u1ED1i c\u1EA3nh t\u1EF1 nhi\xEAn, v\u1EADt li\u1EC7u \u0111\xFAng scale, \u0111\u1ED9 sau \u1EA3nh h\u1EE3p l\xFD.",
    "B\u1EAFt bu\u1ED9c th\u1EC3 hi\u1EC7n b\u1EC1 m\u1EB7t c\xF3 vi sai th\u1EF1c t\u1EBF: m\xE9p v\u1EADt li\u1EC7u s\u1EAFc v\u1EEBa ph\u1EA3i, ph\u1EA3n x\u1EA1 k\xEDnh h\u1EE3p l\xFD, b\xF3ng \u0111\u1ED5 m\u1EC1m \u0111\xFAng h\u01B0\u1EDBng s\xE1ng, texture kh\xF4ng l\u1EB7p l\u1EA1i.",
    "\xC1nh s\xE1ng ph\u1EA3i gi\u1ED1ng \u1EA3nh \u0111\u1EDDi th\u1EF1c \u0111\xE3 h\u1EADu k\u1EF3 nh\u1EB9: dynamic range c\xE2n b\u1EB1ng, white balance t\u1EF1 nhi\xEAn, kh\xF4ng glow gi\u1EA3, kh\xF4ng vi\u1EC1n s\xE1ng \u1EA3o.",
    "Cho ph\xE9p c\xE1c d\u1EA5u hi\u1EC7u realism m\u1EE9c nh\u1EB9 nh\u01B0 \u0111\u1ED9 nh\xF2e v\u1EADt li\u1EC7u, sai s\u1ED1 thi c\xF4ng nh\u1ECF, b\u1EE5i b\u1EC1 m\u1EB7t r\u1EA5t nh\u1EB9, c\xE2y c\u1ED1i v\xE0 ng\u01B0\u1EDDi n\u1EBFu c\xF3 ph\u1EA3i d\xF9ng t\u1EF7 l\u1EC7 th\u1EF1c.",
    "Tr\xE1nh tuy\u1EC7t \u0111\u1ED1i c\u1EA3m gi\xE1c render AI: oversharpen, b\u1EC1 m\u1EB7t nh\u0169, v\u1EADt li\u1EC7u qu\xE1 s\u1EA1ch, \u0111\u1ED1i x\u1EE9ng ho\xE0n h\u1EA3o, \xE1nh s\xE1ng s\xE0n kh\xE2u, m\xE0u qu\xE1 n\u1ED3ng, chi ti\u1EBFt b\u1ECBa th\xEAm."
  ].join(" ");
}
function buildPhotorealNegativePrompt(style) {
  if (!isPhotorealStyle(style)) return "";
  return [
    "CGI",
    "3D render look",
    "concept art",
    "surreal",
    "plastic materials",
    "waxy surfaces",
    "fake reflections",
    "repeated textures",
    "oversaturated colors",
    "excessive contrast",
    "HDR overprocessed",
    "bloom",
    "glow",
    "floating objects",
    "warped geometry",
    "distorted perspective",
    "inconsistent scale",
    "perfect symmetry",
    "sterile surfaces",
    "artificial lighting",
    "game-engine look"
  ].join(", ");
}
function buildFloorplanCleanupDirective(mode) {
  if (mode === "space") {
    return [
      "\u0110\xE2y l\xE0 \u1EA3nh render \u0111\u01B0\u1EE3c di\u1EC5n gi\u1EA3i t\u1EEB b\u1EA3n v\u1EBD, kh\xF4ng ph\u1EA3i \u1EA3nh ch\u1EE5p l\u1EA1i b\u1EA3n v\u1EBD.",
      "Ch\u1EC9 \u0111\u01B0\u1EE3c gi\u1EEF logic b\u1ED1 tr\xED, v\u1ECB tr\xED t\u01B0\u1EDDng, c\u1EEDa, c\u1EEDa s\u1ED5, l\u1ED1i \u0111i v\xE0 n\u1ED9i th\u1EA5t theo floorplan.",
      "Tuy\u1EC7t \u0111\u1ED1i kh\xF4ng \u0111\u01B0\u1EE3c th\xEAm, b\u1EDBt, \u0111\u1ED5i ch\u1ED7, t\xE1ch, n\u1ED1i, m\u1EDF r\u1ED9ng, thu h\u1EB9p hay xoay b\u1EA5t k\u1EF3 th\xE0nh ph\u1EA7n ki\u1EBFn tr\xFAc n\xE0o so v\u1EDBi b\u1EA3n v\u1EBD g\u1ED1c.",
      "Ki\u1EBFn tr\xFAc l\xE0 r\xE0ng bu\u1ED9c c\xF9ng: t\u01B0\u1EDDng, v\xE1ch, c\u1ED9t, l\u1ED1i \u0111i, c\u1EEDa \u0111i, c\u1EEDa s\u1ED5, th\xF4ng t\u1EA7ng, thang, s\xE0n trong, l\u1ED7 gia, l\u1ED1i tho\xE1t hi\u1EC3m, WC, h\u1ED9p k\u1EF9 thu\u1EADt, l\xF5i giao th\xF4ng v\xE0 ranh gi\u1EDBi ph\xF2ng ph\u1EA3i gi\u1EEF nguy\xEAn v\u1ECB tr\xED v\xE0 quan h\u1EC7 kh\xF4ng gian.",
      "Ph\u1EA3i x\xF3a ho\xE0n to\xE0n m\u1ECDi d\u1EA5u v\u1EBFt \u0111\u1ED3 h\u1ECDa c\u1EE7a b\u1EA3n v\u1EBD g\u1ED1c: ch\u1EEF, nh\xE3n ph\xF2ng, k\xEDch th\u01B0\u1EDBc, dimension line, m\u0169i t\xEAn, hatch, n\xE9t \u0111\u1EE9t, vien CAD, k\xFD hi\u1EC7u v\u1EADt li\u1EC7u, k\xFD hi\u1EC7u k\u1EF9 thu\u1EADt, khung t\xEAn, watermark.",
      "Kh\xF4ng \u0111\u1EC3 l\u1EA1i b\u1EA5t k\u1EF3 text, icon k\u1EF9 thu\u1EADt, vi\u1EC1n \u0111en d\xE0y, n\xE9t ph\xE1c th\u1EA3o hay hi\u1EC7u \u1EE9ng blueprint n\xE0o trong \u1EA3nh cu\u1ED1i.",
      "Anh cuoi phai la khong gian 3D sach, thuc te, khong con dau vet mat bang 2D."
    ].join(" ");
  }
  return [
    "\u0110\xE2y l\xE0 ph\xF4i c\u1EA3nh 3D axonometric \u0111\u01B0\u1EE3c t\u1EA3i d\u1EE5ng t\u1EEB floorplan 2D.",
    "Ch\u1EC9 \u0111\u01B0\u1EE3c gi\u1EEF c\u1EA5u tr\xFAc m\u1EB7t b\u1EB1ng, t\u01B0\u1EDDng, c\u1EEDa, v\xE1ch, thang, nh\u1EADn di\u1EC7n kh\xF4ng gian \u1EDF m\u1EE5c logic b\u1ED1 tr\xED.",
    "Tuy\u1EC7t \u0111\u1ED1i kh\xF4ng \u0111\u01B0\u1EE3c th\xEAm, b\u1EDBt, \u0111\u1ED5i ch\u1ED7, t\xE1ch, n\u1ED1i, m\u1EDF r\u1ED9ng, thu h\u1EB9p hay xoay b\u1EA5t k\u1EF3 th\xE0nh ph\u1EA7n ki\u1EBFn tr\xFAc n\xE0o so v\u1EDBi b\u1EA3n v\u1EBD g\u1ED1c.",
    "M\u1ECDi th\xE0nh ph\u1EA7n ki\u1EBFn tr\xFAc ph\u1EA3i kh\xF3a c\xF9ng theo b\u1EA3n v\u1EBD: t\u01B0\u1EDDng, c\u1ED9t, v\xE1ch, c\u1EEDa \u0111i, c\u1EEDa s\u1ED5, l\u1ED1i th\xF4ng t\u1EA7ng, l\u1ED1i \u0111i, tr\u1EE5c giao th\xF4ng, l\u1ED1i tho\xE1t hi\u1EC3m, WC, h\u1ED9p k\u1EF9 thu\u1EADt, s\xE0n trong v\xE0 ranh gi\u1EDBi t\u1EEBng ph\xF2ng.",
    "Ph\u1EA3i x\xF3a ho\xE0n to\xE0n ch\u1EEF, nh\xE3n ph\xF2ng, s\u1ED1 \u0111o k\xEDch th\u01B0\u1EDBc, hatch, k\xFD hi\u1EC7u CAD, \u0111\u01B0\u1EDDng tim, n\xE9t \u0111\u1EE9t, k\xFD hi\u1EC7u m\u1EDF c\u1EEDa, khung b\u1EA3n v\u1EBD v\xE0 m\u1ECDi d\u1EA5u v\u1EBFt \u0111\u1ED3 h\u1ECDa 2D kh\xF4ng thu\u1ED9c v\u1EADt th\u1EC3 3D.",
    "Kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 \u1EA3nh cu\u1ED1i trong gi\u1ED1ng b\u1EA3n v\u1EBD 2D \u0111\u01B0\u1EE3c t\xF4 m\xE0u; ph\u1EA3i l\xE0 m\xF4 h\xECnh 3D c\xF3 m\xE0u s\u1EAFc sinh \u0111\u1ED9ng v\xE0 v\u1EADt li\u1EC7u r\xF5 r\xE0ng, s\u1EA1ch, r\xF5, kh\xF4ng c\xF2n annotation."
  ].join(" ");
}
function buildFloorplanNegativePrompt(mode) {
  if (mode === "space") {
    return [
      "text",
      "room labels",
      "dimensions",
      "dimension lines",
      "annotations",
      "arrows",
      "hatch patterns",
      "CAD lines",
      "dashed lines",
      "blueprint look",
      "technical drawing",
      "floorplan overlay",
      "watermark",
      "title block",
      "2D graphic remnants"
    ].join(", ");
  }
  return [
    "text",
    "room labels",
    "dimensions",
    "annotations",
    "missing walls",
    "extra walls",
    "shifted doors",
    "shifted windows",
    "altered room boundaries",
    "changed circulation",
    "invented architectural elements",
    "deleted architectural elements",
    "CAD symbols",
    "door swing markers",
    "grid lines",
    "hatch patterns",
    "blueprint style",
    "technical plan graphics",
    "2D overlay",
    "title block",
    "watermark",
    "white clay model",
    "monochrome",
    "grayscale",
    "raw plaster",
    "all-white rendering",
    "untextured model"
  ].join(", ");
}
function buildRenderTabPrompt(input) {
  const activeSubTab = String(input.activeSubTab || "");
  const activeSubTabKey = normalizeKey(activeSubTab);
  const description = String(input.description || "Kh\xF4ng c\xF3");
  const style = String(input.style || "Kh\xF4ng c\xF3");
  const roomType = String(input.roomType || "Kh\xF4ng c\xF3");
  const interiorStyle = String(input.interiorStyle || "Kh\xF4ng c\xF3");
  const lighting = String(input.lighting || "Kh\xF4ng c\xF3");
  const colorTone = String(input.colorTone || "Kh\xF4ng c\xF3");
  const context = String(input.context || "Kh\xF4ng c\xF3");
  const buildingStyle = String(input.buildingStyle || "Kh\xF4ng c\xF3");
  const cameraAngle = String(input.cameraAngle || "");
  const customCameraAngle = String(input.customCameraAngle || "");
  const cameraAngleStyle = String(input.cameraAngleStyle || "");
  const images = input.images || [];
  const referenceImages = input.referenceImages || [];
  const isFloorplanTab = activeSubTabKey === "floorplan to 3d" || activeSubTabKey === "floorplan to 3d floorplan";
  const parts = [];
  if (images.length > 0) {
    if (isFloorplanTab) {
      parts.push({ text: "\u1EA2nh b\u1EA3n v\u1EBD m\u1EB7t b\u1EB1ng / Floorplan g\u1ED1c (D\xF9ng \u0111\u1EC3 suy lu\u1EADn b\u1ED1 c\u1EE5c kh\xF4ng gian: t\u01B0\u1EDDng, c\u1EEDa, c\u1EEDa s\u1ED5, l\u1ED1i \u0111i, v\u1ECB tr\xED ph\xF2ng. KH\xD4NG xu\u1EA5t hi\u1EC7n d\u1EA5u v\u1EBFt b\u1EA3n v\u1EBD trong \u1EA3nh k\u1EBFt qu\u1EA3):" });
    } else {
      parts.push({ text: "\u1EA2nh ph\xE1c th\u1EA3o / concept ki\u1EBFn tr\xFAc g\u1ED1c (C\u1EA7n b\u1EA3o t\u1ED3n tuy\u1EC7t \u0111\u1ED1i g\xF3c ch\u1EE5p, ph\u1ED1i c\u1EA3nh v\xE0 h\xECnh kh\u1ED1i n\xE0y):" });
    }
    parts.push(...imageParts2(images));
  }
  if (referenceImages.length > 0) {
    if (isFloorplanTab) {
      parts.push({ text: "\u1EA2nh tham kh\u1EA3o n\u1ED9i th\u1EA5t m\u1EABu (B\u1EAET BU\u1ED8C: Gi\u1EEF nguy\xEAn ho\xE0n to\xE0n v\u1ECB tr\xED, ch\u1EE7ng lo\u1EA1i v\xE0 s\u1EAFp x\u1EBFp c\u1EE7a t\u1EEBng m\xF3n \u0111\u1ED3 n\u1ED9i th\u1EA5t xu\u1EA5t hi\u1EC7n trong \u1EA3nh n\xE0y. KH\xD4NG \u0111\u01B0\u1EE3c t\u1EF1 \xFD di chuy\u1EC3n, xoay, th\xEAm ho\u1EB7c b\u1ECF b\u1EA5t k\u1EF3 m\xF3n \u0111\u1ED3 n\xE0o. Ch\u1EC9 \xE1p d\u1EE5ng phong c\xE1ch, m\xE0u s\u1EAFc v\xE0 v\u1EADt li\u1EC7u t\u1EEB \u1EA3nh tham kh\u1EA3o; c\u1EA5m thay \u0111\u1ED5i b\u1ED1 tr\xED \u0111\u1ED3 \u0111\u1EA1c):" });
    } else {
      parts.push({ text: "\u1EA2nh tham kh\u1EA3o phong c\xE1ch / Moodboard (Ch\u1EC9 h\u1ECDc h\u1ECFi phong c\xE1ch, m\xE0u s\u1EAFc, v\u1EADt li\u1EC7u, \xE1nh s\xE1ng; KH\xD4NG l\u1EA5y g\xF3c ch\u1EE5p hay h\xECnh kh\u1ED1i t\u1EEB \u1EA3nh n\xE0y):" });
    }
    parts.push(...imageParts2(referenceImages));
  }
  let textPrompt = `M\xF4 t\u1EA3 \xFD t\u01B0\u1EDFng: ${description}
`;
  let systemInstruction;
  let responseSchema;
  let thinkingLevel = "medium";
  const selectedAngle = customCameraAngle || cameraAngle;
  const exteriorPhotorealDirective = buildPhotorealismDirective(style, "exterior");
  const interiorPhotorealDirective = buildPhotorealismDirective(style, "interior");
  const photorealNegativePrompt = buildPhotorealNegativePrompt(style);
  const floorplanSpaceCleanupDirective = buildFloorplanCleanupDirective("space");
  const floorplanAxonometricCleanupDirective = buildFloorplanCleanupDirective("axonometric");
  const floorplanSpaceNegativePrompt = buildFloorplanNegativePrompt("space");
  const floorplanAxonometricNegativePrompt = buildFloorplanNegativePrompt("axonometric");
  if (activeSubTabKey.includes("render ngoai that")) {
    textPrompt += `Style \u1EA3nh: ${style}
Tone m\xE0u: ${colorTone}
B\u1ED1i c\u1EA3nh: ${context}
\xC1nh s\xE1ng: ${lighting}
`;
    if (selectedAngle) {
      textPrompt += `G\xF3c ch\u1EE5p: ${selectedAngle}
`;
    }
    if (exteriorPhotorealDirective) {
      textPrompt += `Photoreal directive: ${exteriorPhotorealDirective}
`;
    }
    systemInstruction = [
      "B\u1EA1n l\xE0 chuy\xEAn gia bi\xEAn so\u1EA1n prompt render ngo\u1EA1i th\u1EA5t cho iGen.",
      "T\u1EA5t c\u1EA3 ph\xE2n t\xEDch v\xE0 prompt cu\u1ED1i c\xF9ng ph\u1EA3i vi\u1EBFt b\u1EB1ng ti\u1EBFng Vi\u1EC7t r\xF5 r\xE0ng, ng\u1EAFn g\u1ECDn, h\u1EEFu d\u1EE5ng.",
      "B\u1EAET BU\u1ED8C: N\u1EBFu c\xF3 \u1EA2nh ph\xE1c th\u1EA3o/concept g\u1ED1c \u0111\u1EA7u v\xE0o, b\u1EA1n PH\u1EA2I ph\xE2n t\xEDch g\xF3c ch\u1EE5p c\u1EE7a b\u1EE9c \u1EA3nh \u0111\xF3. Prompt cu\u1ED1i c\xF9ng \u0111\u01B0\u1EE3c t\u1EA1o ra PH\u1EA2I kh\u1EDBp ho\xE0n to\xE0n v\xE0 b\u1EA3o t\u1ED3n tuy\u1EC7t \u0111\u1ED1i g\xF3c ch\u1EE5p (camera angle), ph\u1ED1i c\u1EA3nh (perspective), h\xECnh kh\u1ED1i ki\u1EBFn tr\xFAc (geometry) v\xE0 b\u1ED1 c\u1EE5c (layout) c\u1EE7a \u1EA3nh ph\xE1c th\u1EA3o g\u1ED1c. Kh\xF4ng \u0111\u01B0\u1EE3c thay \u0111\u1ED5i g\xF3c ch\u1EE5p d\u01B0\u1EDBi b\u1EA5t k\u1EF3 h\xECnh th\u1EE9c n\xE0o.",
      "N\u1EBFu c\xF3 \u1EA3nh tham kh\u1EA3o phong c\xE1ch, ch\u1EC9 h\u1ECDc h\u1ECFi t\xF4ng m\xE0u, \xE1nh s\xE1ng, v\u1EADt li\u1EC7u; tuy\u1EC7t \u0111\u1ED1i kh\xF4ng l\u1EA5y g\xF3c ch\u1EE5p hay h\xECnh kh\u1ED1i t\u1EEB \u1EA3nh phong c\xE1ch.",
      "N\u1EBFu kh\xF4ng c\xF3 \u1EA3nh ph\xE1c th\u1EA3o g\u1ED1c, \u0111\u01B0\u1EE3c ph\xE9p s\xE1ng t\u1EA1o g\xF3c ch\u1EE5p h\u1EE3p l\xFD v\u1EC1 ki\u1EBFn tr\xFAc.",
      "N\u1EBFu style l\xE0 \u1EA3nh ch\u1EE5p th\u1EF1c t\u1EBF, prompt cu\u1ED1i ph\u1EA3i \xE9p model theo ng\xF4n ng\u1EEF nhi\u1EBFp \u1EA3nh \u0111\u1EDDi th\u1EF1c v\xE0 ch\u1EE7 \u0111\u1ED9ng lo\u1EA1i b\u1ECF c\u1EA3m gi\xE1c CGI ho\u1EB7c AI.",
      "H\xE3y tr\u1EA3 v\u1EC1 JSON g\u1ED3m ph\u1EA7n ph\xE2n t\xEDch ng\u1EAFn g\u1ECDn v\xE0 prompt render cu\u1ED1i c\xF9ng t\u1ED1i \u01B0u, tr\xE1nh l\u1EB7p l\u1EA1i, tr\xE1nh l\xFD thuy\u1EBFt th\u1EEBa."
    ].join(" ");
    responseSchema = objectSchema(
      {
        trang_thai_dau_vao_phat_hien: stringField("X\xE1c \u0111\u1ECBnh \u0111ang c\xF3 \u1EA3nh tham kh\u1EA3o hay ch\u1EC9 c\xF3 v\u0103n b\u1EA3n."),
        phong_cach_va_tone_kien_truc: stringField("T\u1ED5ng h\u1EE3p phong c\xE1ch ki\u1EBFn tr\xFAc v\xE0 tone m\xE0u."),
        anh_sang_va_moi_truong: stringField("Ph\xE2n t\xEDch \xE1nh s\xE1ng, th\u1EDDi ti\u1EBFt, b\u1ED1i c\u1EA3nh."),
        goc_may_anh_va_bo_cuc: stringField("Quy t\u1EAFc g\xF3c m\xE1y v\xE0 b\u1ED1 c\u1EE5c c\u1EA7n gi\u1EEF."),
        prompt_tieng_viet_toi_uu: stringField("Prompt render cu\u1ED1i c\xF9ng b\u1EB1ng ti\u1EBFng Vi\u1EC7t \u0111\u1EC3 hi\u1EC3n th\u1ECB."),
        optimized_english_prompt: stringField("Detailed, professional, photorealistic English rendering prompt for the image generator, strictly avoiding CGI/AI-style artifacts."),
        prompt_phu_dinh: stringField("C\xE1c l\u1ED7i c\u1EA7n tr\xE1nh khi render.")
      },
      [
        "trang_thai_dau_vao_phat_hien",
        "phong_cach_va_tone_kien_truc",
        "anh_sang_va_moi_truong",
        "goc_may_anh_va_bo_cuc",
        "prompt_tieng_viet_toi_uu",
        "optimized_english_prompt",
        "prompt_phu_dinh"
      ]
    );
  } else if (activeSubTabKey.includes("render noi that")) {
    textPrompt += `Style \u1EA3nh: ${style}
Ch\u1EE9c n\u0103ng ph\xF2ng: ${roomType}
Phong c\xE1ch n\u1ED9i th\u1EA5t: ${interiorStyle}
\xC1nh s\xE1ng: ${lighting}
Tone m\xE0u: ${colorTone}
`;
    if (selectedAngle) {
      textPrompt += `G\xF3c ch\u1EE5p: ${selectedAngle}
`;
    }
    if (interiorPhotorealDirective) {
      textPrompt += `Photoreal directive: ${interiorPhotorealDirective}
`;
    }
    systemInstruction = [
      "B\u1EA1n l\xE0 chuy\xEAn gia bi\xEAn so\u1EA1n prompt render n\u1ED9i th\u1EA5t cao c\u1EA5p.",
      "T\u1EA5t c\u1EA3 \u0111\u1EA7u ra ph\u1EA3i b\u1EB1ng ti\u1EBFng Vi\u1EC7t, nh\u1EA5n m\u1EA1nh c\xF4ng n\u0103ng ph\xF2ng, v\u1EADt li\u1EC7u, b\u1ED1 c\u1EE5c v\xE0 kh\xF4ng kh\xED \xE1nh s\xE1ng.",
      "B\u1EAET BU\u1ED8C: N\u1EBFu c\xF3 \u1EA2nh ph\xE1c th\u1EA3o/concept g\u1ED1c \u0111\u1EA7u v\xE0o, b\u1EA1n PH\u1EA2I ph\xE2n t\xEDch g\xF3c ch\u1EE5p c\u1EE7a b\u1EE9c \u1EA3nh \u0111\xF3. Prompt cu\u1ED1i c\xF9ng \u0111\u01B0\u1EE3c t\u1EA1o ra PH\u1EA2I kh\u1EDBp ho\xE0n to\xE0n v\xE0 b\u1EA3o t\u1ED3n tuy\u1EC7t \u0111\u1ED1i g\xF3c ch\u1EE5p (camera angle), ph\u1ED1i c\u1EA3nh (perspective), h\xECnh kh\u1ED1i v\xE0 b\u1ED1 c\u1EE5c ph\xF2ng c\u1EE7a \u1EA3nh ph\xE1c th\u1EA3o g\u1ED1c. Kh\xF4ng \u0111\u01B0\u1EE3c thay \u0111\u1ED5i g\xF3c ch\u1EE5p d\u01B0\u1EDBi b\u1EA5t k\u1EF3 h\xECnh th\u1EE9c n\xE0o.",
      "N\u1EBFu c\xF3 \u1EA3nh tham kh\u1EA3o phong c\xE1ch, ch\u1EC9 h\u1ECDc h\u1ECFi t\xF4ng m\xE0u, \xE1nh s\xE1ng, b\xE0y bi\u1EC7n; tuy\u1EC7t \u0111\u1ED1i kh\xF4ng l\u1EA5y g\xF3c ch\u1EE5p hay h\xECnh kh\u1ED1i t\u1EEB \u1EA3nh phong c\xE1ch.",
      "N\u1EBFu kh\xF4ng c\xF3 \u1EA3nh ph\xE1c th\u1EA3o g\u1ED1c, \u0111\u01B0\u1EE3c ph\xE9p t\u1EF1 thi\u1EBFt l\u1EADp ph\u1ED1i c\u1EA3nh h\u1EE3p l\xFD.",
      "N\u1EBFu style l\xE0 \u1EA3nh ch\u1EE5p th\u1EF1c t\u1EBF, prompt cu\u1ED1i ph\u1EA3i m\xF4 t\u1EA3 v\u1EADt li\u1EC7u, \xE1nh s\xE1ng v\xE0 c\u1EA3m gi\xE1c \u1ED1ng k\xEDnh nh\u01B0 \u1EA3nh n\u1ED9i th\u1EA5t \u0111\u1EDDi th\u1EF1c, tr\xE1nh showroom CGI.",
      "Tr\u1EA3 v\u1EC1 JSON ng\u1EAFn g\u1ECDn, \u0111\xFAng tr\u1ECDng t\xE2m, t\u1EADp trung v\xE0o prompt cu\u1ED1i d\xF9ng \u0111\u01B0\u1EE3c ngay."
    ].join(" ");
    responseSchema = objectSchema(
      {
        phan_tich_y_dinh_goc: stringField("T\xF3m t\u1EAFt \xFD \u0111\u1ECBnh ng\u01B0\u1EDDi d\xF9ng."),
        chuc_nang_phong_suy_luan: stringField("Suy lu\u1EADn c\xF4ng n\u0103ng ph\xF2ng."),
        phong_cach_noi_that_va_anh_sang: stringField("T\u1ED5ng h\u1EE3p phong c\xE1ch, v\u1EADt li\u1EC7u, \xE1nh s\xE1ng."),
        danh_sach_noi_that_va_vat_lieu: stringField("Nh\u1EEFng th\xE0nh ph\u1EA7n n\u1ED9i th\u1EA5t c\u1EA7n c\xF3."),
        logic_camera_va_ty_le_khung_hinh: stringField("Quy t\u1EAFc g\xF3c ch\u1EE5p v\xE0 t\u1EF7 l\u1EC7 khung h\xECnh."),
        prompt_tieng_viet_toi_uu: stringField("Prompt render cu\u1ED1i c\xF9ng b\u1EB1ng ti\u1EBFng Vi\u1EC7t \u0111\u1EC3 hi\u1EC3n th\u1ECB."),
        optimized_english_prompt: stringField("Detailed, professional, photorealistic English rendering prompt for the image generator, strictly avoiding CGI/AI-style artifacts."),
        prompt_phu_dinh: stringField("C\xE1c l\u1ED7i c\u1EA7n tr\xE1nh.")
      },
      [
        "phan_tich_y_dinh_goc",
        "chuc_nang_phong_suy_luan",
        "phong_cach_noi_that_va_anh_sang",
        "danh_sach_noi_that_va_vat_lieu",
        "logic_camera_va_ty_le_khung_hinh",
        "prompt_tieng_viet_toi_uu",
        "optimized_english_prompt",
        "prompt_phu_dinh"
      ]
    );
  } else if (activeSubTabKey === "floorplan to 3d") {
    textPrompt += `Style render: ${style}
Lo\u1EA1i ph\xF2ng: ${roomType}
Phong c\xE1ch: ${interiorStyle}
Gi\u1EEF \u0111\xFAng b\u1ED1 c\u1EE5c m\u1EB7t b\u1EB1ng, t\u01B0\u1EDDng, c\u1EEDa, n\u1ED9i th\u1EA5t theo floorplan.
Y\xEAu c\u1EA7u l\xE0m s\u1EA1ch b\u1EA3n v\u1EBD: ${floorplanSpaceCleanupDirective}
`;
    if (referenceImages.length > 0) {
      textPrompt += `Quy t\u1EAFc \u1EA3nh tham kh\u1EA3o n\u1ED9i th\u1EA5t: Gi\u1EEF nguy\xEAn tuy\u1EC7t \u0111\u1ED1i v\u1ECB tr\xED, lo\u1EA1i v\xE0 s\u1EAFp x\u1EBFp c\u1EE7a t\u1EEBng m\xF3n \u0111\u1ED3 n\u1ED9i th\u1EA5t c\xF3 trong \u1EA3nh tham kh\u1EA3o (gi\u01B0\u1EDDng, t\u1EE7, b\xE0n, gh\u1EBF, \u0111\xE8n, v.v.). TUY\u1EC6T \u0110\u1ED0I kh\xF4ng di chuy\u1EC3n, xoay, th\xEAm ho\u1EB7c b\u1ECF b\u1EA5t k\u1EF3 m\xF3n \u0111\u1ED3 n\xE0o so v\u1EDBi \u1EA3nh tham kh\u1EA3o. Ch\u1EC9 \u0111\u01B0\u1EE3c ph\xE9p \xE1p d\u1EE5ng phong c\xE1ch ho\xE0n thi\u1EC7n b\u1EC1 m\u1EB7t (m\xE0u s\u1EAFc, v\u1EADt li\u1EC7u, \xE1nh s\xE1ng) t\u1EEB \u1EA3nh tham kh\u1EA3o l\xEAn v\u1ECB tr\xED \u0111\u1ED3 v\u1EADt \u0111\xE3 c\u1ED1 \u0111\u1ECBnh.
`;
    }
    if (cameraAngleStyle) {
      textPrompt += `Style g\xF3c ch\u1EE5p: ${cameraAngleStyle}
`;
    }
    textPrompt += `Negative prompt \u01B0u ti\xEAn: ${floorplanSpaceNegativePrompt}
`;
    systemInstruction = [
      "B\u1EA1n l\xE0 chuy\xEAn gia chuy\u1EC3n m\u1EB7t b\u1EB1ng th\xE0nh kh\xF4ng gian 3D.",
      "M\u1EE5c ti\xEAu l\xE0 d\u1EF1ng l\u1EA1i kh\xF4ng gian t\u1EEB floorplan th\u1EADt ch\xEDnh x\xE1c, kh\xF4ng \u0111\u01B0\u1EE3c ph\xE1 v\u1EE1 b\u1ED1 c\u1EE5c.",
      "Ph\u1EA3i ph\xE2n bi\u1EC7t ro rang giua du lieu bo cuc can giu va dau vet do hoa ban ve can xoa bo.",
      "Kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p suy lu\u1EADn sang t\u1EA1o v\xE0o ki\u1EBFn tr\xFAc n\u1EBFu b\u1EA3n v\u1EBD kh\xF4ng th\u1EC3 hi\u1EC7n; \u01B0u ti\xEAn b\u1EA3o t\u1ED3n \xFD nguy\xEAn b\u1EA3n v\u1EBD h\u01A1n th\u1EA9m m\u1EF9 h\xECnh \u1EA3nh.",
      "N\u1EBFu c\xF3 th\u1EC3 nh\u1EADn di\u1EC7n \u0111\u1ED3 n\u1ED9i th\u1EA5t t\u1EEB b\u1EA3n v\u1EBD ho\u1EB7c \u1EA3nh tham kh\u1EA3o, t\u1EEBng m\xF3n ph\u1EA3i gi\u1EEF \u0111\xFAng lo\u1EA1i, v\u1ECB tr\xED, h\u01B0\u1EDBng v\xE0 quan h\u1EC7 kh\xF4ng gian; kh\xF4ng \u0111\u01B0\u1EE3c t\u1EF1 \xFD di chuy\u1EC3n, xoay, th\xEAm ho\u1EB7c b\u1ECF.",
      referenceImages.length > 0 ? "Khi c\xF3 \u1EA3nh tham kh\u1EA3o n\u1ED9i th\u1EA5t: ch\u1EC9 \u0111\u01B0\u1EE3c h\u1ECDc phong c\xE1ch ho\xE0n thi\u1EC7n b\u1EC1 m\u1EB7t t\u1EEB \u1EA3nh tham kh\u1EA3o, c\xF2n layout \u0111\u1ED3 v\u1EADt v\xE0 ki\u1EBFn tr\xFAc ph\u1EA3i b\u1EA5t bi\u1EBFn theo b\u1EA3n v\u1EBD v\xE0 v\u1ECB tr\xED nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c t\u1EEB \u0111\u1EA7u v\xE0o." : "N\u1EBFu kh\xF4ng c\xF3 \u1EA3nh tham kh\u1EA3o n\u1ED9i th\u1EA5t, ch\u1EC9 d\u1EF1ng nh\u1EEFng g\xEC suy ra \u0111\u01B0\u1EE3c ch\u1EAFc ch\u1EAFn t\u1EEB b\u1EA3n v\u1EBD v\xE0 th\xF4ng s\u1ED1 ng\u01B0\u1EDDi d\xF9ng cung c\u1EA5p.",
      "T\u1EA5t c\u1EA3 \u0111\u1EA7u ra ph\u1EA3i b\u1EB1ng ti\u1EBFng Vi\u1EC7t v\xE0 t\u1EADp trung v\xE0o prompt cu\u1ED1i kh\u1EA3 thi cho image model."
    ].join(" ");
    responseSchema = objectSchema(
      {
        phan_tich_mat_bang: stringField("T\xF3m t\u1EAFt nh\u1EADn di\u1EC7n m\u1EB7t b\u1EB1ng."),
        logic_phong_cach_va_tham_khao: stringField("T\u1ED5ng h\u1EE3p phong c\xE1ch \xE1p d\u1EE5ng. N\u1EBFu c\xF3 \u1EA3nh tham kh\u1EA3o n\u1ED9i th\u1EA5t, li\u1EC7t k\xEA r\xF5 t\u1EEBng m\xF3n \u0111\u1ED3 v\xE0 v\u1ECB tr\xED c\u1EA7n gi\u1EEF."),
        logic_che_do_render_va_camera: stringField("L\u1EF1a ch\u1ECDn g\xF3c ch\u1EE5p v\xE0 ch\u1EBF \u0111\u1ED9 render."),
        so_do_bo_tri_noi_that: stringField("S\u01A1 \u0111\u1ED3 b\u1ED1 tr\xED n\u1ED9i th\u1EA5t b\u1EA5t bi\u1EBFn: li\u1EC7t k\xEA t\u1EEBng m\xF3n \u0111\u1ED3 v\xE0 v\u1ECB tr\xED c\u1EE5 th\u1EC3 theo b\u1EA3n v\u1EBD v\xE0 \u1EA3nh tham kh\u1EA3o (n\u1EBFu c\xF3). Kh\xF4ng \u0111\u01B0\u1EE3c thay \u0111\u1ED5i."),
        prompt_tieng_viet_toi_uu: stringField("Prompt render cu\u1ED1i c\xF9ng. Ph\u1EA3i n\xEAu r\xF5 v\u1ECB tr\xED t\u1EEBng m\xF3n \u0111\u1ED3 n\u1ED9i th\u1EA5t kh\xF4ng \u0111\u01B0\u1EE3c thay \u0111\u1ED5i."),
        prompt_phu_dinh: stringField("C\xE1c l\u1ED7i c\u1EA7n tr\xE1nh, bao g\u1ED3m: moved furniture, repositioned objects, rearranged interior.")
      },
      [
        "phan_tich_mat_bang",
        "logic_phong_cach_va_tham_khao",
        "logic_che_do_render_va_camera",
        "so_do_bo_tri_noi_that",
        "prompt_tieng_viet_toi_uu",
        "prompt_phu_dinh"
      ]
    );
  } else if (activeSubTabKey === "floorplan to 3d floorplan") {
    textPrompt += `Lo\u1EA1i \u1EA3nh: floorplan 2D k\u1EF9 thu\u1EADt.
Style c\xF4ng tr\xECnh: ${buildingStyle}
Phong c\xE1ch: ${interiorStyle}
Kh\xF4ng \u0111\u01B0\u1EE3c bi\u1EBFn floorplan th\xE0nh \u1EA3nh n\u1ED9i th\u1EA5t th\xF4ng th\u01B0\u1EDDng.
Y\xEAu c\u1EA7u l\xE0m s\u1EA1ch b\u1EA3n v\u1EBD: ${floorplanAxonometricCleanupDirective}
Y\xEAu c\u1EA7u m\xE0u s\u1EAFc: M\xF4 h\xECnh ph\u1ED1i c\u1EA3nh 3D axonometric ph\u1EA3i c\xF3 m\xE0u s\u1EAFc sinh \u0111\u1ED9ng, \u0111\u1EA7y \u0111\u1EE7 v\u1EADt li\u1EC7u (v\xED d\u1EE5: s\xE0n g\u1ED7 ho\u1EB7c g\u1EA1ch m\xE0u, t\u01B0\u1EDDng s\u01A1n m\xE0u \u1EA5m/s\xE1ng/kem, \u0111\u1ED3 n\u1ED9i th\u1EA5t c\xF3 m\xE0u s\u1EAFc v\xE0 ch\u1EA5t li\u1EC7u r\xF5 r\xE0ng nh\u01B0 g\u1ED7, v\u1EA3i, da), tuy\u1EC7t \u0111\u1ED1i kh\xF4ng \u0111\u1EC3 m\xE0u tr\u1EAFng to\xE0n b\u1ED9 (clay model) hay \u0111\u01A1n s\u1EAFc monochrome.
Y\xEAu c\u1EA7u ph\xE2n t\xEDch: B\u1EAET BU\u1ED8C nh\u1EADn di\u1EC7n t\u1EA5t c\u1EA3 c\xE1c nh\xE3n ch\u1EEF ch\u1EC9 t\xEAn ph\xF2ng ho\u1EB7c c\xF4ng n\u0103ng vi\u1EBFt tr\xEAn b\u1EA3n v\u1EBD (v\xED d\u1EE5: Ph\xF2ng kh\xE1ch, Ph\xF2ng ng\u1EE7, WC, B\u1EBFp, Thang...). H\xE3y m\xF4 t\u1EA3 r\xF5 b\u1ED1 c\u1EE5c v\xE0 v\u1ECB tr\xED c\xE1c ph\xF2ng n\xE0y trong prompt \u0111\u1EC3 m\xF4 h\xECnh sinh \u1EA3nh d\u1EF1ng \u0111\xFAng c\xF4ng n\u0103ng ph\xF2ng.
`;
    if (referenceImages.length > 0) {
      textPrompt += `Quy t\u1EAFc \u1EA3nh tham kh\u1EA3o n\u1ED9i th\u1EA5t: Gi\u1EEF nguy\xEAn tuy\u1EC7t \u0111\u1ED1i v\u1ECB tr\xED, lo\u1EA1i v\xE0 s\u1EAFp x\u1EBFp c\u1EE7a t\u1EEBng m\xF3n \u0111\u1ED3 n\u1ED9i th\u1EA5t c\xF3 trong \u1EA3nh tham kh\u1EA3o. TUY\u1EC6T \u0110\u1ED0I kh\xF4ng di chuy\u1EC3n, xoay, th\xEAm ho\u1EB7c b\u1ECF b\u1EA5t k\u1EF3 m\xF3n \u0111\u1ED3 n\xE0o. Ch\u1EC9 \u0111\u01B0\u1EE3c \xE1p d\u1EE5ng phong c\xE1ch ho\xE0n thi\u1EC7n b\u1EC1 m\u1EB7t t\u1EEB \u1EA3nh tham kh\u1EA3o l\xEAn v\u1ECB tr\xED \u0111\u1ED3 v\u1EADt \u0111\xE3 c\u1ED1 \u0111\u1ECBnh theo b\u1EA3n v\u1EBD.
`;
    }
    if (cameraAngleStyle) {
      textPrompt += `Style g\xF3c ch\u1EE5p: ${cameraAngleStyle}
`;
    }
    textPrompt += `Negative prompt \u01B0u ti\xEAn: ${floorplanAxonometricNegativePrompt}
`;
    systemInstruction = [
      "B\u1EA1n l\xE0 chuy\xEAn gia ph\xE2n t\xEDch floorplan 2D v\xE0 t\xE1i d\u1EF1ng th\xE0nh kh\xF4ng gian 3D ch\xEDnh x\xE1c.",
      "B\u1EAET BU\u1ED8C: H\xE3y \u0111\u1ECDc k\u1EF9 \u1EA3nh m\u1EB7t b\u1EB1ng \u0111\u1EA7u v\xE0o, t\xECm v\xE0 nh\u1EADn di\u1EC7n \u0111\xFAng t\u1EA5t c\u1EA3 c\xE1c nh\xE3n ch\u1EEF ch\u1EC9 t\xEAn/c\xF4ng n\u0103ng ph\xF2ng (v\xED d\u1EE5: Ph\xF2ng kh\xE1ch, Ph\xF2ng ng\u1EE7, WC, B\u1EBFp, C\u1EA7u thang...). B\u1EA1n ph\u1EA3i m\xF4 t\u1EA3 chi ti\u1EBFt v\u1ECB tr\xED c\u1EE7a t\u1EEBng khu v\u1EF1c ch\u1EE9c n\u0103ng n\xE0y trong prompt cu\u1ED1i c\xF9ng \u0111\u1EC3 m\xF4 h\xECnh sinh \u1EA3nh x\u1EBFp \u0111\xFAng v\u1ECB tr\xED, tuy\u1EC7t \u0111\u1ED1i kh\xF4ng \u0111\u01B0\u1EE3c t\u1EF1 \xFD \u0111\u1ED5i c\xF4ng n\u0103ng ph\xF2ng (kh\xF4ng bi\u1EBFn WC th\xE0nh ph\xF2ng ng\u1EE7, kh\xF4ng v\u1EBD nh\u1EA7m ph\xF2ng ng\u1EE7 th\xE0nh ph\xF2ng kh\xE1ch).",
      "M\u1EB7t b\u1EB1ng l\xE0 s\u1EF1 th\u1EADt tuy\u1EC7t \u0111\u1ED1i: t\u01B0\u1EDDng, c\u1EEDa, thang, v\xE1ch v\xE0 nh\xE3n ph\xF2ng ph\u1EA3i \u0111\u01B0\u1EE3c t\xF4n tr\u1ECDng.",
      "Nh\xE3n ph\xF2ng v\xE0 k\xFD hi\u1EC7u ch\u1EC9 d\xF9ng \u0111\u1EC3 suy lu\u1EADn b\u1ED1 tr\xED, kh\xF4ng \u0111\u01B0\u1EE3c xu\u1EA5t hi\u1EC7n l\u1EA1i trong \u1EA3nh k\u1EBFt qu\u1EA3.",
      "Kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p b\u1ED5 sung, x\xF3a b\u1ECF ho\u1EB7c s\u1EEDa \u0111\u1ED5i b\u1EA5t k\u1EF3 th\xE0nh ph\u1EA7n ki\u1EBFn tr\xFAc n\xE0o kh\xF4ng c\xF3 trong b\u1EA3n v\u1EBD; n\u1EBFu kh\xF4ng ch\u1EAFc, ph\u1EA3i gi\u1EEF nguy\xEAn thay v\xEC t\u1EF1 b\u1ECBa.",
      "M\xF4 h\xECnh 3D axonometric ph\u1EA3i \u0111\u01B0\u1EE3c t\xF4 m\xE0u \u0111\u1EA7y \u0111\u1EE7, sinh \u0111\u1ED9ng cho s\xE0n, t\u01B0\u1EDDng, v\xE0 \u0111\u1ED3 n\u1ED9i th\u1EA5t theo phong c\xE1ch thi\u1EBFt k\u1EBF \u0111\xE3 ch\u1ECDn. KH\xD4NG \u0111\u01B0\u1EE3c t\u1EA1o m\xF4 h\xECnh \u0111\u1EA5t s\xE9t tr\u1EAFng (white clay model) hay \u0111\u01A1n s\u1EAFc tr\u1EAFng.",
      referenceImages.length > 0 ? "Khi c\xF3 \u1EA3nh tham kh\u1EA3o n\u1ED9i th\u1EA5t: t\u1EEBng m\xF3n \u0111\u1ED3 tham kh\u1EA3o ch\u1EC9 \u0111\u01B0\u1EE3c d\xF9ng \u0111\u1EC3 kh\xF3a \u0111\xFAng ch\u1EE7ng lo\u1EA1i, h\u01B0\u1EDBng v\xE0 v\u1ECB tr\xED t\u01B0\u01A1ng \u1EE9ng theo m\u1EB7t b\u1EB1ng; kh\xF4ng t\u1EF1 \xFD th\xEAm b\u1EDBt hay di chuy\u1EC3n." : "N\u1EBFu kh\xF4ng c\xF3 \u1EA3nh tham kh\u1EA3o n\u1ED9i th\u1EA5t, b\u1ED1 tr\xED \u0111\u1ED3 \u0111\u1EA1c ph\u1EA3i b\xE1m logic m\u1EB7t b\u1EB1ng v\xE0 ch\u1EC9 d\u1EF1ng nh\u1EEFng g\xEC suy ra ch\u1EAFc ch\u1EAFn t\u1EEB b\u1EA3n v\u1EBD.",
      "T\u1EA5t c\u1EA3 \u0111\u1EA7u ra b\u1EB1ng ti\u1EBFng Vi\u1EC7t, \u01B0u ti\xEAn prompt cu\u1ED1i d\xF9ng \u0111\u01B0\u1EE3c ngay."
    ].join(" ");
    responseSchema = objectSchema(
      {
        phan_tich_khoa_goc_ghi_hinh: stringField("Ph\xE2n t\xEDch chi ti\u1EBFt m\u1EB7t b\u1EB1ng: nh\u1EADn di\u1EC7n v\xE0 li\u1EC7t k\xEA t\u1EA5t c\u1EA3 c\xE1c ph\xF2ng/khu v\u1EF1c ch\u1EE9c n\u0103ng k\xE8m nh\xE3n t\xEAn t\u01B0\u01A1ng \u1EE9ng \u0111\u1EC3 \u0111\u1EA3m b\u1EA3o m\xF4 h\xECnh kh\xF4ng hi\u1EC3u sai l\u1EC7ch."),
        logic_phong_cach_va_cong_trinh: stringField("T\u1ED5ng h\u1EE3p phong c\xE1ch v\xE0 logic c\xF4ng tr\xECnh."),
        quyet_dinh_cat_tuong: stringField("M\xF4 t\u1EA3 chi\u1EBFn l\u01B0\u1EE3c c\u1EAFt t\u01B0\u1EDDng n\u1EBFu c\u1EA7n."),
        thiet_lap_anh_sang_va_studio: stringField("Thi\u1EBFt l\u1EADp \xE1nh s\xE1ng v\xE0 c\xE1ch tr\xECnh b\xE0y."),
        prompt_tieng_viet_toi_uu: stringField("Prompt render cu\u1ED1i c\xF9ng. Ph\u1EA3i m\xF4 t\u1EA3 r\xF5 r\xE0ng v\u1ECB tr\xED c\u1EE5 th\u1EC3 c\u1EE7a t\u1EEBng ph\xF2ng/khu v\u1EF1c ch\u1EE9c n\u0103ng \u0111\xE3 nh\u1EADn di\u1EC7n."),
        prompt_phu_dinh: stringField("C\xE1c l\u1ED7i c\u1EA7n tr\xE1nh.")
      },
      [
        "phan_tich_khoa_goc_ghi_hinh",
        "logic_phong_cach_va_cong_trinh",
        "quyet_dinh_cat_tuong",
        "thiet_lap_anh_sang_va_studio",
        "prompt_tieng_viet_toi_uu",
        "prompt_phu_dinh"
      ]
    );
  } else {
    textPrompt += `Style \u1EA3nh: ${style}
Tone m\xE0u: ${colorTone}
B\u1ED1i c\u1EA3nh: ${context}
\xC1nh s\xE1ng: ${lighting}
`;
    if (selectedAngle) {
      textPrompt += `G\xF3c ch\u1EE5p: ${selectedAngle}
`;
    }
    textPrompt += [
      "R\xE0ng bu\u1ED9c masterplan: ph\u1EA3i gi\u1EEF nguy\xEAn logic ph\xE2n khu, m\u1EA1ng l\u01B0\u1EDBi giao th\xF4ng, v\u1ECB tr\xED c\xF4ng tr\xECnh, m\u1EB7t n\u01B0\u1EDBc, c\xE2y xanh, ti\u1EC7n \xEDch, kho\u1EA3ng l\xF9i v\xE0 quan h\u1EC7 kh\xF4ng gian theo b\u1EA3n v\u1EBD g\u1ED1c.",
      "Kh\xF4ng \u0111\u01B0\u1EE3c t\u1EF1 th\xEAm, b\u1EDBt, di chuy\u1EC3n, xoay ho\u1EB7c ho\xE1n \u0111\u1ED5i c\xE1c kh\u1ED1i c\xF4ng tr\xECnh, \u0111\u01B0\u1EDDng n\u1ED9i b\u1ED9, qu\u1EA3ng tr\u01B0\u1EDDng, h\u1ED3 c\u1EA3nh quan hay c\u1EE5m ch\u1EE9c n\u0103ng n\u1EBFu \u0111\u1EA7u v\xE0o kh\xF4ng th\u1EC3 hi\u1EC7n.",
      "Ph\u1EA3i x\xF3a s\u1EA1ch m\u1ECDi ch\u1EEF, k\xFD hi\u1EC7u quy ho\u1EA1ch, dimension, m\u0169i t\xEAn, l\u01B0\u1EDBi tr\u1EE5c, ghi ch\xFA CAD, legend v\xE0 watermark kh\u1ECFi \u1EA3nh k\u1EBFt qu\u1EA3.",
      "N\u1EBFu b\u1EA3n v\u1EBD kh\xF4ng r\xF5 m\u1ED9t chi ti\u1EBFt, \u01B0u ti\xEAn gi\u1EEF logic hi\u1EC7n tr\u1EA1ng g\u1EA7n nh\u1EA5t thay v\xEC t\u1EF1 s\xE1ng t\xE1c b\u1ED1 c\u1EE5c m\u1EDBi."
    ].join(" ") + "\n";
    systemInstruction = [
      "B\u1EA1n l\xE0 chuy\xEAn gia bi\xEAn so\u1EA1n prompt masterplan 3D.",
      "M\u1EE5c ti\xEAu l\xE0 d\u1EF1ng l\u1EA1i masterplan 3D b\xE1m s\xE1t b\u1EA3n v\u1EBD quy ho\u1EA1ch g\u1ED1c, \u01B0u ti\xEAn t\xEDnh \u0111\xFAng \u0111\u1EAFn kh\xF4ng gian h\u01A1n hi\u1EC7u \u1EE9ng \u0111\u1EB9p m\u1EAFt.",
      "Kh\xF4ng \u0111\u01B0\u1EE3c s\xE1ng t\xE1c l\u1EA1i zoning, massing, \u0111\u01B0\u1EDDng giao th\xF4ng hay th\xEAm b\u1EDBt ti\u1EC7n \xEDch ngo\xE0i d\u1EEF li\u1EC7u \u0111\u1EA7u v\xE0o.",
      "Tr\u1EA3 v\u1EC1 JSON ng\u1EAFn g\u1ECDn v\xE0 prompt cu\u1ED1i c\xF3 th\u1EC3 render \u0111\u01B0\u1EE3c ngay."
    ].join(" ");
    thinkingLevel = "high";
    responseSchema = objectSchema(
      {
        masterplan_analysis: stringField("T\xF3m t\u1EAFt m\u1EB7t b\u1EB1ng t\u1ED5ng th\u1EC3."),
        massing_and_zoning_logic: stringField("Logic ph\xE2n khu v\xE0 h\xECnh kh\u1ED1i."),
        camera_and_scale_logic: stringField("Logic g\xF3c nh\xECn v\xE0 t\u1EF7 l\u1EC7."),
        style_lighting_and_context: stringField("T\u1ED5ng h\u1EE3p phong c\xE1ch, \xE1nh s\xE1ng, b\u1ED1i c\u1EA3nh."),
        optimized_english_prompt: stringField("Prompt cu\u1ED1i c\xF9ng."),
        negative_prompt: stringField("C\xE1c l\u1ED7i c\u1EA7n tr\xE1nh, \u0111\u1EB7c bi\u1EC7t l\u1ED7i b\u1ECBa zoning, sai giao th\xF4ng, sai v\u1ECB tr\xED kh\u1ED1i c\xF4ng tr\xECnh v\xE0 c\xF2n s\xF3t annotation quy ho\u1EA1ch.")
      },
      [
        "masterplan_analysis",
        "massing_and_zoning_logic",
        "camera_and_scale_logic",
        "style_lighting_and_context",
        "optimized_english_prompt",
        "negative_prompt"
      ]
    );
  }
  if (photorealNegativePrompt) {
    textPrompt += `Negative prompt \u01B0u ti\xEAn: ${photorealNegativePrompt}
`;
  }
  parts.push({ text: textPrompt.trim() });
  return {
    contents: [{ role: "user", parts }],
    systemInstruction,
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema,
      thinkingConfig: { thinkingLevel }
    }
  };
}
function buildRenderEditPrompt(input) {
  const activeSubTab = String(input.activeSubTab || "");
  const activeSubTabKey = normalizeKey(activeSubTab);
  const description = String(input.description || "Kh\xF4ng c\xF3");
  const cropInfo = String(input.cropInfo || "");
  const images = input.images || [];
  const parts = [...imageParts2(images)];
  const textPrompt = `M\xF4 t\u1EA3 thay \u0111\u1ED5i: ${description}
${cropInfo}
`;
  let systemInstruction;
  const config = {
    temperature: 0.4,
    responseMimeType: "application/json"
  };
  if (activeSubTabKey.includes("crop")) {
    systemInstruction = [
      "B\u1EA1n l\xE0 chuy\xEAn gia t\u1EA1o inpaint prompt cho ki\u1EBFn tr\xFAc.",
      "Ch\u1EC9 \u0111\u01B0\u1EE3c ph\xE9p s\u1EEDa trong v\xF9ng \u0111\u01B0\u1EE3c ch\u1EC9 \u0111\u1ECBnh, ph\u1EA7n c\xF2n l\u1EA1i ph\u1EA3i gi\u1EEF nguy\xEAn b\u1ED1 c\u1EE5c, ch\u1EA5t li\u1EC7u, \xE1nh s\xE1ng v\xE0 perspective.",
      "Tr\u1EA3 v\u1EC1 JSON v\u1EDBi \xFD \u0111\u1ECBnh s\u1EEDa, ph\xE2n t\xEDch b\u1ED1i c\u1EA3nh, aspect ratio, prompt inpaint cu\u1ED1i c\xF9ng v\xE0 negative prompt."
    ].join(" ");
    config.responseSchema = objectSchema(
      {
        edit_intent: stringField("Ph\xE2n lo\u1EA1i replace, add ho\u1EB7c remove."),
        spatial_context_analysis: stringField("T\xF3m t\u1EAFt b\u1ED1i c\u1EA3nh trong v\xF9ng s\u1EEDa."),
        detected_aspect_ratio: stringField("Aspect ratio suy ra t\u1EEB \u1EA3nh."),
        optimized_inpaint_prompt: stringField("Prompt inpaint b\u1EB1ng ti\u1EBFng Anh."),
        coordinates_lock: {
          type: "OBJECT",
          properties: {
            x: numberField(),
            y: numberField(),
            width: numberField(),
            height: numberField()
          }
        },
        negative_prompt: stringField("Nh\u1EEFng l\u1ED7i c\u1EA7n tr\xE1nh.")
      },
      [
        "edit_intent",
        "spatial_context_analysis",
        "detected_aspect_ratio",
        "optimized_inpaint_prompt",
        "coordinates_lock",
        "negative_prompt"
      ]
    );
  } else if (activeSubTabKey.includes("tong the")) {
    systemInstruction = [
      "B\u1EA1n l\xE0 chuy\xEAn gia retouch v\xE0 t\xE1i bi\xEAn so\u1EA1n prompt edit \u1EA3nh.",
      "Kh\xF4ng \u0111\u01B0\u1EE3c vi\u1EBFt prompt d\u1EA1ng ra l\u1EC7nh t\u1EEBng b\u01B0\u1EDBc; ph\u1EA3i m\xF4 t\u1EA3 tr\u1EA1ng th\xE1i cu\u1ED1i c\u1EE7a \u1EA3nh.",
      "Ph\u1EA3i x\xE1c \u0111\u1ECBnh nh\u1EEFng th\xE0nh ph\u1EA7n c\u1EA7n kh\xF3a \u0111\u1EC3 gi\u1EEF nguy\xEAn c\u1EA5u tr\xFAc."
    ].join(" ");
    config.responseSchema = objectSchema(
      {
        original_intent_analysis: stringField("T\xF3m t\u1EAFt y\xEAu c\u1EA7u c\u1EE7a ng\u01B0\u1EDDi d\xF9ng."),
        untouchable_elements: stringField("Nh\u1EEFng th\xE0nh ph\u1EA7n ph\u1EA3i gi\u1EEF nguy\xEAn."),
        augmented_details: stringField("Chi ti\u1EBFt \u0111\u01B0\u1EE3c b\u1ED5 sung \u0111\u1EC3 prompt \u0111\u1EA7y \u0111\u1EE7."),
        global_lighting_and_atmosphere: stringField("\xC1nh s\xE1ng v\xE0 kh\xF4ng kh\xED c\u1EA7n gi\u1EEF."),
        optimized_english_prompt: stringField("Prompt edit cu\u1ED1i c\xF9ng."),
        negative_prompt: stringField("Nh\u1EEFng l\u1ED7i c\u1EA7n tr\xE1nh.")
      },
      [
        "original_intent_analysis",
        "untouchable_elements",
        "augmented_details",
        "global_lighting_and_atmosphere",
        "optimized_english_prompt",
        "negative_prompt"
      ]
    );
  } else if (activeSubTabKey.includes("thay the model")) {
    systemInstruction = [
      "B\u1EA1n l\xE0 chuy\xEAn gia thay th\u1EBF v\u1EADt th\u1EC3 trong \u1EA3nh b\u1EB1ng v\u1EADt th\u1EC3 tham kh\u1EA3o.",
      "Ph\u1EA3i gi\u1EEF \u0111\xFAng perspective, scale, \xE1nh s\xE1ng v\xE0 c\xE1c v\u1EADt th\u1EC3 t\u01B0\u01A1ng t\xE1c li\xEAn quan."
    ].join(" ");
    config.temperature = 0.3;
    config.responseSchema = objectSchema(
      {
        intent_and_identification: stringField("V\u1EADt c\u0169 c\u1EA7n thay v\xE0 v\u1EADt m\u1EDBi c\u1EA7n \u0111\u01B0a v\xE0o."),
        analyze_original_object_and_space: stringField("V\u1ECB tr\xED, scale, perspective c\u1EE7a v\u1EADt c\u0169."),
        analyze_reference_model: stringField("DNA c\u1EE7a v\u1EADt th\u1EC3 tham kh\u1EA3o."),
        perspective_reprojection_logic: stringField("Logic xoay \u0111\u1ED5i perspective."),
        physical_inheritance: stringField("Nh\u1EEFng v\u1EADt ph\u1EA9m t\u01B0\u01A1ng t\xE1c c\u1EA7n gi\u1EEF."),
        blending_physics: stringField("Logic \xE1nh s\xE1ng v\xE0 \u0111\u1ED5 b\xF3ng."),
        optimized_english_prompt: stringField("Prompt cu\u1ED1i c\xF9ng."),
        negative_prompt: stringField("Nh\u1EEFng l\u1ED7i c\u1EA7n tr\xE1nh.")
      },
      [
        "intent_and_identification",
        "analyze_original_object_and_space",
        "analyze_reference_model",
        "perspective_reprojection_logic",
        "physical_inheritance",
        "blending_physics",
        "optimized_english_prompt",
        "negative_prompt"
      ]
    );
  } else if (activeSubTabKey.includes("them doi tuong")) {
    systemInstruction = [
      "B\u1EA1n l\xE0 chuy\xEAn gia compositing \u0111\u1ED1i t\u01B0\u1EE3ng v\xE0o \u1EA3nh ki\u1EBFn tr\xFAc.",
      "Ph\u1EA3i gi\u1EEF DNA c\u1EE7a \u0111\u1ED1i t\u01B0\u1EE3ng tham kh\u1EA3o nh\u01B0ng cho ph\xE9p \u0111\u1ED5i pose, scale v\xE0 v\u1ECB tr\xED cho h\u1EE3p c\u1EA3nh."
    ].join(" ");
    config.responseSchema = objectSchema(
      {
        user_intent_analysis: stringField("Ng\u01B0\u1EDDi d\xF9ng mu\u1ED1n th\xEAm g\xEC, \u1EDF \u0111\xE2u."),
        subject_dna_extraction: stringField("DNA th\u1ECB gi\xE1c c\u1EE7a \u0111\u1ED1i t\u01B0\u1EE3ng."),
        spatial_and_occlusion_logic: stringField("V\u1ECB tr\xED, layer tr\u01B0\u1EDBc sau, scale."),
        pose_and_state_morphing: stringField("Logic \u0111\u1ED5i t\u01B0 th\u1EBF c\u1EE7a \u0111\u1ED1i t\u01B0\u1EE3ng."),
        surface_contact_physics: stringField("Ti\u1EBFp x\xFAc, tr\u1ECDng l\u01B0\u1EE3ng, contact shadow."),
        environmental_lighting_sync: stringField("\u0110\u1ED3ng b\u1ED9 \xE1nh s\xE1ng."),
        optimized_english_prompt: stringField("Prompt cu\u1ED1i c\xF9ng."),
        negative_prompt: stringField("Nh\u1EEFng l\u1ED7i c\u1EA7n tr\xE1nh.")
      },
      [
        "user_intent_analysis",
        "subject_dna_extraction",
        "spatial_and_occlusion_logic",
        "pose_and_state_morphing",
        "surface_contact_physics",
        "environmental_lighting_sync",
        "optimized_english_prompt",
        "negative_prompt"
      ]
    );
    config.thinkingConfig = { thinkingLevel: "high" };
  } else {
    systemInstruction = [
      "B\u1EA1n l\xE0 chuy\xEAn gia \u0111\u1ED5i v\u1EADt li\u1EC7u ki\u1EBFn tr\xFAc trong \u1EA3nh.",
      "Ch\u1EC9 thay \u0111\u1ED5i b\u1EC1 m\u1EB7t m\u1EE5c ti\xEAu, gi\u1EEF nguy\xEAn to\xE0n b\u1ED9 n\u1ED9i th\u1EA5t v\xE0 c\u1EA5u tr\xFAc kh\xE1c."
    ].join(" ");
    config.responseSchema = objectSchema(
      {
        surface_identification: stringField("B\u1EC1 m\u1EB7t m\u1EE5c ti\xEAu c\u1EA7n \u0111\u1ED5i v\u1EADt li\u1EC7u."),
        material_dna_extraction: stringField("DNA v\u1EADt li\u1EC7u c\u1EA7n \xE1p d\u1EE5ng."),
        scale_and_tiling_logic: stringField("Logic scale v\xE0 seamless tiling."),
        lighting_and_reflection_physics: stringField("\xC1nh s\xE1ng, ph\u1EA3n x\u1EA1, ph\u1EA3n chi\u1EBFu."),
        untouchable_elements: stringField("Th\xE0nh ph\u1EA7n ph\u1EA3i gi\u1EEF nguy\xEAn."),
        optimized_english_prompt: stringField("Prompt cu\u1ED1i c\xF9ng."),
        negative_prompt: stringField("Nh\u1EEFng l\u1ED7i c\u1EA7n tr\xE1nh.")
      },
      [
        "surface_identification",
        "material_dna_extraction",
        "scale_and_tiling_logic",
        "lighting_and_reflection_physics",
        "untouchable_elements",
        "optimized_english_prompt",
        "negative_prompt"
      ]
    );
    config.thinkingConfig = { thinkingLevel: "high" };
  }
  parts.push({ text: textPrompt.trim() });
  return {
    contents: [{ role: "user", parts }],
    config,
    systemInstruction
  };
}
function buildEnhancePrompt(input) {
  const activeSubTab = String(input.activeSubTab || "");
  const activeSubTabKey = normalizeKey(activeSubTab);
  const customPrompt = String(input.customPrompt || "Kh\xF4ng c\xF3");
  const contextOption = String(input.contextOption || "Kh\xF4ng c\xF3");
  const lightingOption = String(input.lightingOption || "Kh\xF4ng c\xF3");
  const interiorRoomType = String(input.interiorRoomType || "Kh\xF4ng c\xF3");
  const interiorStyle = String(input.interiorStyle || "Kh\xF4ng c\xF3");
  const interiorLighting = String(input.interiorLighting || "Kh\xF4ng c\xF3");
  const images = input.images || [];
  const parts = [...imageParts2(images)];
  const textPrompt = activeSubTabKey.includes("ngoai that") ? `M\u1EE5c ti\xEAu: C\u1EA3i thi\u1EC7n ch\u1EA5t l\u01B0\u1EE3ng render ngo\u1EA1i th\u1EA5t.
Y\xEAu c\u1EA7u b\u1ED5 sung: ${customPrompt}
B\u1ED1i c\u1EA3nh: ${contextOption}
\xC1nh s\xE1ng: ${lightingOption}` : `M\u1EE5c ti\xEAu: C\u1EA3i thi\u1EC7n ch\u1EA5t l\u01B0\u1EE3ng render n\u1ED9i th\u1EA5t.
Y\xEAu c\u1EA7u b\u1ED5 sung: ${customPrompt}
Lo\u1EA1i ph\xF2ng: ${interiorRoomType}
Phong c\xE1ch: ${interiorStyle}
\xC1nh s\xE1ng: ${interiorLighting}`;
  parts.push({ text: textPrompt });
  return {
    contents: [{ role: "user", parts }],
    systemInstruction: [
      "B\u1EA1n l\xE0 chuy\xEAn gia n\xE2ng c\u1EA5p prompt render iGen.",
      "B\u1EA3o t\u1ED3n tuy\u1EC7t \u0111\u1ED1i c\u1EA5u tr\xFAc, b\u1ED1 c\u1EE5c, g\xF3c m\xE1y v\xE0 logic h\xECnh h\u1ECDc c\u1EE7a \u1EA3nh \u0111\u1EA7u v\xE0o.",
      "Ch\u1EC9 n\xE2ng c\u1EA5p v\u1EADt li\u1EC7u, \xE1nh s\xE1ng, kh\xF4ng kh\xED, \u0111\u1ED9 s\u1EAFc n\xE9t v\xE0 gi\xE1 tr\u1ECB tr\xECnh b\xE0y.",
      "Tr\u1EA3 v\u1EC1 JSON ng\u1EAFn g\u1ECDn b\u1EB1ng ti\u1EBFng Vi\u1EC7t v\u1EDBi ph\xE2n t\xEDch, optimized_english_prompt v\xE0 negative_prompt."
    ].join(" "),
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json"
    }
  };
}
function buildUpscalePrompt(input) {
  const images = input.images || [];
  return {
    contents: [
      {
        role: "user",
        parts: [
          ...imageParts2(images),
          { text: "Analyze this image and generate the upscaling prompt." }
        ]
      }
    ],
    systemInstruction: [
      "You are an elite image restoration analyst for architectural imagery.",
      "Describe exactly what exists in the blurry image and do not hallucinate new subjects or layout changes.",
      "Return JSON with analysis, optimized upscale prompt, and negative prompt.",
      "The optimized prompt must end with: ultra-sharp, highly detailed, 2K resolution, crystal clear, noise-free, high-fidelity restoration, crisp edges, masterpiece."
    ].join(" "),
    generationConfig: {
      temperature: 0.6,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "medium" },
      responseSchema: objectSchema(
        {
          image_content_analysis: stringField("Deep analysis of visible content."),
          optimized_upscale_prompt: stringField("English upscale prompt."),
          negative_prompt: stringField("Upscale artifacts to avoid.")
        },
        [
          "image_content_analysis",
          "optimized_upscale_prompt",
          "negative_prompt"
        ]
      )
    }
  };
}
function buildSyncAnalyzePrompt(input) {
  const activeSubTab = String(input.activeSubTab || "");
  const activeSubTabKey = normalizeKey(activeSubTab);
  const images = input.images || [];
  if (activeSubTabKey.includes("dong bo cong trinh")) {
    return {
      contents: [
        {
          role: "user",
          parts: [
            ...imageParts2(images),
            { text: "Vui l\xF2ng ph\xE2n t\xEDch kh\xF4ng gian v\xE0 t\u1EA1o 30 g\xF3c ch\u1EE5p theo c\u1EA5u tr\xFAc JSON \u0111\xE3 quy \u0111\u1ECBnh." }
          ]
        }
      ],
      systemInstruction: [
        "B\u1EA1n l\xE0 t\u1ED5ng \u0111\u1EA1o di\u1EC5n ngh\u1EC7 thu\u1EADt v\xE0 ki\u1EBFn tr\xFAc s\u01B0 kh\xF4ng gian c\u1EE7a iGen.",
        "H\xE3y ph\xE2n t\xEDch 1 \u1EA3nh ki\u1EBFn tr\xFAc tham kh\u1EA3o v\xE0 t\u1EA1o ch\xEDnh x\xE1c 30 g\xF3c ch\u1EE5p \u0111\u1ED3ng b\u1ED9 v\u1EDBi nhau.",
        "T\u1EA5t c\u1EA3 \u0111\u1EA7u ra ph\u1EA3i b\u1EB1ng ti\u1EBFng Vi\u1EC7t r\xF5 r\xE0ng, nh\u1EA5t qu\xE1n, h\u1EEFu d\u1EE5ng.",
        "Ph\u1EA3i tr\u1EA3 v\u1EC1 JSON v\u1EDBi mental_blueprint v\xE0 categories/shots."
      ].join(" "),
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            mental_blueprint: stringField("Ph\xE1c th\u1EA3o tinh th\u1EA7n c\u1EE7a kh\xF4ng gian."),
            categories: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  category_name: stringField("T\xEAn nh\xF3m g\xF3c ch\u1EE5p."),
                  shots: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        display_title_vi: stringField("Ti\xEAu \u0111\u1EC1 hi\u1EC3n th\u1ECB."),
                        hidden_api_prompt_en: stringField("Prompt render cho shot.")
                      },
                      required: ["display_title_vi", "hidden_api_prompt_en"]
                    }
                  }
                },
                required: ["category_name", "shots"]
              }
            }
          },
          required: ["mental_blueprint", "categories"]
        }
      }
    };
  }
  return {
    contents: [
      {
        role: "user",
        parts: [
          ...imageParts2(images),
          {
            text: "H\xE3y ph\xE2n t\xEDch b\u1EE9c \u1EA3nh nh\xE2n v\u1EADt n\xE0y v\xE0 \u0111\u01B0a ra c\xE1c g\u1EE3i \xFD v\u1EC1 c\xE1c g\xF3c m\xE1y v\xE0 t\u01B0 th\u1EBF kh\xE1c nhau \u0111\u1EC3 l\xE0m n\u1ED5i b\u1EADt nh\xE2n v\u1EADt."
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json"
    }
  };
}
function resolvePromptTemplate(templateKey, input) {
  const pass3Template = resolvePass3PromptTemplate(templateKey, input);
  if (pass3Template) {
    return pass3Template;
  }
  switch (templateKey) {
    case "render_tab_prompt":
      return buildRenderTabPrompt(input);
    case "render_edit_prompt":
      return buildRenderEditPrompt(input);
    case "enhance_render_prompt":
      return buildEnhancePrompt(input);
    case "upscale_prompt":
      return buildUpscalePrompt(input);
    case "sync_analyze_prompt":
      return buildSyncAnalyzePrompt(input);
    case "sync_character_composite_prompt":
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts2(input.images || []),
              {
                text: `B\u1EA1n l\xE0 chuy\xEAn gia gh\xE9p nh\xE2n v\u1EADt v\xE0o b\u1ED1i c\u1EA3nh ki\u1EBFn tr\xFAc theo c\xE1ch si\xEAu th\u1EF1c.
Nhi\u1EC7m v\u1EE5:
- Gi\u1EEF nguy\xEAn khu\xF4n m\u1EB7t, v\xF3c d\xE1ng, qu\u1EA7n \xE1o v\xE0 nh\u1EADn di\u1EC7n c\u1EE7a ch\u1EE7 th\u1EC3 tham kh\u1EA3o.
- N\u1EBFu y\xEAu c\u1EA7u ng\u01B0\u1EDDi d\xF9ng tr\u1ED1ng, t\u1EF1 suy lu\u1EADn v\u1ECB tr\xED v\xE0 t\u01B0 th\u1EBF ph\xF9 h\u1EE3p v\u1EDBi \u1EA3nh n\u1EC1n.
- \u0110\u1ED3ng b\u1ED9 tuy\u1EC7t \u0111\u1ED1i \xE1nh s\xE1ng, m\xE0u m\xF4i tr\u01B0\u1EDDng, \u0111\u1ED5 b\xF3ng ti\u1EBFp x\xFAc v\xE0 ph\u1ED1i c\u1EA3nh.
- Cho ph\xE9p vi ch\u1EC9nh r\u1EA5t nh\u1EB9 v\u1EADt th\u1EC3 n\u1EC1n n\u1EBFu c\u1EA7n \u0111\u1EC3 t\u1EA1o ti\u1EBFp x\xFAc v\u1EADt l\xFD h\u1EE3p l\xFD.
- Kh\xF4ng \u0111\u1EC3 ch\u1EE7 th\u1EC3 b\u1ECB d\xE1n l\xEAn \u1EA3nh, l\u01A1 l\u1EEDng, sai t\u1EF7 l\u1EC7 ho\u1EB7c l\u1EC7ch h\u01B0\u1EDBng s\xE1ng.

Y\xEAu c\u1EA7u ng\u01B0\u1EDDi d\xF9ng: ${String(input.userAction || "")}`
              }
            ]
          }
        ],
        config: {
          imageConfig: input.imageConfig
        }
      };
    case "utility_layout_prompt": {
      const toolName = String(input.toolName || "");
      const selectedStyle = String(input.selectedStyle || "Kh\xF4ng c\xF3");
      let systemInstruction = "";
      let prompt;
      if (toolName === "Presentation Board") {
        systemInstruction = "B\u1EA1n l\xE0 chuy\xEAn gia thi\u1EBFt k\u1EBF \u0111\u1ED3 h\u1ECDa ki\u1EBFn tr\xFAc b\u1EADc th\u1EA7y. T\u1EA5t c\u1EA3 ch\u1EEF v\xE0 ch\xFA th\xEDch xu\u1EA5t hi\u1EC7n trong \u1EA3nh ph\u1EA3i b\u1EB1ng ti\u1EBFng Vi\u1EC7t r\xF5 r\xE0ng, tr\xECnh b\xE0y nh\u01B0 m\u1ED9t b\u1EA3ng thuy\u1EBFt tr\xECnh ki\u1EBFn tr\xFAc cao c\u1EA5p.";
        prompt = `T\u1EA1o m\u1ED9t b\u1EA3ng thuy\u1EBFt tr\xECnh ki\u1EBFn tr\xFAc ho\xE0n ch\u1EC9nh theo phong c\xE1ch ${selectedStyle}. \u1EA2nh ch\xEDnh l\xE0 c\xF4ng tr\xECnh tham kh\u1EA3o, xung quanh c\xF3 c\xE1c s\u01A1 \u0111\u1ED3 ph\xE2n t\xEDch, m\u1EB7t b\u1EB1ng, chi ti\u1EBFt v\u1EADt li\u1EC7u v\xE0 ch\xFA th\xEDch ti\u1EBFng Vi\u1EC7t s\u1EAFc n\xE9t. B\u1ED1 c\u1EE5c s\u1EA1ch, c\xE2n \u0111\u1ED1i, tr\xECnh b\xE0y nh\u01B0 poster ki\u1EBFn tr\xFAc chuy\xEAn nghi\u1EC7p.`;
      } else if (toolName === "Overall") {
        prompt = `Bi\u1EBFn c\xF4ng tr\xECnh tham kh\u1EA3o th\xE0nh m\u1ED9t b\u1EA3ng tr\xECnh b\xE0y t\u1ED5ng th\u1EC3 landscape 16:9 theo phong c\xE1ch ${selectedStyle}. \u1EA2nh ph\u1EA3i ph\u1EE7 k\xEDn n\u1EC1n, c\xF3 ti\xEAu \u0111\u1EC1 ki\u1EBFn tr\xFAc sang tr\u1ECDng, hai inset ph\xE2n t\xEDch nh\u1ECF, b\u1ED1 c\u1EE5c editorial cao c\u1EA5p, \u0111\u1ED3ng b\u1ED9 th\u1EA9m m\u1EF9.`;
      } else if (toolName === "Layout") {
        prompt = `T\u1EA1o m\u1ED9t competition board landscape 16:9 cho c\xF4ng tr\xECnh tham kh\u1EA3o theo phong c\xE1ch ${selectedStyle}. Trung t\xE2m l\xE0 exploded axonometric, xung quanh c\xF3 s\u01A1 \u0111\u1ED3 massing, m\u1EB7t c\u1EAFt, context map v\xE0 c\xE1c text block ng\u1EAFn, b\u1ED1 c\u1EE5c theo l\u01B0\u1EDBi Swiss Grid nghi\xEAm ng\u1EB7t.`;
      } else if (toolName === "Interior Moodboard") {
        prompt = `T\u1EA1o m\u1ED9t interior moodboard landscape cao c\u1EA5p cho kh\xF4ng gian tham kh\u1EA3o theo phong c\xE1ch ${selectedStyle}. Ph\u1EA3i c\xF3 hero render, material swatches, isometric cutaway v\xE0 v\xE0i furniture cutout n\u1ED5i tr\xEAn n\u1EC1n, b\u1ED1 c\u1EE5c catalogue hi\u1EC7n \u0111\u1EA1i.`;
      } else {
        const projectName = String(input.projectName || "ARCHITECTURAL PRESENTATION");
        prompt = `T\u1EA1o m\u1ED9t advanced architectural presentation board kh\u1ED5 d\u1ECDc 3:4 cho c\xF4ng tr\xECnh tham kh\u1EA3o theo phong c\xE1ch ${selectedStyle}. C\xF3 ti\xEAu \u0111\u1EC1 ${projectName}, b\u1ED1 c\u1EE5c 3 c\u1ED9t d\xE0y th\xF4ng tin, massing evolution, axonometric, n\u1ED9i th\u1EA5t, m\u1EB7t b\u1EB1ng, m\u1EB7t \u0111\u1EE9ng v\xE0 footer \u0111\u1ED3 \xE1n.`;
      }
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts2(input.images || []),
              { text: prompt }
            ]
          }
        ],
        systemInstruction: systemInstruction || void 0,
        config: {
          ...input.requestConfig
        }
      };
    }
    case "utility_process_prompt": {
      const userPrompt = String(input.userPrompt || "");
      const systemInstruction = String(input.systemInstruction || "");
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts2(input.images || []),
              { text: userPrompt }
            ]
          }
        ],
        systemInstruction,
        generationConfig: {
          imageConfig: {
            aspectRatio: String(input.aspectRatio || "1:1"),
            imageSize: String(input.imageSize || "1K")
          }
        }
      };
    }
    case "virtual_staging_prompt": {
      const mode = String(input.mode || "virtual");
      const roomType = String(input.roomType || "");
      const style = String(input.style || "");
      const requestNotes = String(input.requestNotes || "");
      const extraPrompt = String(input.extraPrompt || "");
      const shapesDescription = String(input.shapesDescription || "");
      const basePrompt = mode === "virtual" ? `B\u1EA1n l\xE0 chuy\xEAn gia thi\u1EBFt k\u1EBF n\u1ED9i th\u1EA5t v\xE0 d\xE0n d\u1EF1ng kh\xF4ng gian. H\xE3y th\u1EF1c hi\u1EC7n virtual staging cho c\u0103n ph\xF2ng tr\u1ED1ng n\xE0y theo phong c\xE1ch ${style}, c\xF4ng n\u0103ng ${roomType}. B\u1ED5 sung n\u1ED9i th\u1EA5t cao c\u1EA5p, \xE1nh s\xE1ng chuy\xEAn nghi\u1EC7p v\xE0 v\u1EADt li\u1EC7u ch\xE2n th\u1EF1c, nh\u01B0ng ph\u1EA3i gi\u1EEF chu\u1EA9n h\xECnh h\u1ECDc kh\xF4ng gian g\u1ED1c.` : shapesDescription ? "B\u1EA1n l\xE0 chuy\xEAn gia c\u1EA3i t\u1EA1o n\u1ED9i th\u1EA5t ch\xEDnh x\xE1c theo v\xF9ng ch\u1ECDn. Ch\u1EC9 \u0111\u01B0\u1EE3c ch\u1EC9nh s\u1EEDa b\xEAn trong c\xE1c marker \u0111\xE3 \u0111\xE1nh d\u1EA5u, m\u1ECDi khu v\u1EF1c ngo\xE0i marker ph\u1EA3i gi\u1EEF nguy\xEAn 1:1 so v\u1EDBi \u1EA3nh g\u1ED1c." : "B\u1EA1n l\xE0 chuy\xEAn gia c\u1EA3i t\u1EA1o n\u1ED9i th\u1EA5t. H\xE3y c\u1EA3i t\u1EA1o kh\xF4ng gian theo ghi ch\xFA ng\u01B0\u1EDDi d\xF9ng nh\u01B0ng ph\u1EA3i gi\u1EEF nguy\xEAn layout, c\u1EA5u tr\xFAc ki\u1EBFn tr\xFAc v\xE0 c\xE1c \u0111\u1ED3 v\u1EADt kh\xF4ng \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u thay \u0111\u1ED5i.";
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts2(input.images || []),
              {
                text: `${basePrompt}
${shapesDescription}
Ghi ch\xFA ng\u01B0\u1EDDi d\xF9ng: ${requestNotes || "Kh\xF4ng c\xF3"}
Y\xEAu c\u1EA7u b\u1ED5 sung: ${extraPrompt || "Kh\xF4ng c\xF3"}`
              }
            ]
          }
        ],
        systemInstruction: [
          "T\u1EA5t c\u1EA3 suy lu\u1EADn ph\u1EA3i \u01B0u ti\xEAn b\u1EA3o to\xE0n ph\u1ED1i c\u1EA3nh, t\u1EF7 l\u1EC7, c\u1EA5u tr\xFAc kh\xF4ng gian v\xE0 \xE1nh s\xE1ng th\u1EF1c t\u1EBF.",
          "N\u1EBFu l\xE0 ch\u1EC9nh s\u1EEDa ch\u1ECDn v\xF9ng, tuy\u1EC7t \u0111\u1ED1i kh\xF4ng l\xE0m thay \u0111\u1ED5i \u0111\u1ED3 v\u1EADt, c\xE2y xanh, v\u1EADt d\u1EE5ng hay chi ti\u1EBFt ngo\xE0i v\xF9ng \u0111\xE1nh d\u1EA5u.",
          "\u0110\u1EA7u ra ph\u1EA3i l\xE0 \u1EA3nh n\u1ED9i th\u1EA5t ch\xE2n th\u1EF1c, s\u1EA1ch l\u1ED7i, kh\xF4ng m\xE9o h\xECnh, kh\xF4ng th\xEAm v\u1EADt th\u1EC3 v\xF4 l\xFD."
        ].join(" ")
      };
    }
    default:
      throw new Error(`Unknown prompt template key: ${templateKey}`);
  }
}

// server/controller/gemini.controller.ts
var generateSchema = import_joi6.default.object({
  params: import_joi6.default.object({
    model: import_joi6.default.string().required().messages({
      "any.required": "T\xEAn model l\xE0 b\u1EAFt bu\u1ED9c.",
      "string.base": "T\xEAn model ph\u1EA3i l\xE0 chu\u1ED7i k\xFD t\u1EF1."
    }),
    contents: import_joi6.default.any().optional(),
    config: import_joi6.default.object().optional(),
    generationConfig: import_joi6.default.object().optional(),
    systemInstruction: import_joi6.default.any().optional(),
    promptTemplateKey: import_joi6.default.string().optional(),
    promptTemplateInput: import_joi6.default.object().optional()
  }).required()
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
      if (!params.contents && !params.promptTemplateKey) {
        res.status(400).json({
          success: false,
          message: "C\u1EA7n cung c\u1EA5p `contents` ho\u1EB7c `promptTemplateKey`."
        });
        return;
      }
      let finalParams = params;
      if (params.promptTemplateKey) {
        const resolved = resolvePromptTemplate(
          params.promptTemplateKey,
          params.promptTemplateInput || {}
        );
        finalParams = {
          ...params,
          ...resolved
        };
      }
      const userApiKey = req.headers["x-user-api-key"] || req.headers["X-User-Api-Key"] || req.body.userApiKey || "";
      logger.info(
        `[Gemini Controller] Handling generate request for model: ${finalParams?.model}, hasUserKey: ${!!userApiKey}, template: ${params?.promptTemplateKey || "none"}`
      );
      const response = await geminiService.generate(finalParams, userApiKey);
      res.status(200).json({
        success: true,
        data: response
      });
    } catch (err) {
      const errorObj = err;
      logger.error(`[Gemini Controller] Error: ${errorObj.message}`);
      const statusCode = errorObj.status || 500;
      let errMsg = errorObj.message || "L\u1ED7i x\u1EED l\xFD y\xEAu c\u1EA7u AI.";
      if (statusCode === 403) {
        errMsg = "D\u1EF1 \xE1n Google Cloud c\u1EE7a b\u1EA1n b\u1ECB t\u1EEB ch\u1ED1i truy c\u1EADp API Gemini.";
      } else if (statusCode === 400) {
        errMsg = "Tham s\u1ED1 y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c b\u1ECB t\u1EEB ch\u1ED1i b\u1EDFi quy t\u1EAFc an to\xE0n.";
      } else if (statusCode === 429) {
        errMsg = "Y\xEAu c\u1EA7u v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n t\u1EA7n su\u1EA5t c\u1EE7a API Key.";
      } else if (statusCode === 503) {
        errMsg = "D\u1ECBch v\u1EE5 AI c\u1EE7a Gemini hi\u1EC7n \u0111ang qu\xE1 t\u1EA3i ho\u1EB7c t\u1EA1m th\u1EDDi kh\xF4ng kh\u1EA3 d\u1EE5ng.";
      }
      res.status(statusCode).json({
        success: false,
        message: errMsg,
        details: errorObj.message
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
