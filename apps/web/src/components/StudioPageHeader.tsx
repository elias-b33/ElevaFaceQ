import Link from "next/link";
import type { ReactNode } from "react";

export function StudioArrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M5 19 19 5M5 5h14v14" : "M4 12h15m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.2"/></svg>;
}

export function StudioPageHeader({ section, title, description, action, children }: {
  section: string; title: ReactNode; description: string; action?: { href: string; label: string }; children?: ReactNode;
}) {
  return <header className="studio-page-header">
    <div className="studio-breadcrumb"><Link href="/">The studio</Link><span>/</span><span>{section}</span></div>
    <div className="studio-heading-composition"><div><p className="studio-overline">FACEIQ / THE PRIVATE EDITION</p><h1>{title}</h1></div><div className="studio-heading-note"><p>{description}</p>{action && <Link href={action.href} className="studio-inline-link">{action.label}<StudioArrow diagonal/></Link>}{children}</div></div>
  </header>;
}
