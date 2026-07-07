"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./components/AuthContext";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { 
  Upload, 
  FileText, 
  Mic, 
  BookOpen, 
  AlertCircle, 
  Shield, 
  KeyRound, 
  UserPlus, 
  FolderPlus, 
  Folder, 
  File, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  ChevronRight,
  MoreVertical,
  Plus,
  Bold,
  Italic,
  List,
  Highlighter,
  Save,
  Menu,
  ChevronLeft,
  Bot,
  LogOut,
  Send,
  Square,
  Search
} from "lucide-react";
import ChatBot from "../components/ChatBot";

interface FolderItem {
  _id: string;
  name: string;
}

interface DocumentItem {
  _id: string;
  originalName: string;
  s3Key: string;
  category: "Identity" | "Finance" | "Medical" | "Other";
  folderId: string | null;
  createdAt: string;
  scanned?: boolean;
}

interface Note {
  _id: string;
  title: string;
  content: any;
  rawText?: string;
  updatedAt: string;
}

export default function Dashboard() {
  const { user, token, logout, login: apiLogin, register: apiRegister, isLoading: authLoading } = useAuth();
  
  // Custom Login/Register Form States
  const [isRegistering, setIsRegistering] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  // App-level Navigation & Sidebar States
  const [activeTab, setActiveTab] = useState<"documents" | "notes">("documents");
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Documents & Folders States
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [shouldScan, setShouldScan] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Folder Dialog Box States
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderModalMode, setFolderModalMode] = useState<"create" | "rename">("create");
  const [folderModalTargetId, setFolderModalTargetId] = useState<string | null>(null);
  const [folderModalInput, setFolderModalInput] = useState("");

  // File Dialog Box States
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [fileModalTargetId, setFileModalTargetId] = useState<string | null>(null);
  const [fileModalInput, setFileModalInput] = useState("");

  // Active Dropdown menus
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Notes States
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [noteSaveStatus, setNoteSaveStatus] = useState("");
  const [isNotesSidebarOpen, setIsNotesSidebarOpen] = useState(true);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
    ],
    content: "<p>Start writing your family note here...</p>",
  });

  const activeNote = notes.find((n) => n._id === selectedNoteId);

  // General Data Fetching
  const fetchAllData = async () => {
    if (!token) return;
    try {
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`
      };

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

      // Fetch Folders
      const foldersRes = await fetch(`${apiUrl}/documents/folders`, { headers });
      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        setFolders(foldersData);
      }

      // Fetch Documents
      const docsRes = await fetch(`${apiUrl}/documents`, { headers });
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData);
      }

      // Fetch Notes
      const notesRes = await fetch(`${apiUrl}/notes`, { headers });
      if (notesRes.ok) {
        const notesData = await notesRes.json();
        setNotes(notesData);
      }
    } catch (err) {
      console.error("Error loading vault content:", err);
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchAllData();
    }
  }, [user, token]);

  // Load Note to Editor
  useEffect(() => {
    if (activeNote && editor) {
      setNoteTitle(activeNote.title);
      editor.commands.setContent(activeNote.content);
    } else if (!selectedNoteId && editor) {
      setNoteTitle("");
      editor.commands.setContent("<p>Start writing your family note here...</p>");
    }
  }, [selectedNoteId, editor]);

  // Submit Sign In / Sign Up Forms
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    if (!authUsername.trim() || !authPassword.trim()) {
      setAuthError("All fields are required.");
      return;
    }

    if (isRegistering) {
      const res = await apiRegister(authUsername, authPassword);
      if (res.success) {
        setAuthSuccess("Registration successful! You can now log in.");
        setIsRegistering(false);
        setAuthPassword("");
      } else {
        setAuthError(res.error || "Registration failed.");
      }
    } else {
      const res = await apiLogin(authUsername, authPassword);
      if (!res.success) {
        setAuthError(res.error || "Login failed.");
      }
    }
  };

  // Folder Operations
  const handleOpenFolderModal = (mode: "create" | "rename", targetId: string | null = null, currentName = "") => {
    setFolderModalMode(mode);
    setFolderModalTargetId(targetId);
    setFolderModalInput(currentName);
    setIsFolderModalOpen(true);
    setActiveMenuId(null);
  };

  const handleFolderModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderModalInput.trim() || !token) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

      if (folderModalMode === "create") {
        const res = await fetch(`${apiUrl}/documents/folders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ name: folderModalInput })
        });
        if (res.ok) fetchAllData();
      } else if (folderModalMode === "rename" && folderModalTargetId) {
        const res = await fetch(`${apiUrl}/documents/folders/${folderModalTargetId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ name: folderModalInput })
        });
        if (res.ok) fetchAllData();
      }
    } catch (err) {
      console.error("Folder action failed:", err);
    } finally {
      setIsFolderModalOpen(false);
      setFolderModalInput("");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Are you sure you want to delete this folder? Any files inside will be moved to the Root folder.") || !token) return;
    setActiveMenuId(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/documents/folders/${folderId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        if (selectedFolderId === folderId) {
          setSelectedFolderId(null);
        }
        fetchAllData();
      }
    } catch (err) {
      console.error("Error deleting folder:", err);
    }
  };

  // File Operations
  const handleOpenFileModal = (targetId: string, currentName: string) => {
    setFileModalTargetId(targetId);
    setFileModalInput(currentName);
    setIsFileModalOpen(true);
    setActiveMenuId(null);
  };

  const handleFileModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileModalInput.trim() || !fileModalTargetId || !token) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/documents/${fileModalTargetId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ originalName: fileModalInput })
      });

      if (res.ok) {
        fetchAllData();
      }
    } catch (err) {
      console.error("Rename file failed:", err);
    } finally {
      setIsFileModalOpen(false);
      setFileModalInput("");
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file permanently?") || !token) return;
    setActiveMenuId(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/documents/${fileId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        fetchAllData();
      }
    } catch (err) {
      console.error("Error deleting file:", err);
    }
  };

  const handleDownloadFile = async (fileId: string) => {
    if (!token) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const response = await fetch(`${apiUrl}/documents/download-url/${fileId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const { downloadUrl } = await response.json();
        window.open(downloadUrl, "_blank");
      }
    } catch (err) {
      console.error("Could not fetch download URL:", err);
    }
  };

  // Upload/Process Document File
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !token) return;
    const file = e.target.files[0];

    setUploadStatus(`Requesting upload slot for "${file.name}"...`);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const headers = { "Authorization": `Bearer ${token}` };

      const urlRes = await fetch(`${apiUrl}/documents/upload-url?fileName=${encodeURIComponent(file.name)}`, {
        headers
      });

      if (!urlRes.ok) throw new Error("Upload slot request failed");
      const { uploadUrl, s3Key } = await urlRes.json();

      setUploadStatus(`Uploading "${file.name}"...`);
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Direct S3 upload failed");

      setUploadStatus(`Analyzing document...`);
      const processRes = await fetch(`${apiUrl}/documents/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ s3Key, originalName: file.name, folderId: selectedFolderId, scan: shouldScan }),
      });

      if (processRes.ok) {
        setUploadStatus(null);
        fetchAllData();
      } else {
        throw new Error("OCR Processing failed");
      }
    } catch (err: any) {
      setUploadStatus(`Upload failed: ${err.message}`);
    }
  };

  // Notes Operations
  const handleCreateNote = async () => {
    if (!token) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
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
        await fetchAllData();
        setSelectedNoteId(data.note._id);
        setIsNotesSidebarOpen(false);
      }
    } catch (err) {
      console.error("New note failed:", err);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedNoteId || !editor || !token) return;

    setNoteSaveStatus("Saving...");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          id: selectedNoteId,
          title: noteTitle.trim() || "Untitled Note",
          content: editor.getJSON()
        })
      });

      if (res.ok) {
        setNoteSaveStatus("Saved");
        setTimeout(() => setNoteSaveStatus(""), 2000);
        fetchAllData();
      } else {
        setNoteSaveStatus("Error saving");
      }
    } catch (err) {
      console.error("Save note failed:", err);
      setNoteSaveStatus("Error");
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?") || !token) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/notes/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        setSelectedNoteId(null);
        fetchAllData();
        setIsNotesSidebarOpen(true);
      }
    } catch (err) {
      console.error("Note deletion failed:", err);
    }
  };

  // Filtering Notes
  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
      (n.rawText && n.rawText.toLowerCase().includes(noteSearchQuery.toLowerCase()))
  );

  // Helper date formatter
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Get documents inside folder
  const folderDocuments = documents.filter(doc => doc.folderId === selectedFolderId);

  // Authentication & Session Loading State
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 space-y-4">
        <div className="w-16 h-16 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xl font-bold text-slate-600">Verifying session...</p>
      </div>
    );
  }

  // Auth: Landing Screen (Local Username and Password Forms)
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-gradient-to-tr from-slate-100 to-indigo-50/50">
        <div className="max-w-md w-full bg-white border-4 border-blue-900 rounded-3xl p-10 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full filter blur-xl -mr-10 -mt-10 opacity-70"></div>
          
          <div className="text-center relative">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-blue-50 border-4 border-blue-900 text-blue-900">
              <Shield className="h-10 w-10 animate-pulse" />
            </div>
            <h2 className="mt-4 text-3xl font-extrabold text-slate-900 tracking-tight">Family Vault</h2>
            <p className="mt-2 text-sm text-slate-600">
              {isRegistering 
                ? "Register a new local account for your family vault." 
                : "Sign in with your username and password."}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4 relative">
            {authError && (
              <div className="p-3 bg-red-50 border border-red-250 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            {authSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" />
                <span>{authSuccess}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
              <input
                type="text"
                placeholder="E.g., dad, grandma..."
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-200 focus:border-blue-900 rounded-xl text-base outline-none font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-200 focus:border-blue-900 rounded-xl text-base outline-none font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white font-bold text-lg rounded-xl transition-all shadow-md mt-4 hover:scale-[1.01]"
            >
              {isRegistering ? "Register Account" : "Sign In"}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError("");
                setAuthSuccess("");
                setAuthUsername("");
                setAuthPassword("");
              }}
              className="text-sm font-bold text-blue-900 hover:underline"
            >
              {isRegistering 
                ? "Already have an account? Sign In" 
                : "Don't have an account? Create one"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative select-none">
      
      {/* 1. Header (Navbar) */}
      <header className="bg-white border-b-4 border-blue-900 shadow-md sticky top-0 z-40 h-[76px] flex items-center">
        <div className="w-full px-6 flex items-center justify-between">
          {/* Logo on Left */}
          <div className="flex items-center space-x-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-900 tracking-tight cursor-pointer" onClick={() => { setSelectedFolderId(null); setActiveTab("documents"); setIsAiOpen(false); }}>
              🔒 Family Vault
            </span>
          </div>

          {/* Desktop Navigation & Auth on Right */}
          <nav className="hidden md:flex items-center space-x-6">
            <button 
              onClick={() => { setActiveTab("documents"); setSelectedNoteId(null); setIsAiOpen(false); }}
              className={`text-lg font-bold px-4 py-2 rounded-xl transition-all duration-150 ${
                activeTab === "documents" && !isAiOpen ? "bg-blue-900 text-white shadow-md" : "text-slate-600 hover:text-blue-900 hover:bg-slate-100"
              }`}
            >
              Documents
            </button>
            <button 
              onClick={() => { setActiveTab("notes"); setSelectedFolderId(null); setIsAiOpen(false); }}
              className={`text-lg font-bold px-4 py-2 rounded-xl transition-all duration-150 ${
                activeTab === "notes" && !isAiOpen ? "bg-blue-900 text-white shadow-md" : "text-slate-600 hover:text-blue-900 hover:bg-slate-100"
              }`}
            >
              Notes
            </button>
            
            <div className="flex items-center space-x-4 border-l pl-6 border-slate-200">
              <span className="text-sm font-bold text-blue-900 max-w-[150px] truncate capitalize">
                👋 {user.username}
              </span>
              <button
                onClick={logout}
                className="flex items-center space-x-2 text-sm font-bold text-red-600 hover:text-red-800 border-2 border-red-200 hover:border-red-600 px-3.5 py-1.5 rounded-xl transition-all duration-150"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="absolute top-[76px] left-0 right-0 md:hidden border-t border-slate-150 bg-white p-4 space-y-3 flex flex-col shadow-lg z-50">
            <button 
              onClick={() => { setActiveTab("documents"); setIsMobileMenuOpen(false); setSelectedNoteId(null); setIsAiOpen(false); }}
              className={`w-full text-left text-lg font-bold px-4 py-2.5 rounded-xl ${
                activeTab === "documents" && !isAiOpen ? "bg-blue-900 text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Documents
            </button>
            <button 
              onClick={() => { setActiveTab("notes"); setIsMobileMenuOpen(false); setSelectedFolderId(null); setIsAiOpen(false); }}
              className={`w-full text-left text-lg font-bold px-4 py-2.5 rounded-xl ${
                activeTab === "notes" && !isAiOpen ? "bg-blue-900 text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Notes
            </button>
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="text-sm font-bold text-blue-900 capitalize">👋 {user.username}</span>
              <button
                onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                className="flex items-center space-x-1.5 text-sm font-bold text-red-600 border border-red-200 px-3 py-1.5 rounded-xl"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. Main Tab View Workspaces (Full bleed covering all space below navbar) */}
      <main className="flex-1 flex flex-col w-full h-[calc(100vh-76px)] overflow-hidden relative">
        
        {/* TAB: Documents (Microsoft OneDrive style folder/file viewer) */}
        {!isAiOpen && activeTab === "documents" && (
          <div className="flex-1 flex flex-col bg-white border-t border-slate-200 p-6 overflow-hidden h-full">
            {/* Documents Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
              {/* Breadcrumb Navigation */}
              <div className="flex items-center space-x-2 text-slate-500 font-semibold text-sm sm:text-base">
                <button 
                  onClick={() => setSelectedFolderId(null)}
                  className="hover:text-blue-900 hover:underline"
                >
                  Root Folders
                </button>
                {selectedFolderId && (
                  <>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-900 max-w-[150px] truncate">
                      {folders.find(f => f._id === selectedFolderId)?.name || "Folder"}
                    </span>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {selectedFolderId && (
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 select-none">
                    <input
                      type="checkbox"
                      checked={shouldScan}
                      onChange={(e) => setShouldScan(e.target.checked)}
                      className="rounded text-blue-900 focus:ring-blue-900 cursor-pointer h-4 w-4"
                    />
                    <span>Scan PDF/Image with AI</span>
                  </label>
                )}

                <button
                  onClick={() => handleOpenFolderModal("create")}
                  className="flex items-center space-x-2 px-4 py-2 border-2 border-blue-900 text-blue-900 hover:bg-blue-50 font-bold rounded-xl text-sm transition-colors shadow-sm"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>New Folder</span>
                </button>

                {selectedFolderId && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-900 text-white hover:bg-blue-800 font-bold rounded-xl text-sm transition-colors shadow-sm"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload File</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleUploadFile}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                />
              </div>
            </div>

            {/* Folder Content Pane (Y-axis Scrollbar) */}
            <div className="flex-1 overflow-y-auto space-y-8 pr-2 mt-4">
              {uploadStatus && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-900 font-bold p-3 rounded-2xl text-sm">
                  <AlertCircle className="h-4 w-4 animate-spin" />
                  <span>{uploadStatus}</span>
                </div>
              )}

              {/* Root View: Show ONLY folders */}
              {!selectedFolderId && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-800">Folders</h3>
                  {folders.length === 0 ? (
                    <p className="text-slate-400 font-semibold text-sm italic">No folders created yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {folders.map(folder => (
                        <div 
                          key={folder._id}
                          className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-slate-350 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all shadow-sm relative group"
                        >
                          <div 
                            onClick={() => setSelectedFolderId(folder._id)}
                            className="flex-1 flex items-center gap-3 min-w-0"
                          >
                            <Folder className="h-10 w-10 text-amber-500 fill-amber-400 shrink-0" />
                            <span className="font-bold text-slate-800 truncate pr-4">{folder.name}</span>
                          </div>

                          {/* Folder Options Menu */}
                          <div className="relative shrink-0">
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === folder._id ? null : folder._id)}
                              className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {activeMenuId === folder._id && (
                              <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden font-bold text-sm">
                                <button
                                  onClick={() => handleOpenFolderModal("rename", folder._id, folder.name)}
                                  className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  Rename
                                </button>
                                <button
                                  onClick={() => handleDeleteFolder(folder._id)}
                                  className="w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Folder Detail View: Show Files inside clicked folder */}
              {selectedFolderId && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSelectedFolderId(null)}
                      className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg flex items-center"
                    >
                      <ChevronLeft className="h-5 w-5" />
                      <span className="text-xs font-bold">Back to Folders</span>
                    </button>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Files ({folderDocuments.length})
                  </h3>

                  {folderDocuments.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <FileText className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-500 font-semibold">This folder is empty. Upload a file above.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {folderDocuments.map((doc) => (
                        <div
                          key={doc._id}
                          className="bg-white hover:bg-slate-50/50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm relative"
                        >
                          <div 
                            onClick={() => handleDownloadFile(doc._id)}
                            className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer"
                          >
                            <FileText className="h-8 w-8 text-blue-900 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate pr-2" title={doc.originalName}>
                                {doc.originalName}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[10px] text-slate-500 font-extrabold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 inline-block">
                                  {doc.category}
                                </span>
                                {doc.scanned !== false ? (
                                  <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-250 inline-block">
                                    AI Scanned
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-extrabold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 inline-block">
                                    Unscanned
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* File Options Menu */}
                          <div className="relative shrink-0">
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === doc._id ? null : doc._id)}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {activeMenuId === doc._id && (
                              <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden font-bold text-sm">
                                <button
                                  onClick={() => handleOpenFileModal(doc._id, doc.originalName)}
                                  className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  Rename
                                </button>
                                <button
                                  onClick={() => handleDeleteFile(doc._id)}
                                  className="w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Notes Workspace (occupying full screen area below header) */}
        {!isAiOpen && activeTab === "notes" && (
          <div className="flex-1 flex bg-white border-t border-slate-200 overflow-hidden h-full relative">
            
            {/* Notes Sidebar - List */}
            <aside
              className={`w-full md:w-[320px] bg-[#f8f7f5] border-r border-slate-200 flex flex-col z-25 transition-all duration-300 absolute md:relative inset-y-0 left-0 ${
                isNotesSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
              }`}
            >
              {/* Sidebar Toolbar */}
              <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-[#ebeae6]/40">
                <h2 className="text-xl font-bold text-slate-800">Notebook</h2>
                <button
                  onClick={handleCreateNote}
                  className="p-2 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors"
                  title="New Note"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Search */}
              <div className="p-3 border-b border-slate-200 bg-[#ebeae6]/40">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search notes..."
                    value={noteSearchQuery}
                    onChange={(e) => setNoteSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* List rows */}
              <div className="flex-1 overflow-y-auto">
                {filteredNotes.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 font-semibold italic text-sm">No notes found.</p>
                ) : (
                  filteredNotes.map((note) => {
                    const isSelected = note._id === selectedNoteId;
                    return (
                      <div
                        key={note._id}
                        onClick={() => {
                          setSelectedNoteId(note._id);
                          setIsNotesSidebarOpen(false);
                        }}
                        className={`p-4 border-b border-slate-200 cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? "bg-amber-100/50 border-l-4 border-l-amber-500"
                            : "hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 truncate max-w-[140px]">
                              {note.title || "Untitled Note"}
                            </h3>
                            <span className="text-xs text-slate-500 font-semibold shrink-0 ml-2">
                              {formatDate(note.updatedAt)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-550 truncate mt-1">
                            {note.rawText || "No context text"}
                          </p>
                        </div>

                        {/* Inline Delete Button on Right side of the note row */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note._id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
                          title="Delete Note"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Note Editor Area */}
            <div className="flex-1 flex flex-col bg-white">
              {/* Note Header / Controls */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsNotesSidebarOpen(true)}
                    className="p-2 md:hidden text-slate-600 hover:bg-slate-200 rounded-lg"
                    title="Show Notebook list"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  {selectedNoteId && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveNote}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                        title="Save note"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Note</span>
                      </button>
                      {noteSaveStatus && (
                        <span className="text-xs text-slate-500 font-bold animate-pulse">
                          {noteSaveStatus}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {selectedNoteId && (
                  <button
                    onClick={() => handleDeleteNote(selectedNoteId)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                    title="Delete Note"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Note Workspace */}
              {selectedNoteId ? (
                <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note Title..."
                    className="text-3xl font-black text-slate-900 border-none outline-none focus:ring-0 w-full placeholder-slate-300"
                  />

                  {editor && (
                    <div className="flex flex-wrap items-center gap-1 bg-[#f4f3ef]/50 p-1.5 rounded-2xl border border-slate-200">
                      <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`p-2 rounded-lg font-bold transition-all ${
                          editor.isActive("bold")
                            ? "bg-amber-500 text-white"
                            : "hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        <Bold className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`p-2 rounded-lg transition-all ${
                          editor.isActive("italic")
                            ? "bg-amber-500 text-white"
                            : "hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        <Italic className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`p-2 rounded-lg transition-all ${
                          editor.isActive("bulletList")
                            ? "bg-amber-500 text-white"
                            : "hover:bg-slate-200 text-slate-700"
                        }`}
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
                            : "hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        <Highlighter className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {editor && (
                    <div className="flex-1 min-h-[300px] text-lg prose max-w-none focus:outline-none placeholder-slate-400 select-text">
                      <EditorContent editor={editor} className="outline-none" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6">
                  <BookOpen className="h-16 w-16 mb-4 text-slate-350" />
                  <h3 className="text-xl font-bold text-slate-700">No Note Open</h3>
                  <p className="text-sm mt-1">Select a note from the list, or click "+" above to create one.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* 4. Full-Screen AI Chatbot Overlay (occupies full screen space below navbar) */}
        {isAiOpen && (
          <div className="absolute inset-0 bg-white z-30 flex flex-col animate-fade-in select-text border-t border-slate-200">
            {/* Full Screen Header */}
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <Bot className="h-8 w-8 text-blue-900 animate-bounce" />
                <h2 className="text-2xl font-black text-slate-800">Voice & Text Assistant</h2>
              </div>
              <button
                onClick={() => setIsAiOpen(false)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:border-slate-800 text-slate-700 hover:text-slate-900 font-bold rounded-xl text-sm transition-colors"
              >
                <X className="h-5 w-5" />
                <span>Close Assistant</span>
              </button>
            </div>

            {/* Chat Interface Container (Occupying Full Space below Navbar) */}
            <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col overflow-hidden">
              <ChatBot />
            </div>
          </div>
        )}
      </main>

      {/* 3. Floating Robot Icon (Bottom Right corner) */}
      {!isAiOpen && (
        <button
          onClick={() => setIsAiOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-blue-900 border-4 border-white text-white rounded-full shadow-2xl hover:bg-blue-800 hover:scale-105 active:scale-95 transition-all z-30"
          title="Open AI Assistant"
        >
          <Bot className="h-9 w-9 animate-pulse" />
        </button>
      )}

      {/* 5. Custom Dialog Modals (Microsoft-style dialog inputs) */}
      {/* Folder Dialog Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleFolderModalSubmit}
            className="bg-white border-4 border-blue-900 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-6 animate-scale-up"
          >
            <h3 className="text-2xl font-extrabold text-slate-900">
              {folderModalMode === "create" ? "Create New Folder" : "Rename Folder"}
            </h3>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Folder Name</label>
              <input
                type="text"
                placeholder="E.g., Medical Records, Taxes..."
                value={folderModalInput}
                onChange={(e) => setFolderModalInput(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl text-lg font-medium focus:border-blue-900 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsFolderModalOpen(false); setFolderModalInput(""); }}
                className="px-5 py-2.5 border-2 border-slate-200 hover:border-slate-800 text-slate-700 hover:text-slate-900 font-bold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-sm transition-colors shadow-md"
              >
                {folderModalMode === "create" ? "OK" : "Rename"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* File Dialog Modal */}
      {isFileModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleFileModalSubmit}
            className="bg-white border-4 border-blue-900 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-6 animate-scale-up"
          >
            <h3 className="text-2xl font-extrabold text-slate-900">Rename File</h3>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">File Name</label>
              <input
                type="text"
                value={fileModalInput}
                onChange={(e) => setFileModalInput(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl text-lg font-medium focus:border-blue-900 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsFileModalOpen(false); setFileModalInput(""); }}
                className="px-5 py-2.5 border-2 border-slate-200 hover:border-slate-800 text-slate-700 hover:text-slate-900 font-bold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-sm transition-colors shadow-md"
              >
                OK
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
