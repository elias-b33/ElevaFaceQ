"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { analyzeHarmony, FRONT_MEASUREMENT_COUNT, SIDE_MEASUREMENT_COUNT } from "@freeharmony/engine";
import { loadScans, type StoredScan } from "@/lib/store";
import { scanDocuments } from "@/lib/harmony";

const PORTRAITS = [
  { src: "/images/campaign-enface.webp", alt: "Original editorial portrait, facing the camera in warm sculptural light", label: "EN FACE", number: "01" },
  { src: "/images/campaign-profile.webp", alt: "Original editorial portrait in profile against a warm stone backdrop", label: "IN PROFILE", number: "02" },
] as const;

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M5 19 19 5M5 5h14v14" : "M4 12h15m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.2"/></svg>;
}

function Count({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1200);
        element.textContent = String(Math.round(value * (1 - (1 - t) ** 4))).padStart(2, "0");
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: .7 });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value]);
  return <span ref={ref} aria-hidden="true">{value}</span>;
}

function StudyLines({ side }: { side: boolean }) {
  const points = side
    ? [[255,249],[240,334],[243,393],[125,499],[189,549],[149,597],[169,625],[152,659],[198,760],[552,789],[714,471]]
    : [[361,267],[500,231],[638,267],[310,416],[407,415],[591,415],[689,416],[500,449],[445,552],[554,552],[420,639],[500,654],[578,639],[500,821],[322,695],[678,695]];
  return <svg viewBox="0 0 1000 1250" className="study-geometry" fill="none" aria-hidden="true">
    <g className="study-construction" stroke="currentColor" strokeWidth="1"><path d="M130 415H870M130 638H870M500 120v820" strokeDasharray="4 9"/><path d="M158 232v589m-10-589h20m-20 589h20M310 883h379m-379-10v20m379-20v20"/></g>
    <g className="study-contours" stroke="currentColor" strokeWidth="1.5">
      {side ? <><path d="M255 249Q231 294 240 334L243 393 125 499 189 549 149 597 169 625 152 659Q157 713 198 760Q370 780 552 789L714 471"/><path d="M243 393 714 471 198 760M125 499 714 471M189 549 552 789"/></> : <><path d="M361 267Q500 185 638 267L689 416 678 695Q619 791 500 821Q381 791 322 695L310 416Z"/><path d="M310 416 500 449 689 416M407 415 445 552 500 654 554 552 591 415M322 695 420 639 578 639 678 695M445 552 554 552M420 639 500 821 578 639"/></>}
    </g>
    {points.map(([x,y], i) => <g key={i} className="study-point" style={{ animationDelay: `${i * 65}ms` }}><circle cx={x} cy={y} r="4.5" fill="currentColor"/><circle cx={x} cy={y} r="11" stroke="currentColor" strokeWidth=".6" opacity=".45"/></g>)}
  </svg>;
}

