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
  { href: "/progress", label: "Your ratings" },
  { href: "/measurements", label: "Measurements" },
  { href: "/guide", label: "Photo guide" },
  { href: "/about", label: "Privacy" },
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

  const current = (href: string) => href === "/" ? path === "/" : path.startsWith(href);
  return <div ref={frame} className={"atlas-frame maison-frame" + (path === "/" ? "" : " interior-frame")}>
    <a href="#workspace" className="skip-link">Skip to content</a>
    <header className="site-header">
      <Link href="/" className="site-logo" aria-label="ElevaFace home">ElevaFace<span>.</span></Link>
      <nav className="site-nav" aria-label="Main navigation">{NAV.map(item => <Link key={item.href} href={item.href} aria-current={current(item.href) ? "page" : undefined}>{item.label}</Link>)}</nav>
      <div className="site-header-actions">
        <Link href="/scan" className="site-cta">Rate my face</Link>
        <button className="site-menu-button" onClick={() => { menu.current?.showModal(); setMenuOpen(true); }} aria-expanded={menuOpen} aria-controls="site-menu" aria-label="Open menu"><span aria-hidden="true"><i/><i/></span></button>
      </div>
    </header>
    <dialog ref={menu} id="site-menu" className="site-menu" onClose={() => setMenuOpen(false)} onClick={event => { if (event.target === event.currentTarget) closeMenu(); }} aria-label="Navigation">
      <div className="site-menu-panel">
        <div className="site-menu-top"><Link href="/" className="site-logo" onClick={closeMenu}>ElevaFace<span>.</span></Link><button onClick={closeMenu} className="site-menu-close" aria-label="Close menu"><span aria-hidden="true">×</span></button></div>
        <nav aria-label="Menu">{[{ href: "/", label: "Home" }, ...NAV, { href: "/settings", label: "Settings & backups" }].map(item => <Link key={item.href} href={item.href} onClick={closeMenu} aria-current={current(item.href) ? "page" : undefined}>{item.label}<i aria-hidden="true">→</i></Link>)}</nav>
        <Link href="/scan" className="site-menu-cta" onClick={closeMenu}>Rate my face</Link>
        <p className="site-menu-note">Free, private and entirely on your device.</p>
      </div>
    </dialog>
    <div id="workspace" className="atlas-workspace"><div key={path} className="page-arrival">{children}</div></div>
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand"><Link href="/" className="site-logo">ElevaFace<span>.</span></Link><p>A private face rating that runs entirely in your browser. No account, no uploads.</p><Link href="/scan" className="site-footer-cta">Rate my face →</Link></div>
        <nav aria-label="Product"><h2>Product</h2><Link href="/scan">Rate my face</Link><Link href="/progress">Your ratings</Link><Link href="/measurements">Measurements</Link></nav>
        <nav aria-label="Help"><h2>Help</h2><Link href="/guide">Photo guide</Link><Link href="/about">Privacy & method</Link><Link href="/settings">Settings & backups</Link></nav>
      </div>
      <div className="site-footer-bottom"><span>© 2026 ElevaFace · Built on FreeHarmony (AGPL-3.0)</span><span>Not affiliated with FaceIQ Labs</span></div>
    </footer>
  </div>;
}
