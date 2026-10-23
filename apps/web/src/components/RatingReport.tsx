"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { APPEAL, HARMONY_CATALOG, itemLabel, type HarmonyView, type Impact, type PillarKey, type RatingGender } from "@freeharmony/engine";
import { saveScan, type StoredScan } from "@/lib/store";
import { scanDocuments } from "@/lib/harmony";
import { formatImpact, formatItemScore, formatRange, formatRarity, formatScore, formatStanding, formatValue, rateScan, scanGender } from "@/lib/rating";
import { measureSavedAppeal } from "@/lib/appeal";
import { LandmarkPreview } from "./PhotoPicker";
import { AnatomyPlate } from "./AnatomyPlate";

const PILLARS: PillarKey[] = ["harmony", "angularity", "dimorphism", "features"];
const tone = (score: number) => score >= 7 ? "is-great" : score >= 5.5 ? "is-good" : score >= 4 ? "is-fair" : "is-poor";

export function ScoreBar({ score, average = true }: { score: number; average?: boolean }) {
  return <span className={`score-bar ${tone(score)}`} role="img" aria-label={`${score.toFixed(1)} out of 10`}><i style={{ width: `${Math.max(2, score * 10)}%` }}/>{average && <b aria-hidden="true"/>}</span>;
}
function ScoreChip({ score, text = score.toFixed(1) }: { score: number; text?: string }) {
  return <span className={`score-chip ${tone(score)}`}>{text}</span>;
}

