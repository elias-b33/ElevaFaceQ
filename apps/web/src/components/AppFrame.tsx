"use client";

import { useEffect, useRef, useState } from "react";
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
  { href: "/measurements", label: "The face atlas", number: "02" },
  { href: "/progress", label: "Your ratings", number: "03" },
  { href: "/guide", label: "Photo notes", number: "04" },
];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const frame = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => { menu.current?.close(); setMenuOpen(false); };

  useEffect(() => {
    const root = frame.current;
    if (!root) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const update = () => {
      raf = 0;
      root.dataset.scrolled = String(window.scrollY > 35);
      const range = document.documentElement.scrollHeight - window.innerHeight;
      root.style.setProperty("--reading-progress", String(range > 0 ? window.scrollY / range : 0));
      root.style.setProperty("--portrait-drift", motion.matches ? "0px" : `${Math.min(window.scrollY * .12, 100)}px`);
    };
    const scroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    motion.addEventListener("change", scroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", scroll); window.removeEventListener("resize", scroll); motion.removeEventListener("change", scroll); };
  }, [path]);

  useEffect(() => {
    const root = frame.current;
    if (!root) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
    let observer: IntersectionObserver | undefined;
    const setup = () => {
      observer?.disconnect();
      elements.forEach(element => element.removeAttribute("data-reveal-pending"));
      if (motion.matches) return;
      observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).removeAttribute("data-reveal-pending");
        observer?.unobserve(entry.target);
      }), { threshold: .08, rootMargin: "0px 0px -35px 0px" });
      elements.forEach(element => {
        if (element.getBoundingClientRect().top > window.innerHeight * .95) element.setAttribute("data-reveal-pending", "true");
        observer?.observe(element);
      });
    };
    setup();
    motion.addEventListener("change", setup);
    return () => { observer?.disconnect(); motion.removeEventListener("change", setup); };
  }, [path]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);

  return <div ref={frame} className={"atlas-frame maison-frame" + (path === "/" ? "" : " interior-frame")}>
    <a href="#workspace" className="skip-link">Skip to workspace</a>
    <header className="maison-header"><div className="maison-header-left"><button className="maison-menu-trigger" onClick={() => { menu.current?.showModal(); setMenuOpen(true); }} aria-expanded={menuOpen} aria-controls="studio-menu"><span className="menu-bars" aria-hidden="true"><i/><i/></span><span>Menu</span></button><Link className="header-atlas-link" href="/measurements">The atlas</Link></div><Link href="/" className="maison-wordmark" aria-label="ElevaFace home">ElevaFace<span>.</span></Link><div className="maison-header-right"><Link href="/progress" className="header-collection-link">Ratings</Link><Link href="/scan" className="maison-booking">Rate my face <span>↗</span></Link></div><div className="reading-progress" aria-hidden="true"/></header>
    <dialog ref={menu} id="studio-menu" className="maison-menu" onClose={() => setMenuOpen(false)} onClick={event => { if (event.target === event.currentTarget) closeMenu(); }} aria-label="Studio navigation"><div className="menu-shell"><div className="menu-topline"><span>ELEVAFACE / THE PRIVATE ATLAS</span><button onClick={closeMenu} className="menu-close" aria-label="Close menu">Close <span>×</span></button></div><div className="menu-composition"><nav aria-label="Main navigation">{NAV.map(item => <Link key={item.href} href={item.href} onClick={closeMenu} aria-current={(item.href === "/" ? path === "/" : path.startsWith(item.href)) ? "page" : undefined}><span>{item.number}</span><span>{item.label}</span><i>↗</i></Link>)}<Link href="/settings" onClick={closeMenu}><span>05</span><span>Settings & backups</span><i>↗</i></Link></nav><div className="menu-image"><img src="/images/campaign-profile.webp" alt="" width="1536" height="1024"/><span>INDIVIDUALITY, IN FOCUS.</span></div></div><div className="menu-bottomline"><span>YOUR PHOTOGRAPHS STAY WITH YOU.</span><Link href="/scan" onClick={closeMenu}>Rate my face ↗</Link></div></div></dialog>
    <div id="workspace" className="atlas-workspace"><div key={path} className="page-arrival">{children}</div></div>
    <footer className="maison-footer"><div className="footer-topline"><p>ELEVATE YOUR FACE.</p><span>PRIVATE BY DESIGN.</span></div><Link className="footer-wordmark" href="/" aria-label="ElevaFace home">ElevaFace<span>.</span></Link><div className="footer-bottomline"><p>An independent study of the face.<br/>On your device. On your terms.</p><nav aria-label="Footer navigation"><Link href="/about">About & privacy</Link><Link href="/guide">Photo notes</Link><Link href="/settings">Settings & backups</Link></nav><span>FREEHARMONY / AGPL-3.0<br/>THE PRIVATE EDITION © 2026</span></div></footer>
  </div>;
}
