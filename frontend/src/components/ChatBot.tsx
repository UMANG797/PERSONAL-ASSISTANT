"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Send, Volume2, Square, Bot, User, FileText, Download } from "lucide-react";
import { useAuth } from "../app/components/AuthContext";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  isStreaming?: boolean;
  sources?: {
    id: string;
    originalName: string;
    category: string;
  }[];
}

export default function ChatBot() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "bot",
      text: "Hello! I am your Family Vault assistant. Ask me anything, like: 'What is my Aadhaar card number?' or 'When does my passport expire?'",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isBotTyping]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsgId = Date.now().toString();
    const newMsg: Message = {
      id: userMsgId,
      sender: "user",
      text: textToSend,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText("");
    setIsBotTyping(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiUrl}/ai/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: textToSend }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || response.statusText);
      }

      const data = await response.json();
      let botResponse = data.answer || "I checked the database but couldn't find a clear answer.";

      setIsBotTyping(false);
      let currentText = "";
      const botMsgId = (Date.now() + 1).toString();
      
      setMessages((prev) => [
        ...prev,
        { 
          id: botMsgId, 
          sender: "bot", 
          text: "", 
          isStreaming: true,
          sources: data.sources || []
        }
      ]);

      let index = 0;
      const interval = setInterval(() => {
        if (index < botResponse.length) {
          currentText += botResponse[index];
          setMessages((prev) =>
            prev.map((m) => (m.id === botMsgId ? { ...m, text: currentText } : m))
          );
          index++;
        } else {
          clearInterval(interval);
          setMessages((prev) =>
            prev.map((m) => (m.id === botMsgId ? { ...m, isStreaming: false } : m))
          );
        }
      }, 10); // Sped up stream animation slightly for better UX

    } catch (error: any) {
      setIsBotTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), sender: "bot", text: `Sorry, I couldn't get an answer: ${error.message || error}` },
      ]);
    }
  };

  const handleDownloadFile = async (fileId: string, originalName?: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiUrl}/documents/download-url/${fileId}`, {
        headers
      });

      if (!response.ok) {
        throw new Error("Failed to retrieve file download URL.");
      }

      const { downloadUrl } = await response.json();
      
      // Fetch the file content as a blob to force a download prompt in the browser
      const fileResponse = await fetch(downloadUrl);
      if (!fileResponse.ok) throw new Error("Failed to fetch file content.");
      
      const blob = await fileResponse.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", originalName || "downloaded-file");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(`Could not download file: ${err.message}`);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      // Simulate speech to text transcription completion
      setInputText("What is my Aadhaar card number?");
    } else {
      setIsRecording(true);
      setInputText("Listening to your voice...");
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-slate-50 rounded-2xl overflow-hidden border-4 border-slate-300">
      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`flex items-start space-x-3 max-w-[85%] sm:max-w-[70%] p-5 rounded-2xl border-2 shadow-sm ${
                msg.sender === "user"
                  ? "bg-blue-900 border-blue-950 text-white rounded-br-none"
                  : "bg-white border-slate-200 text-slate-900 rounded-bl-none"
              }`}
            >
              <div className="mt-1">
                {msg.sender === "user" ? (
                  <User className="h-6 w-6 text-blue-200" />
                ) : (
                  <Bot className="h-6 w-6 text-blue-900" />
                )}
              </div>
              <div className="space-y-1 w-full">
                <span className="block text-xs font-bold uppercase tracking-wider opacity-70">
                  {msg.sender === "user" ? "You" : "Assistant"}
                </span>
                <p className="text-xl leading-relaxed font-semibold">{msg.text}</p>
                {msg.isStreaming && <span className="inline-block animate-pulse text-xl">⏳</span>}
                
                {/* Clickable Premium Source Cards/Reference Files for Downloading/Previewing */}
                {msg.sources && msg.sources.length > 0 && !msg.isStreaming && (
                  <div className="mt-4 pt-3 border-t border-slate-200/50 space-y-3">
                    {msg.text.toLowerCase().includes("requested document") || msg.text.toLowerCase().includes("here is") ? (
                      <div>
                        <span className="block text-xs font-extrabold uppercase tracking-wider opacity-60 text-slate-500 mb-2">Requested Document:</span>
                        <div className="grid grid-cols-1 gap-3 sm:min-w-[280px]">
                          {msg.sources.map((src) => (
                            <div
                              key={src.id}
                              className="flex items-center justify-between p-3.5 bg-gradient-to-r from-blue-50 to-slate-50 border-2 border-blue-100 rounded-xl hover:border-blue-300 transition-all shadow-sm group"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-900 group-hover:bg-blue-200 transition-colors">
                                  <FileText className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-blue-900 transition-colors">
                                    {src.originalName}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-500 uppercase">
                                    {src.category || "Document"}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDownloadFile(src.id, src.originalName)}
                                className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors shadow flex items-center space-x-1 whitespace-nowrap"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span>Download</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <span className="block text-xs font-extrabold uppercase tracking-wider opacity-60 text-slate-500">Reference File:</span>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((src) => (
                            <span
                              key={src.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                            >
                              <FileText className="h-3.5 w-3.5 text-blue-900" />
                              <span>{src.originalName}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isBotTyping && (
          <div className="flex justify-start">
            <div className="bg-white border-2 border-slate-200 text-slate-500 max-w-[70%] p-4 rounded-2xl rounded-bl-none flex items-center space-x-2 font-bold text-lg">
              <Bot className="h-6 w-6 text-slate-400 animate-bounce" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Control Input Panel */}
      <div className="bg-white border-t-4 border-slate-200 p-4 flex flex-col sm:flex-row items-center gap-4">
        {/* Large Accessible Microphone Icon Button */}
        <button
          onClick={toggleRecording}
          className={`p-5 rounded-full border-4 shadow-md transition-colors ${
            isRecording
              ? "bg-red-600 border-red-950 text-white animate-pulse"
              : "bg-emerald-600 border-emerald-950 text-white hover:bg-emerald-500"
          }`}
          title={isRecording ? "Stop Listening" : "Talk using Microphone"}
        >
          {isRecording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
        </button>

        {/* Text Area Input */}
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage(inputText)}
            placeholder="Type your question here..."
            className="w-full px-5 py-4 border-2 border-slate-300 rounded-2xl text-xl font-medium focus:border-blue-900 focus:outline-none pr-14 shadow-inner"
            disabled={isRecording}
          />
          <button
            onClick={() => handleSendMessage(inputText)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-3 bg-blue-900 text-white rounded-xl hover:bg-blue-800 transition-colors"
            title="Send text message"
          >
            <Send className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
