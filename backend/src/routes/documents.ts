import { Router, Request, Response } from "express";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import mongoose, { Schema } from "mongoose";
import { validateJwt, requireMultiTenancy } from "../middleware/auth";

const router = Router();

const FolderSchema = new Schema({
  auth0UserId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const FolderModel = mongoose.models.Folder || mongoose.model("Folder", FolderSchema);

// Mongoose Document Schema representing digitized metadata and embeddings
const DocumentSchema = new Schema({
  auth0UserId: { type: String, required: true, index: true },
  s3Key: { type: String, required: true },
  originalName: { type: String, required: true },
  rawOcrText: { type: String },
  category: { type: String, enum: ["Identity", "Finance", "Medical", "Other"], default: "Other" },
  structuredMetadata: { type: Schema.Types.Mixed, default: {} },
  embedding: { type: [Number] }, // Optional: For Atlas Vector Search Indexing
  scanned: { type: Boolean, default: true },
  folderId: { type: Schema.Types.ObjectId, ref: "Folder", default: null, index: true },
  createdAt: { type: Date, default: Date.now }
});

const DocumentModel = mongoose.models.Document || mongoose.model("Document", DocumentSchema);

// Initializing AWS Clients
const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const textractClient = new TextractClient({ region: process.env.AWS_REGION || "us-east-1" });
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

// 1. S3 Pre-signed URL generation endpoint
router.get("/upload-url", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  const fileName = req.query.fileName as string || "document.pdf";
  const s3Key = `uploads/${req.auth0UserId}/${Date.now()}-${fileName}`;

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME || "family-vault-bucket",
      Key: s3Key,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return res.status(200).json({
      uploadUrl,
      s3Key,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to generate pre-signed upload URL", details: err.message });
  }
});

// 2. AWS Textract OCR & Claude parsing endpoint
router.post("/process", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  const { s3Key, originalName, folderId, scan } = req.body;

  if (!s3Key) {
    return res.status(400).json({ error: "s3Key is required to process the file." });
  }

  // Determine if we should perform OCR & AI scanning (default is true if not specified)
  const shouldScan = scan !== false;

  try {
    let rawText = "";
    let extractedData = { category: "Other", extractedFields: {} };
    let embedding: number[] = [];

    if (shouldScan) {
      // A. Detect Document Text via AWS Textract
      const textractCommand = new DetectDocumentTextCommand({
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

      const converseCommand = new ConverseCommand({
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
      } catch (e) {
        console.warn("Failed to parse JSON from Nova response:", e);
      }

      // C. Vector Embeddings Generation via Titan
      const titanPayload = {
        inputText: rawText || "Empty document",
      };

      const bedrockTitanCommand = new InvokeModelCommand({
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
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to digitize document", details: err.message });
  }
});

// 3. List all documents
router.get("/", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  try {
    const documents = await DocumentModel.find({ auth0UserId: req.auth0UserId })
      .select("-embedding")
      .sort({ createdAt: -1 });
    return res.status(200).json(documents);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to list documents", details: err.message });
  }
});

// 4. Rename or Move a document
router.patch("/:id", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  const { originalName, folderId } = req.body;
  const { id } = req.params;

  try {
    const updateData: any = {};
    if (originalName !== undefined) updateData.originalName = originalName;
    if (folderId !== undefined) updateData.folderId = folderId === "" ? null : folderId;

    const doc = await DocumentModel.findOneAndUpdate(
      { _id: id, auth0UserId: req.auth0UserId },
      updateData,
      { new: true }
    ).select("-embedding");

    if (!doc) {
      return res.status(404).json({ error: "Document not found." });
    }

    return res.status(200).json(doc);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update document", details: err.message });
  }
});

// 5. Delete a document
router.delete("/:id", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const doc = await DocumentModel.findOne({ _id: id, auth0UserId: req.auth0UserId });
    if (!doc) {
      return res.status(404).json({ error: "Document not found." });
    }

    // Attempt to delete from S3
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME || "zedy",
        Key: doc.s3Key,
      });
      await s3Client.send(deleteCommand);
    } catch (s3Err: any) {
      console.warn(`S3 object deletion warning for key ${doc.s3Key}:`, s3Err.message);
    }

    await DocumentModel.deleteOne({ _id: id });
    return res.status(200).json({ message: "Document deleted successfully." });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete document", details: err.message });
  }
});

// 6. Folders Endpoints
router.get("/folders", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  try {
    const folders = await FolderModel.find({ auth0UserId: req.auth0UserId }).sort({ name: 1 });
    return res.status(200).json(folders);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to list folders", details: err.message });
  }
});

router.post("/folders", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
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
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create folder", details: err.message });
  }
});

router.patch("/folders/:id", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  const { name } = req.body;
  const { id } = req.params;

  if (!name) {
    return res.status(400).json({ error: "Folder name is required." });
  }

  try {
    const folder = await FolderModel.findOneAndUpdate(
      { _id: id, auth0UserId: req.auth0UserId },
      { name },
      { new: true }
    );
    if (!folder) {
      return res.status(404).json({ error: "Folder not found." });
    }
    return res.status(200).json(folder);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update folder", details: err.message });
  }
});

router.delete("/folders/:id", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const folder = await FolderModel.findOne({ _id: id, auth0UserId: req.auth0UserId });
    if (!folder) {
      return res.status(404).json({ error: "Folder not found." });
    }

    // Move all files in this folder to the root (null)
    await DocumentModel.updateMany(
      { folderId: id, auth0UserId: req.auth0UserId },
      { folderId: null }
    );

    await FolderModel.deleteOne({ _id: id });
    return res.status(200).json({ message: "Folder deleted. Contained files moved to root." });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete folder", details: err.message });
  }
});

// 7. Get S3 pre-signed GET URL for downloading/previewing
router.get("/download-url/:id", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const doc = await DocumentModel.findOne({ _id: id, auth0UserId: req.auth0UserId });
    if (!doc) {
      return res.status(404).json({ error: "Document not found." });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME || "zedy",
      Key: doc.s3Key,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return res.status(200).json({ downloadUrl });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to generate download URL", details: err.message });
  }
});

export default router;
export { DocumentModel, FolderModel };
