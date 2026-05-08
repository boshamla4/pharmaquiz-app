import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharmaQuiz",
  description: "Offline-first pharma quiz app backed by static parsed JSON",
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
          PharmaQuiz © 2026
        </footer>
      </body>
    </html>
  );
}
