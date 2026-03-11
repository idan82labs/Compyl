import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compyl",
  description: "The task compiler for the age of AI agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
