import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DalalStreet AI | Indian Trading Workstation",
  description: "AI-powered NSE/BSE trading workstation — Joy Ghosh",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