export function AtlasHome() {
  const [scans, setScans] = useState<StoredScan[]>([]);
  const [portrait, setPortrait] = useState(0);
  const [paused, setPaused] = useState(false);
  const [perspective, setPerspective] = useState<"front" | "side">("front");
  const [geometry, setGeometry] = useState(true);
  useEffect(() => setScans(loadScans()), []);
  const last = scans[0], settings = last ? scanDocuments(last) : undefined;
  const front = analyzeHarmony("front", settings?.front, settings), side = analyzeHarmony("side", settings?.side, settings);

  return <main className="campaign-home">
    <section className="campaign-hero" data-motion-paused={paused} aria-label="The ElevaFace private edition">
      <div className="campaign-images" aria-hidden="true">{PORTRAITS.map((image, i) => <div className={`campaign-image ${portrait === i ? "is-active" : ""}`} key={image.src}><img src={image.src} alt="" width="1536" height="1024" fetchPriority={i === 0 ? "high" : "auto"}/></div>)}</div>
      <div className="campaign-wash"/>
      <div className="campaign-topline"><span>THE PRIVATE ATLAS</span><span>A STUDY IN INDIVIDUALITY</span></div>
      <div className="campaign-copy"><p className="campaign-kicker"><span/> YOUR FACE. A DIFFERENT PERSPECTIVE.</p><h1><span>Elevate</span><em>your face.</em></h1><p className="campaign-description">The proportions. The details. The character.<br/>Discover the face that is entirely yours.</p><Link href="/scan" className="campaign-cta"><span>Begin your study</span><i><Arrow diagonal/></i></Link><p className="campaign-assurance">71 MEASUREMENTS <b>·</b> TWO PERSPECTIVES <b>·</b> ENTIRELY PRIVATE</p></div>
      <div className="campaign-bottomline"><a href="#perspectives" className="campaign-scroll"><span className="scroll-track"/><span>SCROLL TO DISCOVER</span></a><div className="campaign-slider" role="group" aria-label="Campaign portrait">{PORTRAITS.map((image,i) => <button key={image.label} onClick={() => setPortrait(i)} aria-pressed={portrait === i} aria-label={`View ${image.label.toLowerCase()} portrait`}><span>{image.number}</span><i/><span className="slide-name">{image.label}</span></button>)}</div><button className="campaign-pause" onClick={() => setPaused(!paused)} aria-label={paused ? "Play portrait motion" : "Pause portrait motion"} aria-pressed={paused}>{paused ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5Z" fill="currentColor"/></svg> : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="1.5"/></svg>}<span>{paused ? "PLAY" : "PAUSE"}</span></button></div><span className="campaign-caption" aria-live="polite">{PORTRAITS[portrait].number} / {PORTRAITS[portrait].label} — THE PORTRAIT SERIES</span>
    </section>

    <section className="editorial-intro" id="perspectives"><div className="section-running-head" data-reveal><span>01 / THE PHILOSOPHY</span><span>INDIVIDUALITY, IN FOCUS</span></div><div className="intro-composition"><p className="intro-margin" data-reveal>THERE IS ONLY<br/>ONE OF YOU.</p><h2 data-reveal>Some things deserve<br/>a <em>closer look.</em></h2><div className="intro-note" data-reveal><p>The curve of a profile. The balance of a gaze. The details that make a face unmistakable.</p><p>ElevaFace brings them into focus. A private study of your proportions, with space to understand every measurement.</p><Link className="editorial-link" href="/measurements">Explore the face atlas <Arrow/></Link></div></div></section>

    <section className="perspective-editorial" aria-labelledby="perspective-heading">
      <div className="perspective-visual" data-reveal data-geometry={geometry}><div className="study-image-stack">{PORTRAITS.map((image, i) => <img key={image.src} src={image.src} alt={image.alt} width="1536" height="1024" loading="lazy" className={(perspective === "front" ? i === 0 : i === 1) ? "is-active" : ""}/>)}</div><div className="study-photo-label"><span>EF. / {perspective === "front" ? "EN FACE" : "PROFIL"}</span><span>THE PORTRAIT SERIES</span></div><div className="study-lines-wrap" key={perspective}><StudyLines side={perspective === "side"}/></div><div className="study-photo-bottom"><span>ILLUSTRATIVE GEOMETRY</span><button onClick={() => setGeometry(!geometry)} aria-pressed={geometry}>{geometry ? "Hide" : "Show"} geometry <span>{geometry ? "−" : "+"}</span></button></div></div>
      <div className="perspective-copy" data-reveal><p className="section-label">02 / THE TWO PERSPECTIVES</p><h2 id="perspective-heading">The detail.<br/>The <em>whole you.</em></h2><p className="perspective-deck">A face is more than its first impression.</p><div className="perspective-selector" role="group" aria-label="Study perspective"><button aria-pressed={perspective === "front"} onClick={() => setPerspective("front")}>01 <span>En face</span></button><button aria-pressed={perspective === "side"} onClick={() => setPerspective("side")}>02 <span>In profile</span></button></div><div className="perspective-details" key={perspective}><div className="perspective-count"><strong aria-label={`${perspective === "front" ? FRONT_MEASUREMENT_COUNT : SIDE_MEASUREMENT_COUNT} measurements`}><Count value={perspective === "front" ? FRONT_MEASUREMENT_COUNT : SIDE_MEASUREMENT_COUNT}/></strong><span>MEASUREMENTS<br/>{perspective === "front" ? "PROPORTION & BALANCE" : "CONTOUR & CHARACTER"}</span></div><p>{perspective === "front" ? "Facial thirds, eye spacing, symmetry, cheekbones and jaw. An open view of the relationships behind your features." : "Forehead, nose, lips, chin and the jawline. A second perspective on the contours that make your profile your own."}</p><div className="perspective-tags">{(perspective === "front" ? ["Facial balance", "Eye area", "Jaw & cheekbones"] : ["Profile angles", "Nose & lips", "Chin & jawline"]).map(label => <span key={label}>{label}</span>)}</div></div><Link href="/scan" className="editorial-link">Discover your proportions <Arrow/></Link><p className="illustration-note">Original campaign imagery. The preview is illustrative; your report uses your own photograph.</p></div>
    </section>

    <section className="private-chapter"><div className="private-chapter-grain" aria-hidden="true"/><div className="section-running-head" data-reveal><span>03 / THE PRIVATE EDITION</span><span>FOR YOUR EYES ONLY</span></div><div className="private-chapter-body"><div data-reveal><h2>Personal.<br/><em>In every sense.</em></h2><p>Your photograph is the beginning of a personal study.<br/>It stays exactly where it belongs. With you.</p><Link href="/about" className="editorial-link">Our approach to privacy <Arrow/></Link></div><div className="privacy-manifesto" data-reveal><div><span>01</span><h3>On your device.</h3><p>Landmark detection and measurements happen in your browser.</p></div><div><span>02</span><h3>On your terms.</h3><p>Review every point. Keep your reports. Export your own collection.</p></div><div><span>03</span><h3>Simply yours.</h3><p>No account. No subscription. No photograph uploads.</p></div></div></div><span className="private-watermark" aria-hidden="true">e.</span></section>

    <section className="collection-editorial"><div className="section-running-head" data-reveal><span>04 / YOUR COLLECTION</span><Link href="/progress">ALL DOSSIERS ({String(scans.length).padStart(2,"0")}) ↗</Link></div><div className="collection-composition" data-reveal><div><p className="section-label">A STUDY WORTH KEEPING</p><h2>Your face.<br/>Your <em>point of view.</em></h2><p>A considered report. The freedom to refine it.<br/>A collection that evolves with you.</p><Link href={last ? `/results/${last.id}` : "/scan"} className="campaign-cta"><span>{last ? "Return to your dossier" : "Create your first dossier"}</span><i><Arrow diagonal/></i></Link></div><Link href={last ? `/results/${last.id}` : "/scan"} className="folio-object" aria-label={last ? "Open your latest saved dossier" : "Begin your first private dossier"}><div className="folio-shadow"/><div className="folio-sheet folio-sheet-back"><span>02 / IN PROFILE</span><img src={last?.side?.photo ?? PORTRAITS[1].src} alt="" width="1536" height="1024" loading="lazy"/></div><div className="folio-sheet folio-sheet-front"><div className="folio-sheet-head"><span>ElevaFace.</span><span>PERSONAL<br/>EDITION</span></div><img src={last?.photo ?? PORTRAITS[0].src} alt={last ? "Your latest saved portrait" : "Illustrative portrait on a sample dossier cover"} width="1536" height="1024" loading="lazy"/><div className="folio-sheet-foot"><span>THE SIGNATURE STUDY<small>{last ? `${front.available + side.available} MEASUREMENTS AVAILABLE` : "YOUR STORY, IN DETAIL"}</small></span><b>{String(scans.length || 1).padStart(2,"0")}</b></div></div><span className="folio-object-note">{last ? "YOUR LATEST STUDY" : "YOUR PRIVATE DOSSIER AWAITS"} <Arrow diagonal/></span></Link></div></section>

    <section className="appointment-editorial" data-reveal><span className="section-label">A MOMENT FOR YOURSELF</span><h2>Meet your <em>signature.</em></h2><Link href="/scan" className="appointment-link">Begin a private study <Arrow diagonal/></Link><p>A clear photograph. A little curiosity. Entirely free.</p></section>
  </main>;
}
