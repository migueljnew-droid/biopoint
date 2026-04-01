import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioPoint — Health Intelligence Dashboard",
  description: "Track your BioPoint Score, analyze bloodwork with AI, build peptide stacks, and optimize your biology.",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body className="h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
