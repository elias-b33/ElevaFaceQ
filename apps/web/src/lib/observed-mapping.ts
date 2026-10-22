import { seedDocument, type MeasurementDocument, type XY } from '@freeharmony/engine';

export const MAPPING_ENGINE = 'facelab-observed-mesh-1.0';

/** The portrait study's front-map contract: only detector-backed anchors. */
export function observedFrontDocument({mesh,width,height,at=0}: {
  mesh?: readonly XY[]; width:number; height:number; at?:number;
}): MeasurementDocument {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width<=0 || height<=0) {
    throw new Error('The photograph must have valid original dimensions.');
  }
  const valid = !!mesh && (mesh.length===468 || mesh.length===478)
    && mesh.every(p=>p && Number.isFinite(p.x) && Number.isFinite(p.y));
  const doc=seedDocument('front',width/height,valid ? mesh : undefined);
  doc.imageHeight=height;
  doc.updatedAt=at;
  for (const point of Object.values(doc.points)) {
    if (point.source==='mesh') {
      point.confidence=.85;
      point.evidence='Predicted face-mesh coordinate in the original photograph; not manually reviewed.';
    } else {
      point.source='template';
      point.reviewed=false;
      point.confidence=0;
      point.evidence='This detector does not establish this landmark. Place it manually before measuring.';
    }
  }
  const detected=Object.values(doc.points).filter(p=>p.source==='mesh').length;
  doc.automatic={engine:MAPPING_ENGINE,at,detected,estimated:0,
    missing:Object.keys(doc.points).length-detected,meshFound:valid,
    warnings:valid ? [
      'Hairline, ears, neck, eyelid hoods, lid creases and nasal bridge edges are unplaced. They are excluded until you place them.',
      'Landmarks are model predictions. The map preserves the photo perspective; pitch and yaw are not reconstructed.'
    ] : ['A valid front face mesh could not be found. Choose a clear photograph containing one face.']};
  return doc;
}
