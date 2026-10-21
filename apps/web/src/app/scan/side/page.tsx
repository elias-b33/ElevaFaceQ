"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PhotoCapture } from "@/components/PhotoCapture";
function Profile() { return <PhotoCapture view="side" attach={useSearchParams().get("attach")}/>; }
export default function SidePage() { return <Suspense fallback={<p className="p-8">Opening your profile studio…</p>}><Profile/></Suspense>; }
