"use client";

import { useEffect, useRef, useState } from "react";
import { loadProfile, loadScans, nukeAllData, saveProfile, type Profile } from "@/lib/store";
import { downloadBackup, restoreBackup } from "@/lib/backup";
import { AiSettings } from "@/components/AiSettings";
import { StudioArrow, StudioPageHeader } from "@/components/StudioPageHeader";

export default function SettingsPage() {
  const [profile,setProfile] = useState<Profile | null>(null);
  const [count,setCount] = useState(0);
  const [confirmDelete,setConfirmDelete] = useState(false);
  const [notice,setNotice] = useState("");
  const [error,setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {setProfile(loadProfile());setCount(loadScans().length);},[]);
  const reportError = (reason: unknown) => {setNotice("");setError(reason instanceof Error ? reason.message : "The operation could not finish.");};
  return <main className="studio-page settings-page">
    <StudioPageHeader section="Settings" title={<>Settings<span className="title-stop">.</span></>} description="Your rating preferences, backups and everything this browser keeps. Nothing here ever leaves your device."/>
    {!profile ? <p className="studio-loading" role="status">Loading your settings…</p> : <div className="workspace-layout">
      <aside className="workspace-index"><p className="studio-overline">ON THIS PAGE</p><nav aria-label="Settings sections">{[["rating","01","Rating"],["backups","02","Backups"],["local-ai","03","Local AI"],["data-controls","04","Your data"]].map(([id,n,label])=><a key={id} href={"#" + id}><span>{n}</span>{label}<StudioArrow/></a>)}</nav><div className="workspace-stamp"><span className="status-dot"/>SAVED ON THIS DEVICE<strong>{count}</strong><span>{count === 1 ? "rating" : "ratings"}</span></div></aside>
      <div className="workspace-sections">
        <section className="workspace-section" id="rating"><header><span>01</span><div><h2>Rate me as</h2><p>Pre-selects the ideal ranges and dimorphism scoring when you start a new rating. You can still change it on any report.</p></div></header><div className="workspace-section-body"><div className="studio-segmented" role="group" aria-label="Default rating gender">{(["male","female"] as const).map(g=><button key={g} aria-pressed={profile.gender === g} onClick={() => {const next={...profile,gender:g,sex:g === "male" ? "masculine" as const : "feminine" as const};try{saveProfile(next);setProfile(next);}catch(reason){reportError(reason);}}}>{g === "male" ? "Male" : "Female"}</button>)}</div></div></section>
        <section className="workspace-section" id="backups"><header><span>02</span><div><h2>Backups & restore</h2><p>Move your ratings to another browser or keep a copy before clearing site data.</p></div></header><div className="workspace-section-body"><div className="backup-summary"><strong>{count}</strong><div><span>{count === 1 ? "rating saved in this browser" : "ratings saved in this browser"}</span><p>One private file with your photos, landmarks and ratings.</p></div><span className="backup-format">JSON</span></div><div className="workspace-actions"><button className="primary-button" onClick={() => {try{downloadBackup();setError("");setNotice("Backup download started. Store it somewhere private.");}catch(reason){reportError(reason);}}}>Export backup <span>↓</span></button><button className="secondary-button" onClick={() => fileInput.current?.click()}>Restore a backup <span>↑</span></button></div><input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Restore a backup file" onChange={async event => {const file=event.target.files?.[0];event.target.value="";if(!file)return;try{if(file.size>20_000_000)throw new Error("Backup files must be smaller than 20 MB.");const added=restoreBackup(await file.text());setCount(loadScans().length);setProfile(loadProfile());setError("");setNotice("Restored " + added + (added === 1 ? " rating." : " ratings.") + " Existing ratings were kept.");}catch(reason){reportError(reason);}}}/><p className="studio-help">Restoring adds the backup’s ratings to the ones already here. Backups include your photos, so keep them somewhere private.</p></div></section>
        {notice && <p className="studio-notice" role="status">{notice}</p>}{error && <p className="studio-notice is-error" role="alert">{error}</p>}
        <section className="workspace-section" id="local-ai"><header><span>03</span><div><h2>Local AI assistance</h2><p>Optional. Uses an Ollama model running on your own computer; off by default.</p></div></header><div className="workspace-section-body ai-settings-interior"><AiSettings/></div></section>
        <section className="workspace-section workspace-danger" id="data-controls"><header><span>04</span><div><h2>Your data</h2><p>Delete every rating, photo and setting this app saved in this browser. Exported backups are not affected.</p></div></header><div className="workspace-section-body">{confirmDelete ? <div className="delete-confirmation"><p>This permanently removes {count} {count === 1 ? "rating" : "ratings"} and your settings from this browser.</p><div className="workspace-actions"><button onClick={() => {nukeAllData();window.location.href="/";}} className="secondary-button danger-button">Delete all local data</button><button onClick={() => setConfirmDelete(false)} className="secondary-button">Cancel</button></div></div> : <button onClick={() => setConfirmDelete(true)} className="studio-inline-link danger-link">Delete all local data<StudioArrow/></button>}</div></section>
      </div>
    </div>}
  </main>;
}
