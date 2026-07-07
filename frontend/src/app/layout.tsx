import React from "react";
import { AuthProvider } from "./components/AuthContext";
import "./globals.css";

export const metadata = {
  title: "Family Vault - Secure Digital Lockbox",
  description: "A secure digital document locker and voice assistant for you and your family.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-100">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
