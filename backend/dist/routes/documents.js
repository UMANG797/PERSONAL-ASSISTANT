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
exports.FolderModel = exports.DocumentModel = void 0;
const express_1 = require("express");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const client_textract_1 = require("@aws-sdk/client-textract");
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const mongoose_1 = __importStar(require("mongoose"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const FolderSchema = new mongoose_1.Schema({
    auth0UserId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const FolderModel = mongoose_1.default.models.Folder || mongoose_1.default.model("Folder", FolderSchema);
exports.FolderModel = FolderModel;
// Mongoose Document Schema representing digitized metadata and embeddings
const DocumentSchema = new mongoose_1.Schema({
    auth0UserId: { type: String, required: true, index: true },
    s3Key: { type: String, required: true },
    originalName: { type: String, required: true },
    rawOcrText: { type: String },
    category: { type: String, enum: ["Identity", "Finance", "Medical", "Other"], default: "Other" },
    structuredMetadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    embedding: { type: [Number] }, // Optional: For Atlas Vector Search Indexing
    scanned: { type: Boolean, default: true },
    folderId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Folder", default: null, index: true },
    createdAt: { type: Date, default: Date.now }
});
const DocumentModel = mongoose_1.default.models.Document || mongoose_1.default.model("Document", DocumentSchema);
exports.DocumentModel = DocumentModel;
// Initializing AWS Clients
const s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const textractClient = new client_textract_1.TextractClient({ region: process.env.AWS_REGION || "us-east-1" });
const bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient({ region: "us-east-1" });
// 1. S3 Pre-signed URL generation endpoint
router.get("/upload-url", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    const fileName = req.query.fileName || "document.pdf";
    const s3Key = `uploads/${req.auth0UserId}/${Date.now()}-${fileName}`;
    try {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME || "family-vault-bucket",
            Key: s3Key,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: 3600 });
        return res.status(200).json({
            uploadUrl,
            s3Key,
        });
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to generate pre-signed upload URL", details: err.message });
    }
});
// 2. AWS Textract OCR & Claude parsing endpoint
router.post("/process", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    const { s3Key, originalName, folderId, scan } = req.body;
    if (!s3Key) {
        return res.status(400).json({ error: "s3Key is required to process the file." });
    }
    // Determine if we should perform OCR & AI scanning (default is true if not specified)
    const shouldScan = scan !== false;
    try {
        let rawText = "";
        let extractedData = { category: "Other", extractedFields: {} };
        let embedding = [];
        if (shouldScan) {
            // A. Detect Document Text via AWS Textract
            const textractCommand = new client_textract_1.DetectDocumentTextCommand({
                Document: {
                    S3Object: {
                        Bucket: process.env.AWS_S3_BUCKET_NAME || "family-vault-bucket",
                        Name: s3Key,
                    },
                },
            });
            const textractResponse = await textractClient.send(textractCommand);
            rawText = (textractResponse.Blocks || [])
                .filter((block) => block.BlockType === "LINE")
                .map((block) => block.Text)
                .join(" ");
            // B. Structured Metadata Extraction via Bedrock (Amazon Nova Micro)
            const novaPrompt = `Extract key details from this document text. Identify the Category (choose only from: Identity, Finance, Medical, Other). Extrapolate any ID numbers (like Aadhaar, PAN, Passport numbers) and Expiry Dates. Return ONLY a valid JSON object structure like: {"category": "Identity", "extractedFields": {"idNumber": "1234-5678-9012", "expiryDate": "2029-12-31"}}. Text:\n\n${rawText}`;
            const converseCommand = new client_bedrock_runtime_1.ConverseCommand({
                modelId: "amazon.nova-micro-v1:0",
                messages: [
                    {
                        role: "user",
                        content: [{ text: novaPrompt }]
                    }
                ],
                inferenceConfig: {
                    maxTokens: 500,
                    temperature: 0
                }
            });
            const converseResponse = await bedrockClient.send(converseCommand);
            const rawOutputText = converseResponse.output?.message?.content?.[0]?.text || "";
            try {
                const jsonStart = rawOutputText.indexOf("{");
                const jsonEnd = rawOutputText.lastIndexOf("}");
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    extractedData = JSON.parse(rawOutputText.substring(jsonStart, jsonEnd + 1));
                }
            }
            catch (e) {
                console.warn("Failed to parse JSON from Nova response:", e);
            }
            // C. Vector Embeddings Generation via Titan
            const titanPayload = {
                inputText: rawText || "Empty document",
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
        // D. Persist structured record and vectors inside MongoDB Atlas
        const newDoc = new DocumentModel({
            auth0UserId: req.auth0UserId,
            s3Key,
            originalName,
            rawOcrText: rawText,
            category: extractedData.category || "Other",
            structuredMetadata: extractedData.extractedFields || {},
            embedding: shouldScan ? embedding : undefined,
            scanned: shouldScan,
            folderId: folderId || null,
        });
        await newDoc.save();
        return res.status(200).json({
            message: shouldScan ? "Document processed and indexed successfully" : "Document saved successfully (skipped scanning)",
            document: {
                id: newDoc._id,
                category: newDoc.category,
                structuredMetadata: newDoc.structuredMetadata,
                scanned: newDoc.scanned,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to digitize document", details: err.message });
    }
});
// 3. List all documents
router.get("/", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    try {
        const documents = await DocumentModel.find({ auth0UserId: req.auth0UserId })
            .select("-embedding")
            .sort({ createdAt: -1 });
        return res.status(200).json(documents);
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to list documents", details: err.message });
    }
});
// 4. Rename or Move a document
router.patch("/:id", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    const { originalName, folderId } = req.body;
    const { id } = req.params;
    try {
        const updateData = {};
        if (originalName !== undefined)
            updateData.originalName = originalName;
        if (folderId !== undefined)
            updateData.folderId = folderId === "" ? null : folderId;
        const doc = await DocumentModel.findOneAndUpdate({ _id: id, auth0UserId: req.auth0UserId }, updateData, { new: true }).select("-embedding");
        if (!doc) {
            return res.status(404).json({ error: "Document not found." });
        }
        return res.status(200).json(doc);
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to update document", details: err.message });
    }
});
// 5. Delete a document
router.delete("/:id", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    const { id } = req.params;
    try {
        const doc = await DocumentModel.findOne({ _id: id, auth0UserId: req.auth0UserId });
        if (!doc) {
            return res.status(404).json({ error: "Document not found." });
        }
        // Attempt to delete from S3
        try {
            const deleteCommand = new client_s3_1.DeleteObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME || "zedy",
                Key: doc.s3Key,
            });
            await s3Client.send(deleteCommand);
        }
        catch (s3Err) {
            console.warn(`S3 object deletion warning for key ${doc.s3Key}:`, s3Err.message);
        }
        await DocumentModel.deleteOne({ _id: id });
        return res.status(200).json({ message: "Document deleted successfully." });
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to delete document", details: err.message });
    }
});
// 6. Folders Endpoints
router.get("/folders", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    try {
        const folders = await FolderModel.find({ auth0UserId: req.auth0UserId }).sort({ name: 1 });
        return res.status(200).json(folders);
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to list folders", details: err.message });
    }
});
router.post("/folders", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: "Folder name is required." });
    }
    try {
        const folder = new FolderModel({
            auth0UserId: req.auth0UserId,
            name,
        });
        await folder.save();
        return res.status(201).json(folder);
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to create folder", details: err.message });
    }
});
router.patch("/folders/:id", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    const { name } = req.body;
    const { id } = req.params;
    if (!name) {
        return res.status(400).json({ error: "Folder name is required." });
    }
    try {
        const folder = await FolderModel.findOneAndUpdate({ _id: id, auth0UserId: req.auth0UserId }, { name }, { new: true });
        if (!folder) {
            return res.status(404).json({ error: "Folder not found." });
        }
        return res.status(200).json(folder);
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to update folder", details: err.message });
    }
});
router.delete("/folders/:id", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    const { id } = req.params;
    try {
        const folder = await FolderModel.findOne({ _id: id, auth0UserId: req.auth0UserId });
        if (!folder) {
            return res.status(404).json({ error: "Folder not found." });
        }
        // Move all files in this folder to the root (null)
        await DocumentModel.updateMany({ folderId: id, auth0UserId: req.auth0UserId }, { folderId: null });
        await FolderModel.deleteOne({ _id: id });
        return res.status(200).json({ message: "Folder deleted. Contained files moved to root." });
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to delete folder", details: err.message });
    }
});
// 7. Get S3 pre-signed GET URL for downloading/previewing
router.get("/download-url/:id", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    const { id } = req.params;
    try {
        const doc = await DocumentModel.findOne({ _id: id, auth0UserId: req.auth0UserId });
        if (!doc) {
            return res.status(404).json({ error: "Document not found." });
        }
        const command = new client_s3_1.GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME || "zedy",
            Key: doc.s3Key,
        });
        const downloadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: 3600 });
        return res.status(200).json({ downloadUrl });
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to generate download URL", details: err.message });
    }
});
exports.default = router;
