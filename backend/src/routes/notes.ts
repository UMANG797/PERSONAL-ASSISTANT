import { Router, Request, Response } from "express";
import mongoose, { Schema } from "mongoose";
import { validateJwt, requireMultiTenancy } from "../middleware/auth";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const router = Router();
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

const NoteSchema = new Schema({
  auth0UserId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  content: { type: Schema.Types.Mixed, required: true }, // Structured JSON format from Tiptap editor.getJSON()
  rawText: { type: String },
  embedding: { type: [Number] },
  updatedAt: { type: Date, default: Date.now }
});

const NoteModel = mongoose.models.Note || mongoose.model("Note", NoteSchema);

// Recursive helper function to extract raw text from Tiptap JSON structure
function extractTextFromTiptap(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
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
router.post("/", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  const { id, title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Title and structured content are required." });
  }

  try {
    const rawText = extractTextFromTiptap(content);
    let embedding: number[] = [];

    // Generate Titan Embeddings for the note
    try {
      const titanPayload = {
        inputText: `${title}\n${rawText}`.trim() || "Empty note",
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
    } catch (embErr: any) {
      console.warn("Could not generate note embedding:", embErr.message);
    }

    let note;
    if (id) {
      // Tenant isolated update
      note = await NoteModel.findOneAndUpdate(
        { _id: id, auth0UserId: req.auth0UserId },
        { title, content, rawText, embedding, updatedAt: new Date() },
        { new: true }
      );
      if (!note) return res.status(404).json({ error: "Note not found or access denied." });
    } else {
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
  } catch (err: any) {
    return res.status(500).json({ error: "Database error saving note", details: err.message });
  }
});

// READ notes (Isolated by tenant)
router.get("/", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  try {
    const notes = await NoteModel.find({ auth0UserId: req.auth0UserId }).sort({ updatedAt: -1 });
    return res.status(200).json(notes);
  } catch (err: any) {
    return res.status(500).json({ error: "Database error loading notes", details: err.message });
  }
});

// DELETE Note
router.delete("/:id", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  try {
    const note = await NoteModel.findOneAndDelete({ _id: req.params.id, auth0UserId: req.auth0UserId });
    if (!note) return res.status(404).json({ error: "Note not found or access denied." });
    return res.status(200).json({ message: "Note deleted successfully" });
  } catch (err: any) {
    return res.status(500).json({ error: "Database error deleting note", details: err.message });
  }
});

export default router;
export { NoteModel };

