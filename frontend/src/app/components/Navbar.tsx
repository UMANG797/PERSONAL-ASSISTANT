"use client";

import React from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { LogOut, LogIn } from "lucide-react";

export default function Navbar() {
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b-4 border-blue-900 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <a href="/" className="text-3xl font-bold tracking-tight text-blue-900 hover:opacity-90 transition-opacity">
            🔒 Family Vault
          </a>
        </div>
        <nav className="flex items-center space-x-6">
          <a href="/" className="text-xl font-bold text-slate-700 hover:text-blue-900 hover:underline px-3 py-2 rounded-md">
            Home
          </a>
          <a href="/notes" className="text-xl font-bold text-slate-700 hover:text-blue-900 hover:underline px-3 py-2 rounded-md">
            Notes
          </a>
          <a href="/chat" className="text-xl font-bold text-slate-700 hover:text-blue-900 hover:underline px-3 py-2 rounded-md">
            Voice Assistant
          </a>
          {user ? (
            <div className="flex items-center space-x-4 border-l pl-6 border-slate-200">
              <span className="text-sm font-semibold text-slate-600 hidden sm:inline">
                {user.name}
              </span>
              <a
                href="/api/auth/logout"
                className="flex items-center space-x-2 text-sm font-bold text-red-600 hover:text-red-800 border-2 border-red-200 hover:border-red-600 px-3 py-1.5 rounded-xl transition-all duration-150"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </a>
            </div>
          ) : (
            <div className="flex items-center space-x-3 border-l pl-6 border-slate-200">
              <a
                href="/api/auth/login"
                className="flex items-center space-x-2 text-sm font-bold text-blue-900 hover:text-blue-800 border-2 border-blue-900 px-3 py-1.5 rounded-xl transition-all duration-150"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </a>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
