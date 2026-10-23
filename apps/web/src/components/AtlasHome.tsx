"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadScans, type StoredScan } from "@/lib/store";
import { formatScore, rateScan } from "@/lib/rating";

const PORTRAITS = {
  front: { src: "/images/campaign-enface.webp", alt: "Editorial portrait facing the camera, used as an illustrative example" },
  side: { src: "/images/campaign-profile.webp", alt: "Editorial portrait in profile, used as an illustrative example" },
} as const;

// Illustrative sample figures for the product preview; they describe no real person.
const SAMPLE_PILLARS = [
  { label: "Harmony", score: 7.7 },
  { label: "Angularity", score: 7.2 },
  { label: "Dimorphism", score: 8.0 },
  { label: "Features", score: 6.9 },
] as const;
const SAMPLE_STRENGTHS = [
  { label: "Lateral canthal tilt", detail: "6.2° · ideal 4.0–8.5°", impact: "+0.21" },
  { label: "Jaw definition", detail: "Sharp, defined jawline", impact: "+0.18" },
  { label: "Facial thirds", detail: "Within the ideal range", impact: "+0.12" },
] as const;
const SAMPLE_FLAWS = [
  { label: "Under-eye area", detail: "Mild under-eye shadowing", impact: "−0.24" },
  { label: "Chin projection", detail: "Slightly recessed chin", impact: "−0.19" },
  { label: "Skin quality", detail: "Some visible texture", impact: "−0.15" },
] as const;

const STEPS = [
  { title: "Choose your reference", text: "Pick whether you are rated against male or female ideals. You can switch it on your report at any time." },
  { title: "Add a front photo", text: "Face the camera in even light. 478 landmarks are mapped in about two seconds, right in your browser." },
  { title: "Add your side profile", text: "Turn 90° with your ear and jaw visible. The silhouette is traced to measure your nose, lips, chin and jaw." },
] as const;

const PILLARS = [
  { n: "01", title: "Harmony", text: "66 proportions across your front and profile, each compared with the ideal range for your gender: facial thirds, eye spacing, canthal tilt, nose and lip angles, chin projection and more." },
  { n: "02", title: "Angularity", text: "How defined your bone structure reads: cheekbone prominence, jawline, cheek leanness, chin and the angle between chin and neck." },
  { n: "03", title: "Dimorphism", text: "How masculine or feminine your jaw, brow, eyes, face shape, nose, lips and hair read, scored against the gender you choose." },
  { n: "04", title: "Features", text: "The quality of what sits on the structure: symmetry, skin, under-eyes, sclera, brows, eyelids and lips, measured from your photo." },
] as const;

const FAQ = [
  { q: "How accurate is the rating?", a: "On a public research set of 102 rated faces, the overall score ranks people in broadly the same order as human judges (a correlation of about 0.5 within each sex), and left and right profiles of the same person agree closely. It is a structured, repeatable guide, not a verdict. Lighting, lens distance and head angle change the result, so compare photos taken the same way." },
  { q: "Are my photos uploaded anywhere?", a: "No. Face detection, landmarks, measurements and the rating all run in your browser. Your photos and ratings are saved only in this browser, and you can export or delete them at any time. There is no account." },
  { q: "What photos work best?", a: "A sharp front photo at eye level from about an arm's length or more, neutral expression, even light and hair off the forehead. For the profile, turn a full 90° with your ear, jaw and neck visible against a plain background." },
  { q: "What does a score of 7 mean?", a: "Scores are percentile-based with 5 as average. A 6 is roughly the top 29%, a 7 about 1 in 18 people and an 8 about 1 in 250. The scale is symmetric, so a 3 is as uncommon as a 7." },
  { q: "Can I correct the landmarks?", a: "Yes. Every point can be moved on the landmarks page and your rating updates live as you adjust. Estimated points count for less until you review them." },
  { q: "Is it free?", a: "Yes. No subscription, no paywall and no sign-up." },
] as const;

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6"/></svg>;
}
function Check() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 10.5 3.2 3L15 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
const width = (score: number) => ({ width: `${score * 10}%` });

