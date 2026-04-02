import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioPoint — Peptide & Supplement Manager",
  description: "Manage your peptides and supplements in one place. Track doses, cycles, protocols, progress, and performance.",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&f[]=general-sans@400,500,600&display=swap" rel="stylesheet" />
      </head>
      <body className="h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
