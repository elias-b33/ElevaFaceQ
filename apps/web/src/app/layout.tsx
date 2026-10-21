import type { Metadata, Viewport } from "next";
import { AppFrame } from "@/components/AppFrame";
import "./globals.css";
import "./atlas.css";
import "./campaign.css";

export const metadata: Metadata = {
  title: { default: "FaceIQ — The Private Atlas", template: "%s | Local FaceIQ" },
  description: "Facial proportions, editable landmarks and progress tracking. Runs on your computer, with no account, subscription or photo uploads.",
  referrer: "no-referrer",
};
export const viewport: Viewport = { themeColor: "#eeeae2" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased"><body className="min-h-full"><AppFrame>{children}</AppFrame></body></html>;
}
