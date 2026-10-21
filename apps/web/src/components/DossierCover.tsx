import Link from "next/link";
import type { StoredScan } from "@/lib/store";
import { AnatomyPlate } from "./AnatomyPlate";

export function DossierCover({ scan }: { scan: StoredScan }) {
  const score = scan.result.ok ? scan.result.overall : null;
  const strongest = [...scan.result.metrics].filter(m => m.confidence >= .55).sort((a,b) => b.score - a.score).slice(0, 3);
  return <section className="dossier-cover">
    <div className="dossier-photographs"><figure>{scan.photo ? <img src={scan.photo} alt="Front portrait in your personal dossier"/> : <AnatomyPlate/>}<figcaption>01 / EN FACE</figcaption></figure><figure>{scan.side?.photo ? <img src={scan.side.photo} alt="Side portrait in your personal dossier"/> : <Link className="add-profile-plate" href={`/scan/side?attach=${scan.id}`}><AnatomyPlate view="side"/><span>Add the second perspective ↗</span></Link>}<figcaption>02 / PROFIL</figcaption></figure><span className="dossier-photo-note">YOUR PRIVATE CONTACT SHEET</span></div>
    <div className="dossier-signature"><span className="folio">THE SIGNATURE STUDY</span><h2>A face with<br/>its own <em>story.</em></h2><div className="signature-score"><span className="folio">FRONT HARMONY INDEX</span><div>{score !== null ? <><strong>{(score / 10).toFixed(1)}</strong><span>/ 10</span></> : <strong className="score-pending">In study.</strong>}</div><p>{score !== null ? "FreeHarmony’s reference alignment score across the original front metrics. Photo-dependent; separate from the 71-measurement atlas." : "Your geometry draft is ready. A harmony index is available when the front photograph passes the photo checks."}</p></div>{strongest.length > 0 && <div className="signature-strengths"><span className="folio">YOUR STRONGEST REFERENCE ALIGNMENTS</span>{strongest.map(metric => <div key={metric.key}><span>{metric.label}</span><strong>{(metric.score / 10).toFixed(1)}<small> / 10</small></strong></div>)}</div>}<Link className="text-button" href={`/results/${scan.id}/classic`}>Explore the original score & methodology ↗</Link></div>
  </section>;
}
