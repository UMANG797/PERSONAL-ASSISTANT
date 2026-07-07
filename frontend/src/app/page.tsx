"use client";

import React, { useState, useEffect } from "react";
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
  ChevronRight 
} from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0/client";

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
}

export default function Dashboard() {
  const { user, error, isLoading } = useUser();
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // File Manager States
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  // Folder Creation/Editing States
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");

  // File Editing States
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState("");

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
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
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const tokenRes = await fetch("/api/auth/token");
      let token = "";
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData.accessToken || "";
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/documents/folders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name: newFolderName })
      });

      if (res.ok) {
        setNewFolderName("");
        setIsCreatingFolder(false);
        fetchData();
      }
    } catch (err) {
      console.error("Error creating folder:", err);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Are you sure you want to delete this folder? Any files inside will be moved to the Root folder.")) return;

    try {
      const tokenRes = await fetch("/api/auth/token");
      let token = "";
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData.accessToken || "";
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/documents/folders/${folderId}`, {
        method: "DELETE",
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });

      if (res.ok) {
        if (selectedFolderId === folderId) {
          setSelectedFolderId(null);
        }
        fetchData();
      }
    } catch (err) {
      console.error("Error deleting folder:", err);
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editingFolderName.trim()) return;

    try {
      const tokenRes = await fetch("/api/auth/token");
      let token = "";
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData.accessToken || "";
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/documents/folders/${folderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name: editingFolderName })
      });

      if (res.ok) {
        setEditingFolderId(null);
        setEditingFolderName("");
        fetchData();
      }
    } catch (err) {
      console.error("Error renaming folder:", err);
    }
  };

  const handleRenameFile = async (fileId: string) => {
    if (!editingFileName.trim()) return;

    try {
      const tokenRes = await fetch("/api/auth/token");
      let token = "";
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData.accessToken || "";
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/documents/${fileId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ originalName: editingFileName })
      });

      if (res.ok) {
        setEditingFileId(null);
        setEditingFileName("");
        fetchData();
      }
    } catch (err) {
      console.error("Error renaming file:", err);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file permanently?")) return;

    try {
      const tokenRes = await fetch("/api/auth/token");
      let token = "";
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData.accessToken || "";
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiUrl}/documents/${fileId}`, {
        method: "DELETE",
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Error deleting file:", err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const uploadAndProcess = async (file: File) => {
    setUploadStatus(`Requesting upload slot for "${file.name}"...`);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

      let token = "";
      try {
        const tokenRes = await fetch("/api/auth/token");
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          token = tokenData.accessToken || "";
        }
      } catch (err) {
        console.warn("Could not retrieve Auth0 token, trying request without token...", err);
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // 1. Request S3 Pre-signed URL from API
      const urlRes = await fetch(`${apiUrl}/documents/upload-url?fileName=${encodeURIComponent(file.name)}`, {
        headers
      });

      if (!urlRes.ok) {
        const errText = await urlRes.text();
        throw new Error(`Failed to get S3 slot: ${errText || urlRes.statusText}`);
      }

      const { uploadUrl, s3Key } = await urlRes.json();

      // 2. Direct Binary PUT to S3 Bucket
      setUploadStatus(`Uploading "${file.name}" to secure storage...`);
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`S3 secure upload failed: ${uploadRes.statusText}`);
      }

      // 3. Process with OCR Textract + Bedrock Claude + Embeddings
      setUploadStatus(`Analyzing and securing "${file.name}"...`);
      const processRes = await fetch(`${apiUrl}/documents/process`, {
        method: "POST",
        headers,
        body: JSON.stringify({ s3Key, originalName: file.name, folderId: selectedFolderId }),
      });

      if (!processRes.ok) {
        const errText = await processRes.text();
        throw new Error(`AI processing failed: ${errText || processRes.statusText}`);
      }

      const processResult = await processRes.json();
      setUploadStatus(`Success! "${file.name}" classified as "${processResult.document.category}" and securely saved.`);
      fetchData();

    } catch (err: any) {
      setUploadStatus(`Error uploading document: ${err.message}`);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadAndProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadAndProcess(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Identity": return "bg-blue-100 text-blue-800 border-blue-200";
      case "Finance": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Medical": return "bg-rose-100 text-rose-800 border-rose-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  // Filter documents belonging to the currently selected folder
  const currentDocuments = documents.filter(doc => doc.folderId === selectedFolderId);

  // Get active folder name
  const currentFolderName = selectedFolderId 
    ? folders.find(f => f._id === selectedFolderId)?.name || "Folder"
    : "Root";

  // Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xl font-semibold text-slate-600">Verifying session...</p>
      </div>
    );
  }

  // Not Logged In - Show Landing/Login/Signup Page
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl border-4 border-blue-900 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full filter blur-xl -mr-10 -mt-10 opacity-70"></div>
          
          <div className="text-center relative">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-blue-50 border-4 border-blue-900 text-blue-900">
              <Shield className="h-10 w-10 animate-pulse" />
            </div>
            <h2 className="mt-6 text-4xl font-extrabold text-slate-900 tracking-tight">
              Family Vault
            </h2>
            <p className="mt-3 text-lg text-slate-600">
              Your secure family locker for documents, notes, and AI assistance.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <a
              href="/api/auth/login"
              className="group relative w-full flex justify-center py-4 px-6 border-4 border-blue-900 text-xl font-bold rounded-2xl text-white bg-blue-900 hover:bg-blue-800 transition-all duration-150 shadow-md hover:scale-[1.02]"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <KeyRound className="h-5 w-5 text-blue-200 group-hover:text-white" aria-hidden="true" />
              </span>
              Sign In
            </a>

            <a
              href="/api/auth/signup"
              className="group relative w-full flex justify-center py-4 px-6 border-4 border-slate-300 hover:border-blue-900 text-xl font-bold rounded-2xl text-slate-700 hover:text-blue-900 bg-white hover:bg-slate-50 transition-all duration-150 shadow-sm hover:scale-[1.02]"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <UserPlus className="h-5 w-5 text-slate-400 group-hover:text-blue-900" aria-hidden="true" />
              </span>
              Create an Account
            </a>
          </div>

          <div className="pt-4 border-t-2 border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Protected by enterprise-grade end-to-end security.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Logged In - Dashboard / File Manager
  return (
    <div className="space-y-8 py-6">
      {/* Welcome Banner */}
      <section className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-3xl p-8 shadow-xl">
        <h1 className="text-3xl sm:text-4xl font-black mb-2">Hello {user.name || "Family Member"}, Welcome back!</h1>
        <p className="text-lg sm:text-xl text-blue-100 font-medium">
          Access and organize your critical secure records and family notes.
        </p>
      </section>

      {/* RAG Chat & Notebook Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <a
          href="/chat"
          className="flex items-center space-x-6 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-500 rounded-2xl p-6 shadow-sm transition-all duration-200 transform hover:scale-[1.01]"
        >
          <div className="p-3 bg-emerald-600 rounded-full text-white">
            <Mic className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Talk to AI Assistant</h2>
            <p className="text-sm text-slate-600 font-medium">Ask questions to your vault via voice or text.</p>
          </div>
        </a>

        <a
          href="/notes"
          className="flex items-center space-x-6 bg-amber-50 hover:bg-amber-100 border-2 border-amber-500 rounded-2xl p-6 shadow-sm transition-all duration-200 transform hover:scale-[1.01]"
        >
          <div className="p-3 bg-amber-500 rounded-full text-white">
            <BookOpen className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Family Notebook</h2>
            <p className="text-sm text-slate-600 font-medium">Read notes and record important information.</p>
          </div>
        </a>
      </div>

      {/* Main Professional File Explorer Section */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
        
        {/* Left Sidebar - Folders */}
        <div className="lg:col-span-4 border-r-2 border-slate-200 bg-slate-50 p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Folder className="h-5 w-5 text-blue-900" />
                Folders
              </h3>
              {!isCreatingFolder && (
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="p-2 text-blue-900 hover:bg-blue-100 rounded-xl transition-all duration-150 flex items-center justify-center border-2 border-blue-900"
                  title="Create Folder"
                >
                  <FolderPlus className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Folder Creation Input */}
            {isCreatingFolder && (
              <form onSubmit={handleCreateFolder} className="flex gap-2 bg-white p-2 rounded-xl border-2 border-blue-900">
                <input
                  type="text"
                  placeholder="Folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border-none outline-none focus:ring-0"
                  autoFocus
                />
                <button type="submit" className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                  <Check className="h-4 w-4" />
                </button>
                <button 
                  type="button" 
                  onClick={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
                  className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            )}

            {/* Folders List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {/* Root Folder */}
              <button
                onClick={() => setSelectedFolderId(null)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-left transition-all duration-150 ${
                  selectedFolderId === null 
                    ? "bg-blue-900 text-white shadow-md" 
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  Root / All Files
                </span>
                <span className="text-xs bg-slate-300 text-slate-800 px-2.5 py-0.5 rounded-full font-bold">
                  {documents.filter(d => d.folderId === null).length}
                </span>
              </button>

              {/* User Folders */}
              {folders.map(folder => (
                <div 
                  key={folder._id}
                  className={`group w-full flex items-center justify-between px-2 rounded-xl transition-all duration-150 ${
                    selectedFolderId === folder._id 
                      ? "bg-blue-100 border-2 border-blue-900 text-blue-900" 
                      : "hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  {editingFolderId === folder._id ? (
                    <div className="flex-1 flex gap-1 p-1">
                      <input
                        type="text"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-900 bg-white"
                        autoFocus
                      />
                      <button onClick={() => handleRenameFolder(folder._id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setEditingFolderId(null); setEditingFolderName(""); }} className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setSelectedFolderId(folder._id)}
                        className="flex-1 flex items-center gap-2 py-3 px-2 font-semibold text-left"
                      >
                        <Folder className="h-5 w-5 text-blue-700" />
                        <span className="truncate max-w-[150px]">{folder.name}</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold group-hover:inline">
                          {documents.filter(d => d.folderId === folder._id).length}
                        </span>
                        <button
                          onClick={() => { setEditingFolderId(folder._id); setEditingFolderName(folder.name); }}
                          className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(folder._id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Main Panel - Files & Upload */}
        <div className="lg:col-span-8 p-6 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Header / Breadcrumb */}
            <div className="border-b pb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-slate-500 text-sm font-semibold mb-1">
                  <span>Root</span>
                  <ChevronRight className="h-4 w-4" />
                  <span className="text-slate-900">{currentFolderName}</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Folder className="h-6 w-6 text-blue-900" />
                  {currentFolderName} Files
                </h3>
              </div>
            </div>

            {/* Upload Area inside current folder */}
            <section className="border-2 border-dashed border-slate-300 hover:border-blue-900 bg-slate-50 hover:bg-blue-50/30 rounded-2xl p-6 transition-all duration-150">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={onButtonClick}
                className="flex flex-col items-center justify-center text-center space-y-4 cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.png,.txt"
                />
                <div className="p-3 bg-white text-blue-900 rounded-full border-2 border-blue-900 shadow-sm">
                  <Upload className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-blue-950">Upload here to "{currentFolderName}"</h4>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                    Drag a file here or click to choose from your device.
                  </p>
                </div>
                {uploadStatus && (
                  <div className="flex items-center space-x-2 bg-blue-50 text-blue-950 border border-blue-300 p-3 rounded-xl text-sm font-bold">
                    <AlertCircle className="h-4 w-4 text-blue-900" />
                    <span>{uploadStatus}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Files List Table */}
            <div className="space-y-4">
              <h4 className="text-lg font-bold text-slate-800">Files ({currentDocuments.length})</h4>
              
              {currentDocuments.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <FileText className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 font-semibold">No files uploaded in this folder yet.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Uploaded At</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {currentDocuments.map((doc) => (
                        <tr key={doc._id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingFileId === doc._id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingFileName}
                                  onChange={(e) => setEditingFileName(e.target.value)}
                                  className="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-900 bg-white"
                                  autoFocus
                                />
                                <button onClick={() => handleRenameFile(doc._id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => { setEditingFileId(null); setEditingFileName(""); }} className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-3">
                                <FileText className="h-5 w-5 text-blue-900" />
                                <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={doc.originalName}>
                                  {doc.originalName}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs font-bold rounded-full border ${getCategoryColor(doc.category)}`}>
                              {doc.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                            {new Date(doc.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => { setEditingFileId(doc._id); setEditingFileName(doc.originalName); }}
                                className="p-2 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-xl transition-colors"
                                title="Rename File"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteFile(doc._id)}
                                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-xl transition-colors"
                                title="Delete File"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