export function RatingReport({ initial }: { initial: StoredScan }) {
  const [scan, setScan] = useState(initial);
  const [view, setView] = useState<HarmonyView>("front");
  const [showPoints, setShowPoints] = useState(false);
  const [message, setMessage] = useState("");
  const gender = scanGender(scan);
  const settings = useMemo(() => scanDocuments(scan), [scan]);
  const rating = useMemo(() => rateScan(scan, settings, gender), [scan, settings, gender]);
  const overall = rating.overall;
  // Ratings saved before the appeal model (or with an older version) are scored once, in the browser.
  const needsAppeal = scan.appeal?.version !== APPEAL.version && !!scan.photo && !!scan.input?.landmarks?.length;
  const [appealState, setAppealState] = useState<"idle" | "busy" | "failed">("idle");
  useEffect(() => {
    if (!needsAppeal) return;
    let cancelled = false;
    setAppealState("busy");
    measureSavedAppeal(scan.photo, scan.input!.landmarks).then(appeal => {
      if (cancelled) return;
      const updated = { ...scan, appeal };
      try { saveScan(updated); } catch { /* shown for this visit even if it cannot be stored */ }
      setScan(updated); setAppealState("idle");
    }).catch(() => { if (!cancelled) setAppealState("failed"); });
    return () => { cancelled = true; };
  }, [needsAppeal, scan]);
  const setGender = (next: RatingGender) => {
    const updated = { ...scan, gender: next };
    try { saveScan(updated); setMessage(""); } catch { setMessage("The change applies now but could not be saved in this browser."); }
    setScan(updated);
  };
  const measurements = rating.harmony.measurements.filter(m => m.view === view);
  const groups = [...new Set(HARMONY_CATALOG.filter(d => d.view === view && !d.supporting).map(d => d.group))];
  const notMeasured = HARMONY_CATALOG.filter(d => d.view === view && !d.supporting && !measurements.some(m => m.key === d.key));
  const date = new Date(scan.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  return <main className="rating-page">
    <header className="rating-heading">
      <div><Link href="/progress" className="back-link">← Your ratings</Link><p className="eyebrow">YOUR RATING · {date.toUpperCase()}</p><h1>Your face <em>rating.</em></h1></div>
      <div className="rating-actions">
        <div className="gender-switch" role="group" aria-label="Rated as">{(["male", "female"] as const).map(g => <button key={g} aria-pressed={gender === g} onClick={() => setGender(g)}>{g === "male" ? "Male" : "Female"}</button>)}</div>
        <Link className="secondary-button" href={`/results/${scan.id}/landmarks`}>Adjust landmarks</Link>
        <button className="secondary-button" onClick={() => window.print()}>Print / PDF</button>
      </div>
    </header>
    {message && <p className="report-alert" role="status">{message}</p>}

    <section className="rating-hero">
      <div className="rating-photos">
        <figure>{scan.photo ? <LandmarkPreview photo={scan.photo} aspect={scan.imageAspect ?? 1} doc={showPoints ? settings.front : undefined} alt="Your front photo"/> : <AnatomyPlate/>}<figcaption><span>FRONT</span><span>{rating.harmony.front ? `HARMONY ${formatScore(rating.harmony.front.score)}` : "NOT MEASURED"}</span></figcaption></figure>
        <figure>{scan.side?.photo ? <LandmarkPreview photo={scan.side.photo} aspect={scan.side.imageAspect ?? 1} doc={showPoints ? settings.side : undefined} alt="Your side profile photo"/> : <Link className="add-profile-plate" href={`/scan/side?attach=${scan.id}`}><AnatomyPlate view="side"/><span>Add your side profile ↗</span></Link>}<figcaption><span>PROFILE</span><span>{rating.harmony.side ? `HARMONY ${formatScore(rating.harmony.side.score)}` : "ADD A PROFILE"}</span></figcaption></figure>
        <button className="text-button points-toggle" onClick={() => setShowPoints(v => !v)}>{showPoints ? "Hide landmarks" : "Show landmarks"}</button>
      </div>
      <div className="rating-overall">
        <span className="folio">OVERALL RATING{rating.complete ? "" : " · PROVISIONAL"}</span>
        {overall ? <>
          <div className="overall-score"><strong>{formatScore(overall.score)}</strong><span>/ 10</span></div>
          <p className="overall-label">{overall.label}</p>
          <div className="overall-parts">{rating.appeal ? <span><b>{formatScore(rating.appeal.score)}</b> facial appeal</span> : <span>{appealState === "busy" ? "Scoring facial appeal…" : appealState === "failed" ? "Facial appeal unavailable" : "Facial appeal not measured"}</span>}{rating.structure && <span><b>{formatScore(rating.structure.score)}</b> structure</span>}</div>
          <div className="overall-scale" aria-hidden="true"><i style={{ left: `${overall.score * 10}%` }}/><span style={{ left: "50%" }}>5 · average</span><span style={{ left: "70%" }}>7</span><span style={{ left: "80%" }}>8</span></div>
          <div className="overall-stats">
            <div><strong>{formatStanding(overall.percentile)}</strong><span>of people</span></div>
            <div><strong>{overall.score >= 6 ? formatRarity(overall.rarity) : "Common"}</strong><span>rarity</span></div>
            <div><strong>{rating.potential !== null ? formatScore(rating.potential) : "—"}</strong><span>potential</span></div>
          </div>
          <p className="overall-note">{rating.potential !== null && rating.potential > overall.score + .05 ? `Your potential is the overall score if your five largest flaws reached their ideal.` : "5 is the population average; 7 is about 1 in 18 people and 8 about 1 in 250."}</p>
        </> : <p className="overall-pending">{rating.notes[0] ?? "Not enough of the face could be measured. Check the landmarks or retake the photos."}</p>}
        {!rating.complete && scan.side === undefined && <Link className="primary-button" href={`/scan/side?attach=${scan.id}`}>Add a side profile to complete it <span>↗</span></Link>}
      </div>
    </section>

    <section className="pillar-grid" aria-label="Pillar scores">
      {PILLARS.map((key, i) => { const p = rating.pillars[key]; return <a key={key} className="pillar-card" href={`#${key}`}>
        <span className="folio">{String(i + 1).padStart(2, "0")} / {p.label.toUpperCase()}</span>
        <strong>{p.summary ? formatScore(p.summary.score) : "—"}</strong>
        <span className="pillar-label">{p.summary ? p.summary.label : key === "harmony" ? "Needs a photo" : "Needs more of the face"}</span>
        {p.summary && <ScoreBar score={p.summary.score}/>}
        <p>{p.description}</p>
      </a>; })}
    </section>

    <section className="impact-section">
      <ImpactList title="Strengths" kicker="WHAT LIFTS YOUR STRUCTURE" items={rating.strengths} empty="No standout strengths yet. Check that the landmarks sit correctly."/>
      <ImpactList title="Flaws" kicker="WHAT HOLDS IT BACK" items={rating.flaws} empty="No significant flaws were found." more={scan.result.ok ? { href: `/plan/${scan.id}`, label: "How to improve →" } : undefined}/>
    </section>

    <section id="harmony" className="rating-detail">
      <div className="detail-heading"><div><span className="folio">01 / HARMONY · 60% FRONT, 40% SIDE</span><h2>Proportions</h2></div><div className="detail-score">{rating.pillars.harmony.summary ? <><strong>{formatScore(rating.pillars.harmony.summary.score)}</strong><span>{rating.pillars.harmony.summary.label}</span></> : <span>Not scored</span>}</div></div>
      <div className="view-switch-row"><div className="report-view-tabs" role="tablist" aria-label="Harmony view">{(["front", "side"] as const).map(v => { const s = rating.harmony[v]; return <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>{v === "front" ? "Front" : "Side"} <span>{s ? formatScore(s.score) : "—"}</span></button>; })}</div><span className="report-plane">{measurements.length} of {measurements.length + notMeasured.length} measured · scored against {gender} ideals</span></div>
      {view === "side" && !scan.side ? <div className="detail-empty"><p>A side profile adds 33 measurements: convexity, nose angles, lip lines, chin projection, jaw and neck.</p><Link className="primary-button" href={`/scan/side?attach=${scan.id}`}>Add a side profile <span>↗</span></Link></div> : <>
        {groups.map(group => { const rows = measurements.filter(m => m.group === group); if (!rows.length) return null; return <div className="measure-group" key={group}>
          <h3>{group}</h3>
          <div className="measure-table" role="table" aria-label={`${group} measurements`}>
            <div className="measure-row is-head" role="row"><span role="columnheader">Measurement</span><span role="columnheader">Yours</span><span role="columnheader">Ideal</span><span role="columnheader">Score</span></div>
            {rows.map(m => <div className={`measure-row ${m.position === "within" ? "is-ideal" : ""}`} role="row" key={m.key}>
              <span role="cell" className="measure-name"><strong>{m.label}</strong><small>{m.position === "within" ? "Within the ideal range" : m.reading}{m.evidence < 1 && !m.reviewed ? " · estimated points" : ""}</small></span>
              <span role="cell" className="measure-value">{formatValue(m.value, m.unit, m.ideal)}</span>
              <span role="cell" className="measure-ideal">{formatRange(m.ideal, m.unit)}</span>
              <span role="cell" className="measure-score"><ScoreBar score={m.score} average={false}/><b>{formatItemScore(m.score, m.value, m.ideal)}</b></span>
            </div>)}
          </div>
        </div>; })}
        {notMeasured.length > 0 && <p className="measure-missing">Not measured from these photos: {notMeasured.map(d => d.label).join(", ")}. <Link href={`/results/${scan.id}/landmarks${view === "side" ? "#side" : ""}`}>Place the points</Link> to include them.</p>}
      </>}
    </section>

    {(["angularity", "dimorphism", "features"] as const).map((key, i) => { const p = rating.pillars[key]; return <section id={key} className="rating-detail" key={key}>
      <div className="detail-heading"><div><span className="folio">{String(i + 2).padStart(2, "0")} / {p.label.toUpperCase()}</span><h2>{key === "angularity" ? "Definition" : key === "dimorphism" ? (gender === "male" ? "Masculinity" : "Femininity") : "Feature quality"}</h2><p>{p.description}</p></div><div className="detail-score">{p.summary ? <><strong>{formatScore(p.summary.score)}</strong><span>{p.summary.label}</span></> : <span>Not scored</span>}</div></div>
      <div className="assessment-list">{p.items.map(item => <div className="assessment-row" key={item.key}>
        <span className="measure-name"><strong>{item.label}</strong><small>{item.reading}</small></span>
        <span className="assessment-grade">{itemLabel(item.score)}</span>
        <span className="measure-score"><ScoreBar score={item.score}/><b>{item.score.toFixed(1)}</b></span>
      </div>)}</div>
      {p.coverage < 1 && <p className="measure-missing">{key === "features" && !scan.imageFeatures ? "Photo-based assessments are available for ratings created with this version. Start a new rating to include skin, eyes and symmetry." : !scan.side ? "Some assessments need the side profile." : "Some assessments could not be measured from these photos."}</p>}
    </section>; })}

    <section className="rating-method">
      <div><span className="folio">METHOD</span><h2>How your rating works</h2></div>
      <div className="method-columns">
        <p><b>Overall</b> is 80% facial appeal and 20% structure. <b>Facial appeal</b> comes from a model trained on 5,500 faces, each rated by 60 people (SCUT-FBP5500), that reads your whole front photo the way raters do. <b>Structure</b> combines the four measured pillars below and explains the score; strengths and flaws show how each item moves it.</p>
        <p><b>The scale.</b> Scores run from 0 to 10 with 5 as the average adult. It is percentile-based: a 7 is about 1 in 18 people, an 8 about 1 in 250, and a 3 is as uncommon as a 7.</p>
        <p><b>Harmony</b> scores 66 front and profile measurements against ideal ranges for your gender. <b>Angularity, Dimorphism and Features</b> combine geometry with in-photo comparisons of skin, eyes, brows, beard, hair and symmetry.</p>
        <p><b>Accuracy.</b> On 102 adults it never saw (Face Research Lab London Set), facial appeal ranked people like human raters at about 0.70 for men and 0.59 for women (Spearman, within each sex). Photo quality matters: sharp, front-on, evenly lit photos taken from a distance give the most reliable result.</p>
      </div>
      {rating.notes.length > 0 && <ul className="flow-notes">{rating.notes.map(n => <li key={n}>{n}</li>)}</ul>}
      <p className="method-disclaimer">A structured guide, not a verdict. Lens distance, lighting, expression and head angle change the measurements, so compare photos taken the same way. Estimated landmarks are weighted less; review them for the most accurate result. Independent work, not affiliated with FaceIQ Labs.</p>
      <div className="method-links"><Link href={`/results/${scan.id}/landmarks`}>Adjust landmarks & measurements ↗</Link><Link href="/measurements">Browse all measurements ↗</Link></div>
    </section>
  </main>;
}

function ImpactList({ title, kicker, items, empty, more }: { title: string; kicker: string; items: Impact[]; empty: string; more?: { href: string; label: string } }) {
  return <div className="impact-column">
    <span className="folio">{kicker}</span><h2>{title}</h2>
    {items.length ? <ol>{items.slice(0, 8).map(item => <li key={item.key} className="impact-row">
      <ScoreChip score={item.score} text={formatItemScore(item.score, item.value, item.ideal)}/>
      <span className="impact-text"><strong>{item.label}</strong><small>{item.reading}{item.value !== undefined && item.unit ? ` · ${formatValue(item.value, item.unit, item.ideal)}` : ""}{item.ideal && item.unit ? ` (ideal ${formatRange(item.ideal, item.unit)})` : ""}</small></span>
      <span className={`impact-value ${item.impact >= 0 ? "is-up" : "is-down"}`}>{formatImpact(item.impact)}</span>
    </li>)}</ol> : <p className="impact-empty">{empty}</p>}
    {more && <Link className="impact-more" href={more.href}>{more.label}</Link>}
  </div>;
}
