"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LabIcon({ kind, className = "" }: { kind: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    scan: <><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/><ellipse cx="12" cy="11.5" rx="4" ry="6"/><path d="M10 14h4M9 10h.01M15 10h.01"/></>,
    progress: <><path d="M4 4v16h16M7 15l4-4 4 2 5-7"/><path d="M16 6h4v4"/></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="9" cy="18" r="2" fill="currentColor"/></>,
    guide: <><path d="M12 21s-3-3-9-2V4c6-1 9 2 9 2s3-3 9-2v15c-6-1-9 2-9 2ZM12 6v15"/></>,
    shield: <><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[kind] ?? paths.scan}</svg>;
}

const NAV = [
  { href: "/", label: "The studio", number: "01" },
  { href: "/progress", label: "My dossiers", number: "02" },
  { href: "/measurements", label: "The face atlas", number: "03" },
  { href: "/guide", label: "Photo notes", number: "04" },
];
export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <div className="atlas-frame">
    <a href="#workspace" className="skip-link">Skip to workspace</a>
    <div className="atlas-utility"><span>AN INDEPENDENT STUDY OF THE FACE</span><span className="local-badge"><i/> PRIVATE & LOCAL <b> / </b> EST. 2026</span></div>
    <header className="atlas-masthead"><Link href="/" className="atlas-brand" aria-label="FaceIQ home">faceiq<span>.</span><small>THE PRIVATE ATLAS</small></Link><nav className="atlas-nav" aria-label="Main navigation">{NAV.map(item => {
      const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}><sup>{item.number}</sup>{item.label}</Link>;
    })}</nav><Link href="/scan" className="masthead-action">New study <span>↗</span></Link><Link href="/settings" className="atlas-settings" aria-label="Settings & backups"><LabIcon kind="settings"/></Link></header>
    <div id="workspace" className="atlas-workspace">{children}</div>
    <footer className="atlas-footer"><Link href="/" className="footer-monogram">f.</Link><p>A study in individuality.<span>On your device. On your terms.</span></p><div><Link href="/about">About the atlas ↗</Link><span>FreeHarmony · AGPL-3.0 / LOCAL EDITION 03</span></div></footer>
  </div>;
}
