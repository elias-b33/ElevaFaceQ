"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { generatePlan, type Plan } from "@freeharmony/advice";
import { getScan, loadProfile, personalContext, type StoredScan } from "@/lib/store";
import { StudioPageHeader } from "@/components/StudioPageHeader";

const CATEGORY: Record<string, string> = {
  photography: "Photo setup", "body-composition": "Body composition", posture: "Posture", skincare: "Skincare",
  hair: "Hair", brows: "Brows", beard: "Beard", teeth: "Teeth", lifestyle: "Lifestyle",
};

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [scan, setScan] = useState<StoredScan | null | undefined>(undefined);
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => {
    const s = getScan(id) ?? null;
    setScan(s);
    if (s?.result.ok) setPlan(generatePlan(s.result, personalContext(loadProfile())));
  }, [id]);

  if (scan === undefined) return <main className="studio-page"><p className="studio-loading" role="status">Loading…</p></main>;
  return <main className="studio-page improve-page">
    <StudioPageHeader section="How to improve" title={<>How to improve<span className="title-stop">.</span></>} description="Practical, non-invasive steps ranked by how much they are likely to help, starting with the ones that work today. None of this is medical advice.">
      {scan && <Link href={`/results/${scan.id}`} className="studio-inline-link">Back to your rating</Link>}
    </StudioPageHeader>
    {!scan || !plan ? <div className="improve-empty"><p>No suggestions are available for this rating yet.</p><Link href="/scan" className="primary-button">Rate my face <span>→</span></Link></div> : <>
      <ol className="improve-list">{plan.items.map((item, i) => <li key={item.rule.id}>
        <span className="improve-number">{i + 1}</span>
        <div>
          <div className="improve-meta"><span>{CATEGORY[item.rule.category] ?? item.rule.category}</span><span className={item.rule.timeline === "immediate" ? "is-now" : ""}>{item.rule.timeline === "immediate" ? "Works immediately" : `Takes ${item.rule.timeline}`}</span></div>
          <h2>{item.rule.title}</h2>
          <p>{item.rule.body}</p>
          {item.rule.impactNote && <p className="improve-note">{item.rule.impactNote}</p>}
        </div>
      </li>)}</ol>
      {plan.safetyNotes.length > 0 && <section className="improve-safety"><h2>What we won’t advise</h2>{plan.safetyNotes.map((n, i) => <p key={i}>{n}</p>)}</section>}
    </>}
  </main>;
}
