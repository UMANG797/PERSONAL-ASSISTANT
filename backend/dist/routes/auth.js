"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.signJwt = signJwt;
exports.verifyJwt = verifyJwt;
const express_1 = require("express");
const mongoose_1 = __importStar(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_super_secret_family_vault_key_2026!";
// 1. User Database Schema
const UserSchema = new mongoose_1.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const UserModel = mongoose_1.default.models.User || mongoose_1.default.model("User", UserSchema);
exports.UserModel = UserModel;
// 2. Native Crypto Password Hashing helpers (PBKDF2)
function hashPassword(password) {
    const salt = crypto_1.default.randomBytes(16).toString("hex");
    const hash = crypto_1.default.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return `${salt}:${hash}`;
}
function verifyPassword(password, storedHash) {
    try {
        const [salt, originalHash] = storedHash.split(":");
        const hash = crypto_1.default.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
        return hash === originalHash;
    }
    catch (err) {
        return false;
    }
}
// 3. Native JWT Helpers
function base64url(source) {
    return source.toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}
function base64urlDecode(str) {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
        base64 += "=";
    }
    return Buffer.from(base64, "base64").toString("utf8");
}
function signJwt(payload, expiresInSeconds = 86400) {
    const header = { alg: "HS256", typ: "JWT" };
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const fullPayload = { ...payload, exp };
    const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
    const encodedPayload = base64url(Buffer.from(JSON.stringify(fullPayload)));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto_1.default.createHmac("sha256", JWT_SECRET)
        .update(signatureInput)
        .digest();
    const encodedSignature = base64url(signature);
    return `${signatureInput}.${encodedSignature}`;
}
function verifyJwt(token) {
    const parts = token.split(".");
    if (parts.length !== 3) {
        throw new Error("Invalid token format");
    }
    const [header, payload, signature] = parts;
    const signatureInput = `${header}.${payload}`;
    const expectedSignature = base64url(crypto_1.default.createHmac("sha256", JWT_SECRET)
        .update(signatureInput)
        .digest());
    if (signature !== expectedSignature) {
        throw new Error("Signature verification failed");
    }
    const decodedPayload = JSON.parse(base64urlDecode(payload));
    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error("Token expired");
    }
    return decodedPayload;
}
// 4. API Endpoints
// Register User
router.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }
    try {
        const existingUser = await UserModel.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: "Username is already taken." });
        }
        const hashedPassword = hashPassword(password);
        const user = new UserModel({
            username,
            password: hashedPassword
        });
        await user.save();
        return res.status(201).json({ message: "User registered successfully." });
    }
    catch (err) {
        return res.status(500).json({ error: "Database error during registration", details: err.message });
    }
});
// Login User
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }
    try {
        const user = await UserModel.findOne({ username: username.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: "Invalid username or password." });
        }
        const isMatch = verifyPassword(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid username or password." });
        }
        // Generate custom JWT
        const token = signJwt({
            userId: user._id.toString(),
            username: user.username
        });
        return res.status(200).json({
            token,
            user: {
                id: user._id.toString(),
                username: user.username
            }
        });
    }
    catch (err) {
        return res.status(500).json({ error: "Database error during login", details: err.message });
    }
});
exports.default = router;
