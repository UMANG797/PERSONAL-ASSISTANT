"use client";

import React, { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { Bold, Italic, List, Highlighter, Save } from "lucide-react";

interface NoteEditorProps {
  noteId: string;
}

export default function NoteEditor({ noteId }: NoteEditorProps) {
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
    ],
    content: "<p>Write your secure family notes here...</p>",
  });

  useEffect(() => {
    // Mimic database load for structured JSON
    if (noteId === "sample-1") {
      setTitle("Wifi Password & Locks");
      editor?.commands.setContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Wifi Network Name: Home_Vault" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Wifi Password: " }, { type: "text", marks: [{ type: "bold" }], text: "SafeFamily2026!" }],
          },
        ],
      });
    } else if (noteId === "sample-2") {
      setTitle("Daily Medication Times");
      editor?.commands.setContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Morning (8:00 AM): Blue pill (blood pressure)" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Evening (7:00 PM): Calcium supplement" }],
          },
        ],
      });
    } else {
      setTitle("New Notes entry");
      editor?.commands.setContent("<p>Start typing...</p>");
    }
  }, [noteId, editor]);

  const handleSave = async () => {
    if (!editor) return;

    // Retrieve note content as structured JSON format (TipTap editor.getJSON())
    const jsonContent = editor.getJSON();
    setSaveStatus("Saving...");

    try {
      // Mock API post request structure matching notes CRUD API
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Authorization token header is fetched dynamically
        },
        body: JSON.stringify({
          title,
          content: jsonContent,
        }),
      });

      setSaveStatus("Saved successfully!");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setSaveStatus("Mock saved!");
      setTimeout(() => setSaveStatus(""), 3000);
    }
  };

  if (!editor) return null;

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-100 pb-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note Title..."
          className="text-2xl font-bold border-b-2 border-transparent hover:border-slate-300 focus:border-blue-900 focus:outline-none w-full sm:w-1/2"
        />
        <div className="flex items-center space-x-3">
          {saveStatus && <span className="text-slate-500 font-semibold text-lg">{saveStatus}</span>}
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-5 py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold text-lg shadow-md transition-colors"
          >
            <Save className="h-5 w-5" />
            <span>Save Note</span>
          </button>
        </div>
      </div>

      {/* Editor Toolbar with Large, Easy to Click Controls */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-3 rounded-lg border-2 font-bold ${
            editor.isActive("bold") ? "bg-blue-100 border-blue-900 text-blue-900" : "bg-white border-slate-200"
          }`}
          title="Bold Text"
        >
          <Bold className="h-6 w-6" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-3 rounded-lg border-2 ${
            editor.isActive("italic") ? "bg-blue-100 border-blue-900 text-blue-900" : "bg-white border-slate-200"
          }`}
          title="Italic Text"
        >
          <Italic className="h-6 w-6" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-3 rounded-lg border-2 ${
            editor.isActive("bulletList") ? "bg-blue-100 border-blue-900 text-blue-900" : "bg-white border-slate-200"
          }`}
          title="Bullet List"
        >
          <List className="h-6 w-6" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
          className={`p-3 rounded-lg border-2 ${
            editor.isActive("highlight") ? "bg-blue-100 border-blue-900 text-blue-900" : "bg-white border-slate-200"
          }`}
          title="Highlight Yellow"
        >
          <Highlighter className="h-6 w-6" />
        </button>
      </div>

      {/* Actual Editor Content Area */}
      <div className="border-2 border-slate-200 focus-within:border-blue-950 rounded-xl p-4 min-h-[300px] text-xl prose max-w-none focus:outline-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
