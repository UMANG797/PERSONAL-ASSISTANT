import { Router, Request, Response } from "express";
import mongoose, { Schema } from "mongoose";
import crypto from "crypto";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_super_secret_family_vault_key_2026!";

// 1. User Database Schema
const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

// 2. Native Crypto Password Hashing helpers (PBKDF2)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(":");
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return hash === originalHash;
  } catch (err) {
    return false;
  }
}

// 3. Native JWT Helpers
function base64url(source: Buffer): string {
  return source.toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

export function signJwt(payload: any, expiresInSeconds = 86400): string {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64url(Buffer.from(JSON.stringify(fullPayload)));

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET)
    .update(signatureInput)
    .digest();
  
  const encodedSignature = base64url(signature);
  return `${signatureInput}.${encodedSignature}`;
}

export function verifyJwt(token: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [header, payload, signature] = parts;
  const signatureInput = `${header}.${payload}`;
  const expectedSignature = base64url(
    crypto.createHmac("sha256", JWT_SECRET)
      .update(signatureInput)
      .digest()
  );

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
router.post("/register", async (req: Request, res: Response) => {
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
  } catch (err: any) {
    return res.status(500).json({ error: "Database error during registration", details: err.message });
  }
});

// Login User
router.post("/login", async (req: Request, res: Response) => {
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
  } catch (err: any) {
    return res.status(500).json({ error: "Database error during login", details: err.message });
  }
});

export default router;
export { UserModel };
