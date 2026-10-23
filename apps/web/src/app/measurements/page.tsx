"use client";

import { useRef, useState } from "react";
import { FRONT_LANDMARKS, HARMONY_CATALOG, IDEALS_BY_KEY, REFERENCE_NOTE, SIDE_LANDMARKS, idealRange } from "@freeharmony/engine";
import { formatRange } from "@/lib/rating";
import { StudioArrow, StudioPageHeader } from "@/components/StudioPageHeader";
import { AnatomyPlate } from "@/components/AnatomyPlate";

export default function MeasurementLibrary() {
  const regionNav=useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("front");
  const [group, setGroup] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(HARMONY_CATALOG[0]?.key ?? null);
  const selectedView = HARMONY_CATALOG.filter(d => view === "all" || d.view === view);
  const groups = [...new Set(selectedView.map(d => d.group))];
  const visible = selectedView.filter(d => (group === "all" || d.group === group) && (d.label + " " + d.formula + " " + d.explanation).toLowerCase().includes(query.toLowerCase()));
  const regions = groups.filter(region => visible.some(d => d.group === region));
  return <main className="studio-page atlas-library">
    <StudioPageHeader section="Measurements" title={<>Measurements<span className="title-stop">.</span></>} description="All 71 measurements behind your rating: what each one captures, how it is calculated, the landmarks it uses and the ideal range for men and women." action={{href:"/scan",label:"Rate my face"}}/>
    <div className="library-toolbar"><div className="studio-view-control" role="group" aria-label="Definition view">{[["front","Front","36"],["side","Profile","35"],["all","All","71"]].map(([value,label,count]) => <button key={value} aria-pressed={view === value} onClick={() => { setView(value); setGroup("all"); setExpanded(null); regionNav.current?.scrollTo({left:0,behavior:"auto"}); }}><span>{label}</span><sup>{count}</sup></button>)}</div><label className="library-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.3"/></svg><input type="search" aria-label="Search measurement definitions" placeholder="Find a measurement" value={query} onChange={e => { setQuery(e.target.value); setExpanded(null); }}/>{query && <button onClick={() => setQuery("")} aria-label="Clear measurement search">×</button>}</label></div>
    <div className="library-layout">
      <aside className="library-index"><div className="library-index-inner"><p className="studio-overline">REGIONS</p><nav ref={regionNav} aria-label="Measurement regions"><button aria-pressed={group === "all"} onClick={() => { setGroup("all"); setExpanded(null); }}><span>All regions</span><span>{selectedView.length}</span></button>{groups.map(region => <button key={region} aria-pressed={group === region} onClick={() => { setGroup(region); setExpanded(null); }}><span>{region}</span><span>{selectedView.filter(d => d.group === region).length}</span></button>)}</nav><div className="library-study-plate"><AnatomyPlate view={view === "side" ? "side" : "front"}/><span>{view === "side" ? "Profile" : "Front"}</span></div><p className="library-index-note">Every landmark can be adjusted from your report.</p></div></aside>
      <div className="library-entries"><div className="library-result-line"><span>{view === "front" ? "FRONT VIEW" : view === "side" ? "PROFILE VIEW" : "FRONT AND PROFILE"}</span><span role="status">{visible.length} {visible.length === 1 ? "measurement" : "measurements"}</span></div>
        {regions.map((region,regionIndex) => <section className="definition-section" key={region} aria-label={region}><header><span>{String(regionIndex + 1).padStart(2,"0")}</span><h2>{region}</h2></header>{visible.filter(def => def.group === region).map(def => {
          const points = def.view === "front" ? FRONT_LANDMARKS : SIDE_LANDMARKS;
          const open = expanded === def.key;
          return <article className={"definition-entry" + (open ? " is-open" : "")} key={def.key}><h3><button onClick={() => setExpanded(open ? null : def.key)} aria-expanded={open} aria-controls={"definition-" + def.key}><span className="definition-number">{String(HARMONY_CATALOG.indexOf(def) + 1).padStart(2,"0")}</span><span className="definition-title">{def.label}</span><span className="definition-view">{def.supporting ? "SUPPORTING" : def.view === "front" ? "FRONT" : "PROFILE"}</span><span className="definition-toggle" aria-hidden="true">{open ? "−" : "+"}</span></button></h3>{open && <div className="definition-detail" id={"definition-" + def.key}><div className="definition-reading"><p>{def.explanation}</p><div className="definition-equation"><span className="studio-overline">THE CALCULATION</span><p>{def.formula}</p></div>{def.supporting && <span className="supporting-label">Supporting measurement</span>}<a href={def.source} target="_blank" rel="noreferrer" className="studio-inline-link">Read the source definition<StudioArrow diagonal/></a></div><div className="definition-landmarks">{IDEALS_BY_KEY.get(def.key) && <div className="definition-ideals"><p className="studio-overline">IDEAL RANGE</p><dl>{(["male","female"] as const).map(g => <div key={g}><dt>{g === "male" ? "Men" : "Women"}</dt><dd>{formatRange(idealRange(IDEALS_BY_KEY.get(def.key)!, g), def.unit === "distance" ? "% FH" : def.unit === "deg" ? "°" : def.unit === "ratio" ? "×" : "%")}</dd></div>)}</dl></div>}<p className="studio-overline">LANDMARKS USED</p><ul>{def.required.map(key => <li key={key}>{points.find(p => p.key === key)?.label ?? key}</li>)}</ul><details><summary>Measurement notes <span>+</span></summary><p>{def.caution}</p>{def.adaptation && <p>Local construction: {def.adaptation}</p>}</details></div></div>}</article>;
        })}</section>)}
        {!visible.length && <div className="studio-empty-search"><span>NO MATCHES</span><h2>Nothing found.</h2><p>Try another word, region or view.</p><button className="studio-inline-link" onClick={() => {setQuery("");setGroup("all");}}>Clear search & filters <StudioArrow/></button></div>}
        <details className="library-method"><summary>About these measurements <span>+</span></summary><p>{REFERENCE_NOTE}</p><p>36 front and 35 profile measurements, following FaceIQ Labs’ public definitions. 66 are scored in Harmony; five are supporting measurements shown for context.</p></details>
      </div>
    </div>
  </main>;
}
