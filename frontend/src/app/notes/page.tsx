"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import {
  Search,
  Plus,
  Trash2,
  Bold,
  Italic,
  List,
  Highlighter,
  Save,
  ChevronLeft,
  FileText
} from "lucide-react";

interface Note {
  _id: string;
  title: string;
  content: any;
  rawText?: string;
  updatedAt: string;
}

export default function NotesPage() {
  const { user, isLoading: authLoading } = useUser();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // for mobile responsiveness

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
    ],
    content: "<p>Start writing your family note here...</p>",
  });

  const activeNote = notes.find((n) => n._id === selectedNoteId);

  // Fetch all notes
  const fetchNotes = async (selectFirst = false) => {
    try {
      const tokenRes = await fetch("/api/auth/token");
      let token = "";
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData.accessToken || "";
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/notes`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
        if (selectFirst && data.length > 0) {
          setSelectedNoteId(data[0]._id);
        }
      }
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotes(true);
    }
  }, [user]);

  // Load selected note into editor
  useEffect(() => {
    if (activeNote && editor) {
      setTitle(activeNote.title);
      editor.commands.setContent(activeNote.content);
    } else if (!selectedNoteId && editor) {
      setTitle("");
      editor.commands.setContent("<p>Start writing your family note here...</p>");
    }
  }, [selectedNoteId, editor]);

  // Create a new note
  const handleCreateNote = async () => {
    try {
      const tokenRes = await fetch("/api/auth/token");
      let token = "";
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData.accessToken || "";
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: "New Note",
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Start writing..." }] }]
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        await fetchNotes();
        setSelectedNoteId(data.note._id);
        setIsSidebarOpen(false); // view note directly on mobile
      }
    } catch (err) {
      console.error("Error creating note:", err);
    }
  };

  // Save active note
  const handleSaveNote = async () => {
    if (!selectedNoteId || !editor) return;

    setSaveStatus("Saving...");
    try {
      const tokenRes = await fetch("/api/auth/token");
      let token = "";
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData.accessToken || "";
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          id: selectedNoteId,
          title: title.trim() || "Untitled Note",
          content: editor.getJSON()
        })
      });

      if (res.ok) {
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(""), 2000);
        fetchNotes();
      } else {
        setSaveStatus("Error saving");
      }
    } catch (err) {
      console.error("Error saving note:", err);
      setSaveStatus("Error saving");
    }
  };

  // Delete active note
  const handleDeleteNote = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const tokenRes = await fetch("/api/auth/token");
      let token = "";
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData.accessToken || "";
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/notes/${id}`, {
        method: "DELETE",
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });

      if (res.ok) {
        setSelectedNoteId(null);
        fetchNotes(true);
        setIsSidebarOpen(true); // go back to sidebar on mobile
      }
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  // Filtering notes client-side
  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.rawText && note.rawText.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Formatting Date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xl font-semibold text-slate-600">Verifying session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border-4 border-amber-500 shadow-xl space-y-6">
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-amber-50 border-4 border-amber-500 text-amber-500">
            <FileText className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900">Family Notebook</h2>
          <p className="text-slate-600">Please sign in to read or write secure family notes.</p>
          <a
            href="/api/auth/login"
            className="block w-full py-3 px-6 border-4 border-amber-500 text-lg font-bold rounded-2xl text-white bg-amber-500 hover:bg-amber-600 transition-all duration-150"
          >
            Sign In to Notebook
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[750px] bg-[#fbfbf9] border-2 border-slate-200 rounded-3xl overflow-hidden shadow-lg relative">
      {/* Sidebar - Note List */}
      <aside
        className={`w-full md:w-[320px] bg-[#f4f3ef] border-r border-slate-200 flex flex-col z-20 transition-all duration-300 absolute md:relative inset-y-0 left-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-[#ebeae6]">
          <h2 className="text-xl font-bold text-slate-800">Notebook</h2>
          <button
            onClick={handleCreateNote}
            className="p-2 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors border border-transparent hover:border-amber-300"
            title="New Note"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-200 bg-[#ebeae6]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[#fcfcfb] border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Note Rows */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">No notes found.</p>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isSelected = note._id === selectedNoteId;
              return (
                <div
                  key={note._id}
                  onClick={() => {
                    setSelectedNoteId(note._id);
                    setIsSidebarOpen(false);
                  }}
                  className={`p-4 border-b border-slate-200 cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? "bg-amber-100/60 border-l-4 border-l-amber-500"
                      : "hover:bg-slate-200/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 truncate max-w-[180px]">
                      {note.title.trim() || "Untitled Note"}
                    </h3>
                    <span className="text-xs text-slate-500 font-semibold">
                      {formatDate(note.updatedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 truncate mt-1">
                    {note.rawText || "No additional text"}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Editor Panel */}
      <main className="flex-1 flex flex-col bg-white">
        {/* Editor Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 md:hidden text-slate-600 hover:bg-slate-100 rounded-lg"
              title="Show sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {selectedNoteId && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveNote}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                  title="Save changes"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save</span>
                </button>
                {saveStatus && (
                  <span className="text-xs text-slate-500 font-bold animate-pulse">
                    {saveStatus}
                  </span>
                )}
              </div>
            )}
          </div>
          {selectedNoteId && (
            <button
              onClick={() => handleDeleteNote(selectedNoteId)}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              title="Delete Note"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Note Workspace */}
        {selectedNoteId ? (
          <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
            {/* Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note Title..."
              className="text-3xl font-black text-slate-900 border-none outline-none focus:ring-0 w-full placeholder-slate-300"
            />

            {/* Rich Editor Toolbar */}
            {editor && (
              <div className="flex flex-wrap items-center gap-1 bg-[#f4f3ef]/50 p-1.5 rounded-2xl border border-slate-200">
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-2 rounded-lg font-bold transition-all ${
                    editor.isActive("bold")
                      ? "bg-amber-500 text-white"
                      : "hover:bg-slate-200/60 text-slate-700"
                  }`}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-2 rounded-lg transition-all ${
                    editor.isActive("italic")
                      ? "bg-amber-500 text-white"
                      : "hover:bg-slate-200/60 text-slate-700"
                  }`}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`p-2 rounded-lg transition-all ${
                    editor.isActive("bulletList")
                      ? "bg-amber-500 text-white"
                      : "hover:bg-slate-200/60 text-slate-700"
                  }`}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() =>
                    editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()
                  }
                  className={`p-2 rounded-lg transition-all ${
                    editor.isActive("highlight")
                      ? "bg-amber-500 text-white"
                      : "hover:bg-slate-200/60 text-slate-700"
                  }`}
                  title="Highlight"
                >
                  <Highlighter className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Content Field */}
            {editor && (
              <div className="flex-1 min-h-[300px] text-lg prose max-w-none focus:outline-none placeholder-slate-400 select-text">
                <EditorContent editor={editor} className="outline-none" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6">
            <FileText className="h-16 w-16 mb-4 text-slate-350" />
            <h3 className="text-xl font-bold text-slate-700">No Note Selected</h3>
            <p className="text-sm mt-1">Select a note from the sidebar or write a new one.</p>
          </div>
        )}
      </main>
    </div>
  );
}
