"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { RatingReport } from "@/components/RatingReport";
import { getScan, type StoredScan } from "@/lib/store";

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [scan, setScan] = useState<StoredScan | null>();
  useEffect(() => { setScan(getScan(id) ?? null); }, [id]);
  if (scan === undefined) return <main className="report-page"><p role="status" className="page-subtitle">Opening your rating…</p></main>;
  if (scan === null) return <main className="prose-local"><h1>This rating is not in this browser.</h1><p>Open it in the browser where you saved it, restore a local backup, or start a new rating.</p><Link href="/scan" className="primary-button">New rating →</Link><Link href="/settings">Restore a backup</Link></main>;
  return <RatingReport key={scan.id} initial={scan}/>;
}
