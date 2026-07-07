import React from "react";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import Navbar from "./components/Navbar";
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
      <UserProvider>
        <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-100">
          <Navbar />
          <main className="flex-1 max-w-6xl w-full mx-auto p-6">
            {children}
          </main>
        </body>
      </UserProvider>
    </html>
  );
}
