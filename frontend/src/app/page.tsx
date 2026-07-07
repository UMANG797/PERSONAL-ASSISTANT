"use client";

import React, { useState } from "react";
import { Upload, FileText, Mic, BookOpen, AlertCircle, Shield, KeyRound, UserPlus } from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0/client";

export default function Dashboard() {
  const { user, error, isLoading } = useUser();
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

      // A. Retrieve Auth0 Access Token from our Next.js API route helper
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
        body: JSON.stringify({ s3Key, originalName: file.name }),
      });

      if (!processRes.ok) {
        const errText = await processRes.text();
        throw new Error(`AI processing failed: ${errText || processRes.statusText}`);
      }

      const processResult = await processRes.json();
      setUploadStatus(`Success! "${file.name}" classified as "${processResult.document.category}" and securely saved.`);

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
          {/* Decorative background shape */}
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

  // Logged In - Dashboard
  return (
    <div className="space-y-8 py-6">
      {/* Welcome Banner */}
      <section className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-3xl p-8 shadow-xl">
        <h1 className="text-4xl sm:text-5xl font-black mb-3">Hello {user.name || "Family Member"}, Welcome to Family Vault!</h1>
        <p className="text-xl sm:text-2xl text-blue-100 font-medium">
          This is your safe space for critical documents, records, and family notes.
        </p>
      </section>

      {/* Simplified Large Buttons Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <a
          href="/chat"
          className="flex items-center space-x-6 bg-emerald-100 hover:bg-emerald-200 border-4 border-emerald-600 rounded-2xl p-8 shadow-md transition-all duration-200 transform hover:scale-[1.02]"
        >
          <div className="p-4 bg-emerald-600 rounded-full text-white">
            <Mic className="h-12 w-12" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Talk to AI Assistant</h2>
            <p className="text-lg text-slate-600">Ask questions using voice or typing.</p>
          </div>
        </a>

        <a
          href="/notes"
          className="flex items-center space-x-6 bg-amber-100 hover:bg-amber-200 border-4 border-amber-500 rounded-2xl p-8 shadow-md transition-all duration-200 transform hover:scale-[1.02]"
        >
          <div className="p-4 bg-amber-50 rounded-full text-white">
            <BookOpen className="h-12 w-12" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Family Notebook</h2>
            <p className="text-lg text-slate-600">Write down key details or read notes.</p>
          </div>
        </a>
      </div>

      {/* One-Click Large File Drop Container */}
      <section className="bg-white border-4 border-dashed border-blue-400 hover:border-blue-700 rounded-3xl p-12 transition-all duration-200 shadow-md">
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className="flex flex-col items-center justify-center text-center space-y-6 min-h-[300px] cursor-pointer"
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.jpg,.png,.txt"
          />
          <div className="p-6 bg-blue-50 text-blue-900 rounded-full border-4 border-blue-900">
            <Upload className="h-16 w-16" />
          </div>
          <div>
            <h3 className="text-3xl font-extrabold text-blue-950 mb-2">Drop Your Documents Here</h3>
            <p className="text-xl text-slate-600 max-w-lg mx-auto">
              Drag any file here (such as ID cards, medical records, utility bills) or click the box to upload.
            </p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onButtonClick(); }}
            className="px-8 py-4 bg-blue-900 text-white text-xl font-bold rounded-2xl hover:bg-blue-800 transition-colors shadow-md"
          >
            Choose a File From Device
          </button>
          {uploadStatus && (
            <div className="flex items-center space-x-3 bg-blue-50 text-blue-950 border-2 border-blue-900 p-4 rounded-xl text-lg font-bold">
              <AlertCircle className="h-6 w-6" />
              <span>{uploadStatus}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
