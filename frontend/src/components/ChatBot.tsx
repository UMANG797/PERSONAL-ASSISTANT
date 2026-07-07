"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Send, Volume2, Square, Bot, User } from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  isStreaming?: boolean;
}

export default function ChatBot() {
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
      // Mock call to /api/ai/chat
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSend }),
      });

      // Simple simulated stream text logic
      let botResponse = "I checked your family vault database. Your Aadhaar number is 5432-8876-0912 found in your identity upload document.";
      if (textToSend.toLowerCase().includes("passport")) {
        botResponse = "Your passport expires on November 15, 2029, as shown in the passport document you uploaded last month.";
      }

      setIsBotTyping(false);
      let currentText = "";
      const botMsgId = (Date.now() + 1).toString();
      
      setMessages((prev) => [...prev, { id: botMsgId, sender: "bot", text: "", isStreaming: true }]);

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
      }, 20);

    } catch (error) {
      setIsBotTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), sender: "bot", text: "Sorry, I couldn't reach the database server. Please check your connection." },
      ]);
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
              <div className="space-y-1">
                <span className="block text-xs font-bold uppercase tracking-wider opacity-70">
                  {msg.sender === "user" ? "You" : "Assistant"}
                </span>
                <p className="text-xl leading-relaxed font-semibold">{msg.text}</p>
                {msg.isStreaming && <span className="inline-block animate-pulse text-xl">⏳</span>}
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
