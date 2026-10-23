"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Preferences now live in Settings; keep old links working. */
export default function Welcome() {
  const router = useRouter();
  useEffect(() => { router.replace("/settings"); }, [router]);
  return <main className="studio-page"><p className="studio-loading" role="status">Opening settings…</p></main>;
}
