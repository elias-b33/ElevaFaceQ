"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadProfile, saveProfile, type Profile } from "@/lib/store";

export default function Welcome() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>({ onboarded: false, sex: "neutral" });
  const [error, setError] = useState("");
  useEffect(() => setProfile(loadProfile()), []);
  return <main className="prose-local"><header><p className="eyebrow">YOUR LOCAL PROFILE</p><h1>Make this workspace yours.</h1><p className="page-subtitle">No sign-up. These preferences are saved only in this browser.</p></header><section className="card flex flex-col gap-5"><div><h2>Choose a reference model</h2><p>Some ratios use different comparison bands. Neutral uses the union of both ranges. These settings describe the reference model you want to explore.</p></div><div className="grid grid-cols-3 gap-2">{(["masculine", "neutral", "feminine"] as const).map(sex => <button key={sex} onClick={() => setProfile({ ...profile, sex })} aria-pressed={profile.sex === sex} className={`card p-4 capitalize text-sm ${profile.sex === sex ? "border-gold/70 text-gold" : "text-ink-2"}`}>{sex}</button>)}</div><label className="text-sm text-ink-2 flex flex-col gap-2">What would you like to explore?<select value={profile.goal ?? "tracking"} onChange={event => setProfile({ ...profile, goal: event.target.value })} className="rounded-chip border border-line bg-surface-raised px-3 py-3"><option value="tracking">Track consistent measurements over time</option><option value="photos">Understand how I look in photos</option><option value="grooming">Explore my proportions and grooming</option></select></label><button className="primary-button self-start" onClick={() => { try { saveProfile({ ...profile, goal: profile.goal ?? "tracking", onboarded: true }); router.push("/"); } catch { setError("Your browser could not save these preferences. Check that local storage is enabled."); } }}>Save local profile →</button>{error && <p role="alert" className="text-danger text-sm">{error}</p>}</section><p>For useful comparisons, keep camera distance, head position and lighting consistent. The results describe photographed geometry under the selected reference model.</p></main>;
}
