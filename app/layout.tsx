import type { Metadata } from "next";
import ThemeToggle from "@/app/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharmaQuiz",
  description: "Pharma quiz app with Supabase-backed sessions, saved attempts, review history, and Vercel-ready deployment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-gray-200 bg-white px-4 py-3 text-center text-xs text-gray-500">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span>PharmaQuiz © 2026</span>
            <ThemeToggle />
          </div>
        </footer>
      </body>
    </html>
  );
}