function SampleCard() {
  return <div className="hv-result" aria-label="Sample rating card">
    <div className="hv-result-head"><span>Sample result</span><span className="hv-live"><i/> Rated on device</span></div>
    <div className="hv-result-score"><strong>7.4</strong><span>/ 10</span></div>
    <p className="hv-result-label">Great · Top 2%</p>
    <ul>{SAMPLE_PILLARS.map(p => <li key={p.label}><span>{p.label}</span><b><i style={width(p.score)}/></b><em>{p.score.toFixed(1)}</em></li>)}</ul>
  </div>;
}

export function AtlasHome() {
  const [scans, setScans] = useState<StoredScan[]>([]);
  const [view, setView] = useState<"front" | "side">("front");
  useEffect(() => setScans(loadScans()), []);
  const last = scans[0];
  const lastScore = last ? rateScan(last).overall?.score ?? null : null;

  return <main className="home-v2">
    <section className="hv-hero" aria-labelledby="hero-title">
      <div className="hv-hero-inner">
        <div className="hv-hero-copy">
          <p className="hv-pill"><span/>Free · Private · No sign-up</p>
          <h1 id="hero-title">Know your face.<br/><em>Elevate it.</em></h1>
          <p className="hv-lede">A precise rating out of 10 from a front photo and a side profile: 66 proportions, four pillars, your percentile and a clear list of what lifts and what holds back your score.</p>
          <div className="hv-actions">
            <Link href="/scan" className="hv-button">Rate my face <Arrow/></Link>
            <a href="#sample" className="hv-button is-ghost">See a sample report</a>
          </div>
          <ul className="hv-trust">
            <li><Check/>Photos never leave your device</li>
            <li><Check/>Results in under a minute</li>
            <li><Check/>Every point adjustable</li>
          </ul>
          {last && <Link href={`/results/${last.id}`} className="hv-resume"><img src={last.photo} alt=""/><span><small>Your latest rating</small><b>{lastScore !== null ? `${formatScore(lastScore)} / 10` : "Open report"}</b></span><Arrow/></Link>}
        </div>
        <div className="hv-hero-visual">
          <div className="hv-portrait">
            <img src={PORTRAITS.front.src} alt={PORTRAITS.front.alt} width="1536" height="1024" fetchPriority="high"/>
            <span className="hv-scanline" aria-hidden="true"/>
          </div>
          <SampleCard/>
          <div className="hv-chip is-top"><b>Canthal tilt</b><span>+6.2° · Ideal</span></div>
          <div className="hv-chip is-bottom"><b>Facial thirds</b><span>33 · 33 · 34%</span></div>
        </div>
      </div>
    </section>

    <section className="hv-stats" aria-label="At a glance">
      {[["71", "measurements"], ["478", "landmarks per photo"], ["4", "scoring pillars"], ["0", "photos uploaded"]].map(([n, l]) => <div key={l} data-reveal><strong>{n}</strong><span>{l}</span></div>)}
    </section>

    <section className="hv-section" aria-labelledby="how-title">
      <header className="hv-head" data-reveal><p className="hv-eyebrow">How it works</p><h2 id="how-title">Three steps. <em>One minute.</em></h2></header>
      <ol className="hv-steps">{STEPS.map((s, i) => <li key={s.title} data-reveal><span className="hv-step-n">{i + 1}</span><h3>{s.title}</h3><p>{s.text}</p></li>)}</ol>
    </section>

    <section className="hv-section hv-sample" id="sample" aria-labelledby="sample-title">
      <header className="hv-head" data-reveal><p className="hv-eyebrow">Your report</p><h2 id="sample-title">Not just a number. <em>The reasons behind it.</em></h2><p>Every rating breaks down into pillars, ranks your strengths and flaws by how much they move your score, and shows the measurement, ideal range and landmarks behind each one.</p></header>
      <div className="hv-report" data-reveal>
        <div className="hv-report-top">
          <div className="hv-report-overall">
            <span className="hv-eyebrow">Overall rating</span>
            <div className="hv-report-score"><strong>7.4</strong><span>/ 10</span></div>
            <p>Great</p>
            <dl><div><dt>Top 2%</dt><dd>of people</dd></div><div><dt>1 in 46</dt><dd>rarity</dd></div><div><dt>8.3</dt><dd>potential</dd></div></dl>
          </div>
          <div className="hv-report-pillars">{SAMPLE_PILLARS.map(p => <div key={p.label}><span>{p.label}</span><strong>{p.score.toFixed(1)}</strong><b><i style={width(p.score)}/></b></div>)}</div>
        </div>
        <div className="hv-report-lists">
          <div><h3>What lifts your score</h3>{SAMPLE_STRENGTHS.map(s => <div className="hv-impact" key={s.label}><span><b>{s.label}</b><small>{s.detail}</small></span><em className="is-up">{s.impact}</em></div>)}</div>
          <div><h3>What holds it back</h3>{SAMPLE_FLAWS.map(s => <div className="hv-impact" key={s.label}><span><b>{s.label}</b><small>{s.detail}</small></span><em className="is-down">{s.impact}</em></div>)}</div>
        </div>
        <p className="hv-report-note">Illustrative sample. Your report is built from your own photos.</p>
      </div>
    </section>

    <section className="hv-section" aria-labelledby="pillars-title">
      <header className="hv-head" data-reveal><p className="hv-eyebrow">What we measure</p><h2 id="pillars-title">Four pillars. <em>One score.</em></h2><p>Your overall rating combines four pillars and weighs your weakest one most, the same way a face is read as a whole.</p></header>
      <div className="hv-pillars">{PILLARS.map(p => <article key={p.title} data-reveal><span>{p.n}</span><h3>{p.title}</h3><p>{p.text}</p></article>)}</div>
    </section>

    <section className="hv-section hv-views" aria-labelledby="views-title">
      <div className="hv-views-visual" data-reveal>
        <img src={PORTRAITS[view].src} alt={PORTRAITS[view].alt} width="1536" height="1024" loading="lazy" key={view}/>
        <div className="hv-toggle" role="group" aria-label="Perspective">{(["front", "side"] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v === "front" ? "Front" : "Profile"}</button>)}</div>
      </div>
      <div className="hv-views-copy" data-reveal>
        <p className="hv-eyebrow">Two perspectives</p>
        <h2 id="views-title">The front tells half <em>the story.</em></h2>
        <p>{view === "front" ? "The front view measures your facial thirds, width-to-height ratio, eye spacing and tilt, brows, nose and mouth widths, cheekbones and jaw." : "The profile adds what a mirror never shows: facial convexity, nasal and nasolabial angles, lip position, chin projection, jaw angle and the line from chin to neck."}</p>
        <ul className="hv-list">{(view === "front" ? ["36 front measurements", "Symmetry, skin and eye-area analysis", "Hairline, ears and neck placed automatically"] : ["35 profile measurements", "Silhouette traced in either direction", "Jaw and chin-to-neck angles"]).map(t => <li key={t}><Check/>{t}</li>)}</ul>
        <Link href="/scan" className="hv-button">Rate both perspectives <Arrow/></Link>
      </div>
    </section>

    <section className="hv-privacy" aria-labelledby="privacy-title">
      <div className="hv-privacy-inner">
        <div data-reveal><p className="hv-eyebrow">Private by design</p><h2 id="privacy-title">Your face stays <em>yours.</em></h2><p>Most rating apps upload your photo to a server. ElevaFace runs the vision models in your browser, so your photos are never sent anywhere.</p><Link href="/about" className="hv-text-link">Our approach to privacy <Arrow/></Link></div>
        <ul data-reveal>
          <li><h3>On your device</h3><p>Detection, measurement and scoring run locally in your browser.</p></li>
          <li><h3>No account</h3><p>Nothing to sign up for. Your history lives in this browser only.</p></li>
          <li><h3>Yours to keep</h3><p>Export a backup, print a PDF or delete everything in one click.</p></li>
        </ul>
      </div>
    </section>

    <section className="hv-section hv-faq" aria-labelledby="faq-title">
      <header className="hv-head" data-reveal><p className="hv-eyebrow">Questions</p><h2 id="faq-title">Good to <em>know.</em></h2></header>
      <div className="hv-faq-list" data-reveal>{FAQ.map(f => <details key={f.q}><summary>{f.q}<span aria-hidden="true"/></summary><p>{f.a}</p></details>)}</div>
    </section>

    <section className="hv-final" data-reveal>
      <h2>Your rating is <em>a minute away.</em></h2>
      <p>A front photo and a side profile. Free, private and entirely on your device.</p>
      <Link href="/scan" className="hv-button is-light">Rate my face <Arrow/></Link>
    </section>
  </main>;
}
