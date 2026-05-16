import type { Metadata } from "next";
import ThemeToggle from "@/app/components/ThemeToggle";
import SessionGuard from "@/app/components/SessionGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharmaQuiz",
  description: "Pharmaceutical sciences quiz platform with saved attempts, review history, and performance analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <SessionGuard>
          <div className="flex flex-1 flex-col">{children}</div>
        </SessionGuard>
        <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-center text-xs text-gray-400 dark:text-gray-500">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span>PharmaQuiz by Aladin B. © 2026</span>
            <ThemeToggle />
          </div>
        </footer>
      </body>
    </html>
  );
}
