import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import mongoose from "mongoose";

import documentRoutes from "./routes/documents";
import notesRoutes from "./routes/notes";
import aiRoutes from "./routes/ai";

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration supporting token-based mobile-ready API interactions (no cookies required)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Register API Routes
app.use("/api/documents", documentRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/ai", aiRoutes);

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

// Database and Server Bootstrap
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/family-vault";

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("Connected to MongoDB Atlas database successfully.");
    app.listen(PORT, () => {
      console.log(`Family Vault REST API server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.warn("MongoDB connection deferred. Starting server in offline/mock standby mode...", err.message);
    app.listen(PORT, () => {
      console.log(`Family Vault REST API server running in offline mode on port ${PORT}`);
    });
  });
