import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

/**
 * 根 layout：Next.js 要求存在且包含 <html>/<body>，否则易出现 405。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-[var(--background)] text-[var(--foreground)] font-sans">
        {children}
      </body>
    </html>
  );
}
