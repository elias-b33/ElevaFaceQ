import type { Metadata, Viewport } from "next";
import { AppFrame } from "@/components/AppFrame";
import "./globals.css";
import "./atlas.css";
import "./campaign.css";
import "./interiors.css";
import "./rating.css";

export const metadata: Metadata = {
  title: { default: "ElevaFace — Elevate your face", template: "%s | ElevaFace" },
  applicationName: "ElevaFace",
  description: "Elevate your face. A private face rating out of 10 from a front photo and side profile: harmony, angularity, dimorphism and features, with every measurement explained. Runs in your browser, with no account or photo uploads.",
  referrer: "no-referrer",
};
export const viewport: Viewport = { themeColor: "#eeeae2" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased"><body className="min-h-full"><AppFrame>{children}</AppFrame></body></html>;
}
