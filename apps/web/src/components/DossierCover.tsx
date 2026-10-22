import Link from 'next/link';
import { AREA_LABELS } from '@freeharmony/engine';
import type { StoredScan } from '@/lib/store';
import { AnatomyPlate } from './AnatomyPlate';

export function DossierCover({scan}:{scan:StoredScan}) {
  const accepted=scan.result.ok && scan.result.overall!==null;
  const diagnostic=!accepted ? scan.diagnostic : undefined;
  const score=accepted ? scan.result.overall : diagnostic?.provisionalOverall ?? null;
  const source=accepted ? scan.result : diagnostic;
  const omitted=diagnostic?.omittedAreas ?? [];
  const areas=source?.areas;
  return <section className="dossier-cover">
    <div className="dossier-photographs">
      <figure>{scan.photo ? <img src={scan.photo} alt="Front portrait in your personal dossier"/> : <AnatomyPlate/>}<figcaption><span>01 / EN FACE</span><span>THE FRONT STUDY</span></figcaption></figure>
      <figure>{scan.side?.photo ? <img src={scan.side.photo} alt="Side portrait in your personal dossier"/> : <Link className="add-profile-plate" href={'/scan/side?attach='+scan.id}><AnatomyPlate view="side"/><span>Add a profile photograph ↗</span></Link>}<figcaption><span>02 / IN PROFILE</span><span>{scan.side ? 'THE SECOND PERSPECTIVE' : 'COMPLETE YOUR STUDY'}</span></figcaption></figure>
    </div>
    <div className="dossier-signature">
      <span className="folio">THE MAPPED PORTRAIT</span><h2>Your signature.</h2>
      <div className="signature-score" aria-label={diagnostic ? 'Provisional harmony index' : 'Capture harmony index'}>
        <span className="folio">{diagnostic ? `PROVISIONAL ${omitted.length ? 'PARTIAL ' : ''}HARMONY INDEX` : 'CAPTURE HARMONY INDEX'}</span>
        <div>{score!==null ? <><strong>{score.toFixed(1)}</strong><span>/ 100</span></> : <strong className="score-pending">Withheld.</strong>}</div>
        <p>{source?.bandProfile ?? scan.result.bandProfile} profile · {source?.sex ?? scan.result.sex} bands</p>
        {diagnostic ? <>
          <p><b>Provisional calculation.</b> The photograph failed its pose check. {omitted.length>0 && `${omitted.map(a=>AREA_LABELS[a]).join(', ')} excluded for insufficient measurement confidence.`}</p>
          <p>The accepted score remains withheld. This estimate retains the original weights and confidence limits.</p>
        </> : <p>{accepted ? 'Photo checks passed. A reference-alignment index from the captured mesh.' : 'The photo checks or measurement coverage prevent a supported index. Your map is still available.'}</p>}
        <p>This is a local geometry index, not FaceIQ’s score scale. Landmark review updates the measurements; this index records the captured mesh.</p>
      </div>
      {areas && <div className="signature-strengths"><span className="folio">CONTRIBUTING AREAS / 100</span>{(Object.keys(AREA_LABELS) as (keyof typeof AREA_LABELS)[]).map(key=><div key={key}><span>{AREA_LABELS[key]}</span><strong>{areas[key].score===null ? 'Excluded' : areas[key].score}</strong></div>)}</div>}
      <a className="text-button" href="#measurement-inspector">Explore your animated map <span>↓</span></a>
    </div>
  </section>;
}
