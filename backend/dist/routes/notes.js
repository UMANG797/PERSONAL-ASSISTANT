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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteModel = void 0;
const express_1 = require("express");
const mongoose_1 = __importStar(require("mongoose"));
const auth_1 = require("../middleware/auth");
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const router = (0, express_1.Router)();
const bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient({ region: "us-east-1" });
const NoteSchema = new mongoose_1.Schema({
    auth0UserId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    content: { type: mongoose_1.Schema.Types.Mixed, required: true }, // Structured JSON format from Tiptap editor.getJSON()
    rawText: { type: String },
    embedding: { type: [Number] },
    updatedAt: { type: Date, default: Date.now }
});
const NoteModel = mongoose_1.default.models.Note || mongoose_1.default.model("Note", NoteSchema);
exports.NoteModel = NoteModel;
// Recursive helper function to extract raw text from Tiptap JSON structure
function extractTextFromTiptap(node) {
    if (!node)
        return "";
    if (typeof node === "string")
        return node;
    if (node.type === "text" && node.text) {
        return node.text;
    }
    if (Array.isArray(node.content)) {
        return node.content.map(extractTextFromTiptap).join(" ");
    }
    if (node.content) {
        return extractTextFromTiptap(node.content);
    }
    return "";
}
// CREATE or UPDATE Note
router.post("/", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    const { id, title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ error: "Title and structured content are required." });
    }
    try {
        const rawText = extractTextFromTiptap(content);
        let embedding = [];
        // Generate Titan Embeddings for the note
        try {
            const titanPayload = {
                inputText: `${title}\n${rawText}`.trim() || "Empty note",
            };
            const bedrockTitanCommand = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: "amazon.titan-embed-text-v2:0",
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify(titanPayload),
            });
            const bedrockTitanResponse = await bedrockClient.send(bedrockTitanCommand);
            const titanResult = JSON.parse(new TextDecoder().decode(bedrockTitanResponse.body));
            embedding = titanResult.embedding;
        }
        catch (embErr) {
            console.warn("Could not generate note embedding:", embErr.message);
        }
        let note;
        if (id) {
            // Tenant isolated update
            note = await NoteModel.findOneAndUpdate({ _id: id, auth0UserId: req.auth0UserId }, { title, content, rawText, embedding, updatedAt: new Date() }, { new: true });
            if (!note)
                return res.status(404).json({ error: "Note not found or access denied." });
        }
        else {
            // Create new Note
            note = new NoteModel({
                auth0UserId: req.auth0UserId,
                title,
                content,
                rawText,
                embedding,
            });
            await note.save();
        }
        return res.status(200).json({ message: "Note saved successfully", note });
    }
    catch (err) {
        return res.status(500).json({ error: "Database error saving note", details: err.message });
    }
});
// READ notes (Isolated by tenant)
router.get("/", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    try {
        const notes = await NoteModel.find({ auth0UserId: req.auth0UserId }).sort({ updatedAt: -1 });
        return res.status(200).json(notes);
    }
    catch (err) {
        return res.status(500).json({ error: "Database error loading notes", details: err.message });
    }
});
// DELETE Note
router.delete("/:id", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    try {
        const note = await NoteModel.findOneAndDelete({ _id: req.params.id, auth0UserId: req.auth0UserId });
        if (!note)
            return res.status(404).json({ error: "Note not found or access denied." });
        return res.status(200).json({ message: "Note deleted successfully" });
    }
    catch (err) {
        return res.status(500).json({ error: "Database error deleting note", details: err.message });
    }
});
exports.default = router;
