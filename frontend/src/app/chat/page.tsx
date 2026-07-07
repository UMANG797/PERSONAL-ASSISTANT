"use client";

import React from "react";
import ChatBot from "../../components/ChatBot";

export default function ChatPage() {
  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-4xl font-extrabold text-slate-800">Voice & Text Assistant</h1>
        <p className="text-lg text-slate-600">Ask questions about your ID cards, documents, bills, or family notes.</p>
      </div>

      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-md">
        <ChatBot />
      </div>
    </div>
  );
}
