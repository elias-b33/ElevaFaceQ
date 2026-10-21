"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { METRICS, analyzeHarmony } from "@freeharmony/engine";
import { deleteScan, loadScans, type StoredScan } from "@/lib/store";
import { HarmonyComparison } from "@/components/HarmonyComparison";
import { scanDocuments } from "@/lib/harmony";
import { AnatomyPlate } from "@/components/AnatomyPlate";
import { faceSquareCrop } from "@/lib/faceCrop";
import { StudioArrow, StudioPageHeader } from "@/components/StudioPageHeader";

export default function ProgressPage() {
  const [scans,setScans]=useState<StoredScan[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [leftId,setLeftId]=useState("");
  const [rightId,setRightId]=useState("");
  const [confirmId,setConfirmId]=useState<string | null>(null);
  const [error,setError]=useState("");
  useEffect(() => {const saved=loadScans();setScans(saved);setLeftId(saved[1]?.id ?? "");setRightId(saved[0]?.id ?? "");setLoaded(true);},[]);
  const left=scans.find(scan=>scan.id === leftId),right=scans.find(scan=>scan.id === rightId);
  const scored=[...scans].reverse().filter(scan=>scan.result.overall !== null);
  const date=(scan:StoredScan)=>new Date(scan.createdAt).toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"});
  const studyLabel=(scan:StoredScan)=>"Study " + String(scans.length-scans.indexOf(scan)).padStart(2,"0") + " · " + date(scan) + " · " + new Date(scan.createdAt).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
  return <main className="studio-page collection-studio">
    <StudioPageHeader section="Your collection" title={<>Your collection<span className="title-stop">.</span></>} description="The photographs, the details, the different perspectives. Your personal studies, kept together and ready to revisit." action={{href:"/scan",label:"Begin a new study"}}/>
    <div className="collection-toolbar"><span className="studio-overline">PERSONAL STUDIES / {String(scans.length).padStart(2,"0")}</span><span className="collection-private"><span className="status-dot"/>PRIVATE TO THIS BROWSER</span></div>
    {error && <p className="studio-notice is-error" role="alert">{error}</p>}
    {!loaded ? <p role="status" className="studio-loading">Opening your collection…</p> : !scans.length ? <section className="collection-empty-editorial"><div><span className="studio-overline">THE FIRST STUDY</span><h2>A fresh<br/>perspective awaits.</h2><p>Start with a front photograph. We’ll find the landmarks and bring your proportions into focus. Add a profile to complete the picture.</p><Link href="/scan" className="primary-button">Create your first study <span>↗</span></Link><span className="empty-collection-note">NO ACCOUNT. ENTIRELY ON YOUR DEVICE.</span></div><figure><img src="/images/campaign-profile.webp" alt="Original campaign portrait in profile" width="1536" height="1024"/><figcaption>THE PORTRAIT SERIES / IN PROFILE</figcaption></figure></section> : <div className="study-card-grid">{scans.map((scan,index)=><article className="study-card" key={scan.id}><Link className="study-card-image" href={"/results/" + scan.id} aria-label={"Open " + studyLabel(scan)}>{scan.photo ? <img src={scan.photo} style={{objectPosition:galleryPosition(scan)}} alt="Your saved front photograph"/> : <AnatomyPlate/>}<span className="study-card-number">N° {String(scans.length-index).padStart(2,"0")}</span><span className="study-card-open"><StudioArrow diagonal/></span></Link><div className="study-card-caption"><div><span className="studio-overline">{scan.side ? "FRONT & PROFILE" : "FRONT STUDY"}</span><h2><Link href={"/results/" + scan.id}>{date(scan)}</Link></h2></div><ScanCoverage scan={scan}/></div><div className="study-card-actions"><Link href={"/results/" + scan.id}>Open dossier <StudioArrow/></Link>{confirmId === scan.id ? <div className="study-delete-confirm"><button onClick={()=>{try{deleteScan(scan.id);const next=loadScans();setScans(next);setConfirmId(null);if(leftId === scan.id)setLeftId(next[1]?.id ?? next[0]?.id ?? "");if(rightId === scan.id)setRightId(next[0]?.id ?? "");}catch{setError("This analysis could not be deleted.");}}}>Confirm delete</button><button onClick={()=>setConfirmId(null)}>Cancel</button></div> : <button aria-label={"Delete " + studyLabel(scan)} onClick={()=>setConfirmId(scan.id)}>Remove</button>}</div></article>)}</div>}
    {scans.length >= 2 && <details className="collection-compare"><summary><div><span className="studio-overline">A CHANGE IN PERSPECTIVE</span><h2>Compare two studies</h2></div><span className="accordion-sign">+</span></summary><div className="comparison-content"><p className="studio-help">Choose photographs taken in similar conditions. Raw measurements are the most useful place to start.</p><div className="comparison-selects"><label>Earlier / reference<select value={leftId} onChange={e=>setLeftId(e.target.value)}>{scans.map(scan=><option key={scan.id} value={scan.id}>{studyLabel(scan)}</option>)}</select></label><label>Later / comparison<select value={rightId} onChange={e=>setRightId(e.target.value)}>{scans.map(scan=><option key={scan.id} value={scan.id}>{studyLabel(scan)}</option>)}</select></label></div>{left && right && <>{left.id === right.id && <p className="studio-help">You selected the same study twice.</p>}{(left.result.sex !== right.result.sex || left.result.engineVersion !== right.result.engineVersion || left.result.bandProfile !== right.result.bandProfile) && <p className="studio-help">The reference settings or engine version differ. Compare the raw measurements before scores.</p>}<HarmonyComparison left={left} right={right}/><details className="legacy-comparison"><summary>Original FreeHarmony metrics & score</summary><div className="comparison-scroll"><table className="comparison-table"><thead><tr><th>Measurement</th><th>Reference</th><th>Comparison</th><th>Change</th></tr></thead><tbody><tr><td>Harmony score</td><td>{left.result.overall?.toFixed(1) ?? "—"}</td><td>{right.result.overall?.toFixed(1) ?? "—"}</td><td>{delta(left.result.overall,right.result.overall)}</td></tr>{METRICS.map(metric=>{const a=left.result.metrics.find(item=>item.key === metric.key),b=right.result.metrics.find(item=>item.key === metric.key);if(!a&&!b)return null;const suffix=metric.unit === "deg" ? "°" : metric.unit === "pct" ? "%" : "";return <tr key={metric.key}><td>{metric.label}</td><td>{a?a.value.toFixed(2)+suffix:"—"}</td><td>{b?b.value.toFixed(2)+suffix:"—"}</td><td>{delta(a?.value ?? null,b?.value ?? null,2)}</td></tr>;})}</tbody></table></div></details></>}</div></details>}
    {scored.length >= 2 && <details className="collection-compare"><summary><div><span className="studio-overline">THE ORIGINAL INDEX</span><h2>Your study over time</h2></div><span className="accordion-sign">+</span></summary><div className="comparison-content"><Sparkline values={scored.map(scan=>scan.result.overall!)}/><p className="studio-help">The original FreeHarmony index changes with photo conditions and point placement. Compare consistent photographs.</p></div></details>}
  </main>;
}
function delta(a:number|null,b:number|null,decimals=1){if(a===null||b===null)return "—";const change=b-a;return (change>0?"+":"")+change.toFixed(decimals);}
function Sparkline({values}:{values:number[]}){const min=Math.min(...values)-2,max=Math.max(...values)+2;const points=values.map((value,index)=>(index/(values.length-1))*600+","+(85-((value-min)/(max-min))*75));return <svg viewBox="-5 0 610 95" className="collection-trend" role="img" aria-label="Harmony score trend"><path d="M0 85H600" stroke="#98533d20"/><polyline points={points.join(" ")} fill="none" stroke="#98533d" strokeWidth="2" strokeLinejoin="round"/>{points.map((point,index)=>{const[cx,cy]=point.split(",");return <circle key={index} cx={cx} cy={cy} r="3" fill="#98533d"/>;})}</svg>;}
function ScanCoverage({scan}:{scan:StoredScan}){const settings=scanDocuments(scan);const count=analyzeHarmony("front",settings.front,settings).available+analyzeHarmony("side",settings.side,settings).available;return <div className="study-card-coverage"><strong>{count}<small>/71</small></strong><span>measured</span></div>;}

function galleryPosition(scan:StoredScan):string {
  const aspect=scan.imageAspect ?? 1, frame=4/4.7;
  if(!scan.input?.landmarks.length || !(aspect>0))return "center";
  const crop=faceSquareCrop(scan.input.landmarks,aspect);
  const clamp=(v:number)=>Math.max(0,Math.min(1,v));
  if(aspect>frame){const visible=frame/aspect;return (clamp((crop.x+crop.w/2-visible/2)/(1-visible))*100)+"% center";}
  if(aspect<frame){const visible=aspect/frame;return "center "+(clamp((crop.y+crop.h/2-visible/2)/(1-visible))*100)+"%";}
  return "center";
}
