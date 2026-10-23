"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProfileAttach } from "@/components/NewAnalysis";
function Profile() {
  const attach = useSearchParams().get("attach");
  if (!attach) return <main className="prose-local"><p className="eyebrow">THE SIDE PROFILE</p><h1>Start with a rating.</h1><p>A profile is added to an existing rating. Begin with your front photo.</p><Link className="primary-button" href="/scan">Rate my face →</Link></main>;
  return <ProfileAttach id={attach}/>;
}
export default function SidePage() { return <Suspense fallback={<p className="p-8">Opening your profile studio…</p>}><Profile/></Suspense>; }
