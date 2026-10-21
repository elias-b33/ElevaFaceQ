"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadProfile, loadScans, nukeAllData, saveProfile, type Profile } from "@/lib/store";
import { downloadBackup, restoreBackup } from "@/lib/backup";
import { AiSettings } from "@/components/AiSettings";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [count, setCount] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { setProfile(loadProfile()); setCount(loadScans().length); }, []);
  const reportError = (reason: unknown) => { setNotice(""); setError(reason instanceof Error ? reason.message : "The operation could not finish."); };
  if (!profile) return <main className="prose-local"><p>Loading local settings…</p></main>;
  return (
    <main className="prose-local">
      <header><p className="eyebrow">YOUR WORKSPACE</p><h1>Settings & backups</h1><p className="page-subtitle">Your profile and analyses stay in this browser. A backup is a file you control.</p></header>
      <section className="card flex flex-col gap-4"><p className="label-caps">Reference model</p><div className="grid grid-cols-3 gap-2">{(["masculine", "neutral", "feminine"] as const).map(sex => <button key={sex} aria-pressed={profile.sex === sex} onClick={() => { const next = { ...profile, sex }; try { saveProfile(next); setProfile(next); } catch (reason) { reportError(reason); } }} className={`card py-3 text-sm capitalize ${profile.sex === sex ? "border-gold/70 text-gold" : "text-ink-2"}`}>{sex}</button>)}</div><p className="text-xs text-ink-2">This selects comparison ranges for new scans. Existing reports retain the reference used when they were created.</p><Link href="/welcome" className="text-sm text-gold">Edit your local profile →</Link></section>
      <section className="card flex flex-col gap-4"><div><p className="label-caps">Back up your analyses</p><p className="mt-2 text-sm text-ink-2">{count} {count === 1 ? "analysis" : "analyses"} saved here. Export photos, measurements and landmark corrections as a JSON file. Restore merges scans without replacing existing copies.</p></div><div className="grid grid-cols-2 gap-3"><button className="primary-button" onClick={() => { try { downloadBackup(); setError(""); setNotice("Backup download started. Store it somewhere private."); } catch (reason) { reportError(reason); } }}>Export backup</button><button className="card text-sm text-ink-2" onClick={() => fileInput.current?.click()}>Restore backup</button></div><input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={async event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; try { if (file.size > 20_000_000) throw new Error("Backup files must be smaller than 20 MB."); const added = restoreBackup(await file.text()); setCount(loadScans().length); setProfile(loadProfile()); setError(""); setNotice(`Restored ${added} ${added === 1 ? "analysis" : "analyses"}. Existing scans were kept.`); } catch (reason) { reportError(reason); } }}/><p className="text-xs text-ink-3">Use the same browser and site address to reopen your history. The local installation and hosted domains have separate storage. Clearing site data or using another browser creates an empty workspace. Backups contain facial photos; choose where you save them.</p></section>
      {notice && <p className="text-sm text-gold" role="status">{notice}</p>}{error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <AiSettings/>
      <section className="card flex flex-col gap-4"><p className="label-caps">Local data controls</p><p className="text-sm text-ink-2">Deletion removes this app&apos;s data from this browser. Exported backups remain wherever you saved them.</p>{confirmDelete ? <div className="flex gap-3"><button onClick={() => { nukeAllData(); window.location.href = "/"; }} className="flex-1 rounded-chip bg-danger/15 text-danger py-3 text-sm">Delete all {count} analyses & settings</button><button onClick={() => setConfirmDelete(false)} className="card px-5 text-sm">Cancel</button></div> : <button onClick={() => setConfirmDelete(true)} className="self-start text-sm text-danger">Delete all local data…</button>}</section>
    </main>
  );
}
