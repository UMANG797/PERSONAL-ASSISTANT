"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const documents_1 = __importDefault(require("./routes/documents"));
const notes_1 = __importDefault(require("./routes/notes"));
const ai_1 = __importDefault(require("./routes/ai"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// CORS configuration supporting token-based mobile-ready API interactions (no cookies required)
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express_1.default.json());
// Register API Routes
app.use("/api/documents", documents_1.default);
app.use("/api/notes", notes_1.default);
app.use("/api/ai", ai_1.default);
// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date() });
});
// Database and Server Bootstrap
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/family-vault";
mongoose_1.default
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
