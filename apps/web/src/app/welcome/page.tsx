"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadProfile, saveProfile, type Profile } from "@/lib/store";
import { StudioPageHeader } from "@/components/StudioPageHeader";

export default function Welcome() {
  const router=useRouter();
  const [profile,setProfile]=useState<Profile>({onboarded:false,sex:"neutral"});
  const [error,setError]=useState("");
  useEffect(()=>setProfile(loadProfile()),[]);
  return <main className="studio-page preferences-page"><StudioPageHeader section="Your preferences" title={<>Your preferences<span className="title-stop">.</span></>} description="Choose the perspective you want to explore. These preferences stay in this browser and can be changed whenever you like."/><div className="preferences-layout"><aside><span className="studio-overline">A PERSONAL STARTING POINT</span><h2>Your face.<br/>Your perspective.</h2><p>A reference model gives the numbers context. Your photographs and the points you review make the study your own.</p><span className="preferences-note"><span className="status-dot"/>NO SIGN-UP REQUIRED</span></aside><div className="preferences-form"><section><span className="studio-overline">01 / THE REFERENCE</span><h2>Choose a reference model</h2><p>Neutral uses the combined comparison ranges. Existing studies keep the reference used when they were created.</p><div className="studio-segmented" role="group" aria-label="Reference model">{(["masculine","neutral","feminine"] as const).map(sex=><button key={sex} onClick={()=>setProfile({...profile,sex})} aria-pressed={profile.sex === sex}>{sex}<span aria-hidden="true">{profile.sex === sex ? "✓" : ""}</span></button>)}</div></section><section><span className="studio-overline">02 / YOUR FOCUS</span><h2>What brings you here?</h2><label className="studio-field">Your focus<select value={profile.goal ?? "tracking"} onChange={e=>setProfile({...profile,goal:e.target.value})}><option value="tracking">Track consistent measurements over time</option><option value="photos">Understand how I look in photos</option><option value="grooming">Explore my proportions and grooming</option></select></label></section><div className="preferences-save"><button className="primary-button" onClick={()=>{try{saveProfile({...profile,goal:profile.goal ?? "tracking",onboarded:true});router.push("/");}catch{setError("Your browser could not save these preferences. Check that local storage is enabled.");}}}>Save my preferences <span>↗</span></button><p>Saved only in this browser.</p></div>{error && <p role="alert" className="studio-notice is-error">{error}</p>}</div></div></main>;
}
