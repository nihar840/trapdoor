import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trapdoor — Prompt Injection Defense",
  description:
    "Sanitize prompts, images, URLs and documents against prompt injection attacks before they reach your LLM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
