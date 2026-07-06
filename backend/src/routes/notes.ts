import { Router, Request, Response } from "express";
import mongoose, { Schema } from "mongoose";
import { validateJwt, requireMultiTenancy } from "../middleware/auth";

const router = Router();

const NoteSchema = new Schema({
  auth0UserId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  content: { type: Schema.Types.Mixed, required: true }, // Structured JSON format from Tiptap editor.getJSON()
  updatedAt: { type: Date, default: Date.now }
});

const NoteModel = mongoose.models.Note || mongoose.model("Note", NoteSchema);

// CREATE or UPDATE Note
router.post("/", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  const { id, title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Title and structured content are required." });
  }

  try {
    let note;
    if (id) {
      // Tenant isolated update
      note = await NoteModel.findOneAndUpdate(
        { _id: id, auth0UserId: req.auth0UserId },
        { title, content, updatedAt: new Date() },
        { new: true }
      );
      if (!note) return res.status(404).json({ error: "Note not found or access denied." });
    } else {
      // Create new Note
      note = new NoteModel({
        auth0UserId: req.auth0UserId,
        title,
        content,
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
