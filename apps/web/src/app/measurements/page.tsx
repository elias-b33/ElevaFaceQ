"use client";

import { useState } from "react";
import Link from "next/link";
import { FRONT_LANDMARKS, HARMONY_CATALOG, REFERENCE_NOTE, SIDE_LANDMARKS } from "@freeharmony/engine";

export default function MeasurementLibrary() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  const [group, setGroup] = useState("all");
  const groups = [...new Set(HARMONY_CATALOG.filter(d => view === "all" || d.view === view).map(d => d.group))];
  const visible = HARMONY_CATALOG.filter(d => (view === "all" || d.view === view) && (group === "all" || d.group === group) && `${d.label} ${d.formula} ${d.explanation}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="definition-library">
    <header className="library-heading"><p className="eyebrow">YOUR MEASUREMENT FIELD GUIDE</p><h1>Every measurement. No mystery.</h1><p>Explore all 71 public definitions: 36 front and 35 side, including five supporting measurements. Read the formula, check the points, and understand what can change the result.</p><Link href="/scan" className="text-button mt-4">Start your own report →</Link></header>
    <div className="measurement-filters"><input type="search" aria-label="Search measurement definitions" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find midface, E-line, gonial angle…"/><select aria-label="Definition view" value={view} onChange={e => { setView(e.target.value); setGroup("all"); }}><option value="all">Front & side</option><option value="front">Front · 36</option><option value="side">Side · 35</option></select><select aria-label="Definition region" value={group} onChange={e => setGroup(e.target.value)}><option value="all">All regions</option>{groups.map(g => <option key={g}>{g}</option>)}</select></div>
    <p className="definition-count">{visible.length} definitions · Geometry runs offline · Source links open externally only when you choose them</p>
    <div className="definition-grid">{visible.map(def => {
      const points = def.view === "front" ? FRONT_LANDMARKS : SIDE_LANDMARKS;
      return <article className="definition-card card" key={def.key}><span className="eyebrow">{def.view} · {def.group}{def.supporting ? " · SUPPORTING" : ""}</span><h2>{def.label}</h2><p>{def.explanation}</p><div className="formula-box"><span>FORMULA</span><p>{def.formula}</p></div><details><summary>Landmarks & limits</summary><ul>{def.required.map(key => <li key={key}>{points.find(p => p.key === key)?.label ?? key}</li>)}</ul><p>{def.caution}</p>{def.adaptation && <p className="adaptation-note">Local adaptation: {def.adaptation}</p>}</details><a href={def.source} target="_blank" rel="noreferrer">Public definition ↗</a></article>;
    })}</div>
    {!visible.length && <p className="filter-empty">No definitions match these filters.</p>}
    <p className="reference-note">{REFERENCE_NOTE} The overview and detailed guide at FaceIQ currently use different counts. This local catalogue includes every definition in its detailed index and does not reproduce its private scoring model.</p>
  </main>;
}
