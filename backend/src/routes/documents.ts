import { Router, Request, Response } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import mongoose, { Schema } from "mongoose";
import { validateJwt, requireMultiTenancy } from "../middleware/auth";

const router = Router();

// Mongoose Document Schema representing digitized metadata and embeddings
const DocumentSchema = new Schema({
  auth0UserId: { type: String, required: true, index: true },
  s3Key: { type: String, required: true },
  originalName: { type: String, required: true },
  rawOcrText: { type: String },
  category: { type: String, enum: ["Identity", "Finance", "Medical", "Other"], default: "Other" },
  structuredMetadata: { type: Schema.Types.Mixed, default: {} },
  embedding: { type: [Number], required: true }, // For Atlas Vector Search Indexing
  createdAt: { type: Date, default: Date.now }
});

const DocumentModel = mongoose.models.Document || mongoose.model("Document", DocumentSchema);

// Initializing AWS Clients
const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const textractClient = new TextractClient({ region: process.env.AWS_REGION || "us-east-1" });
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

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
  const { s3Key, originalName } = req.body;

  if (!s3Key) {
    return res.status(400).json({ error: "s3Key is required to process the file." });
  }

  try {
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
    const rawText = (textractResponse.Blocks || [])
      .filter((block) => block.BlockType === "LINE")
      .map((block) => block.Text)
      .join(" ");

    // B. Structured Metadata Extraction via Bedrock (Claude)
    const claudePayload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Extract key details from this document text. Identify the Category (choose only from: Identity, Finance, Medical, Other). Extrapolate any ID numbers (like Aadhaar, PAN, Passport numbers) and Expiry Dates. Return ONLY a valid JSON object structure like: {"category": "Identity", "extractedFields": {"idNumber": "1234-5678-9012", "expiryDate": "2029-12-31"}}. Text:\n\n${rawText}`,
        },
      ],
    };

    const bedrockClaudeCommand = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(claudePayload),
    });

    const bedrockClaudeResponse = await bedrockClient.send(bedrockClaudeCommand);
    const claudeResult = JSON.parse(new TextDecoder().decode(bedrockClaudeResponse.body));
    const extractedData = JSON.parse(claudeResult.content[0].text);

    // C. Vector Embeddings Generation via Titan
    const titanPayload = {
      inputText: rawText || "Empty document",
    };

    const bedrockTitanCommand = new InvokeModelCommand({
      modelId: "amazon.titan-embed-text-v1",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(titanPayload),
    });

    const bedrockTitanResponse = await bedrockClient.send(bedrockTitanCommand);
    const titanResult = JSON.parse(new TextDecoder().decode(bedrockTitanResponse.body));
    const embedding = titanResult.embedding;

    // D. Persist structured record and vectors inside MongoDB Atlas
    const newDoc = new DocumentModel({
      auth0UserId: req.auth0UserId,
      s3Key,
      originalName,
      rawOcrText: rawText,
      category: extractedData.category || "Other",
      structuredMetadata: extractedData.extractedFields || {},
      embedding,
    });

    await newDoc.save();

    return res.status(200).json({
      message: "Document processed and indexed successfully",
      document: {
        id: newDoc._id,
        category: newDoc.category,
        structuredMetadata: newDoc.structuredMetadata,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to digitize document", details: err.message });
  }
});

export default router;
export { DocumentModel };
