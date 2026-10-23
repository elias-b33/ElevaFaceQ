import type { LandmarkDefinition, MeasurementDocument, NamedPoint, XY } from "./types";

function f(key: string, label: string, group: string, mesh: number | readonly number[] | undefined, x: number, y: number, hint: string, manual = false): LandmarkDefinition {
  return { key, label, group, mesh, view: "front", template: { x, y }, hint, manual };
}
function s(key: string, label: string, group: string, x: number, y: number, hint: string): LandmarkDefinition {
  return { key, label, group, view: "side", template: { x, y }, hint };
}
// Left and right in this editor mean IMAGE left/right. All coordinates remain
// on the original uncropped photo. Mesh suggestions always need human review.
export const FRONT_LANDMARKS: readonly LandmarkDefinition[] = [
  f("hairline", "Hairline center", "Outline", undefined, .5, .12, "Center of the visible hairline. Move hair away; leave unplaced if hidden."),
  f("templeL", "Left temple", "Outline", 127, .24, .3, "Widest visible temple on the image left."),
  f("templeR", "Right temple", "Outline", 356, .76, .3, "Widest visible temple on the image right."),
  f("cheekL", "Left cheekbone", "Outline", 234, .24, .48, "Visible maximum cheekbone width on the face outline, image left. Avoid the ear."),
  f("cheekR", "Right cheekbone", "Outline", 454, .76, .48, "Visible maximum cheekbone width on the face outline, image right."),
  f("jawSideL", "Left upper jaw side", "Jaw & neck", 172, .27, .65, "Upper jaw-angle width point where the cheek turns toward the jaw."),
  f("jawSideR", "Right upper jaw side", "Jaw & neck", 397, .73, .65, "Matching upper jaw-angle point on the right."),
  f("jawL", "Left lower jaw corner", "Jaw & neck", 136, .3, .72, "Lower edge of the jaw angle. Beard can hide this contour."),
  f("jawR", "Right lower jaw corner", "Jaw & neck", 365, .7, .72, "Lower edge of the jaw angle on the right."),
  f("chinBorderL", "Left chin border", "Jaw & neck", 150, .4, .82, "Straight lower-jaw border before it curves into the chin."),
  f("chinBorderR", "Right chin border", "Jaw & neck", 379, .6, .82, "Matching lower-jaw border on the right."),
  f("menton", "Chin bottom", "Jaw & neck", 152, .5, .87, "Lowest point of the soft-tissue chin."),
  f("earL", "Left outer ear", "Ears", undefined, .14, .54, "Farthest visible outer edge of the ear on the left."),
  f("earR", "Right outer ear", "Ears", undefined, .86, .54, "Farthest visible outer edge of the ear on the right."),
  f("neckL", "Left neck edge", "Jaw & neck", undefined, .32, .95, "Side of the neck just below the jaw, at the same level as the other point."),
  f("neckR", "Right neck edge", "Jaw & neck", undefined, .68, .95, "Matching right neck edge. Clothing should not obscure it."),
  f("pupilL", "Left pupil center", "Eyes", 468, .39, .4, "Center of the pupil/iris on the image left. Look straight at the camera."),
  f("pupilR", "Right pupil center", "Eyes", 473, .61, .4, "Center of the pupil/iris on the image right."),
  f("innerL", "Left inner eye corner", "Eyes", 133, .45, .41, "Inner canthus beside the nose."),
  f("innerR", "Right inner eye corner", "Eyes", 362, .55, .41, "Inner canthus beside the nose on the right."),
  f("outerL", "Left outer eye corner", "Eyes", 33, .31, .4, "The actual outer canthus, where the upper and lower lids meet."),
  f("outerR", "Right outer eye corner", "Eyes", 263, .69, .4, "Actual outer canthus on the right."),
  f("lidTopL", "Left upper lid margin", "Eyes", 159, .38, .385, "Highest visible lid-opening margin above the pupil."),
  f("lidBottomL", "Left lower lid margin", "Eyes", 145, .38, .425, "Lowest lid-opening margin under the pupil."),
  f("lidTopR", "Right upper lid margin", "Eyes", 386, .62, .385, "Highest visible lid-opening margin above the right pupil."),
  f("lidBottomR", "Right lower lid margin", "Eyes", 374, .62, .425, "Lowest lid-opening margin under the right pupil."),
  f("hoodL", "Left outer eyelid hood", "Eyes", 33, .29, .4, "Outer endpoint of the visible eyelid hood; different from the canthus. Check the suggested fold.", true),
  f("hoodR", "Right outer eyelid hood", "Eyes", 263, .71, .4, "Matching endpoint of the outer eyelid hood on the right.", true),
  f("creaseL", "Left upper lid crease", "Eyes", 159, .38, .37, "Visible crease directly above the upper lid margin. Leave unplaced if no crease is visible.", true),
  f("creaseR", "Right upper lid crease", "Eyes", 386, .62, .37, "Matching upper lid crease on the right.", true),
  f("browInnerL", "Left inner brow bottom", "Brows", 55, .44, .345, "Bottom of the inner brow, closest to the nose."),
  f("browInnerR", "Right inner brow bottom", "Brows", 285, .56, .345, "Bottom of the inner right brow."),
  f("browInnerTopL", "Left inner brow top", "Brows", 107, .44, .325, "Top edge of the same inner-brow segment."),
  f("browInnerTopR", "Right inner brow top", "Brows", 336, .56, .325, "Top edge of the inner right brow."),
  f("browArchL", "Left brow arch bottom", "Brows", 65, .37, .325, "Bottom edge of the brow arch, above the eye."),
  f("browArchR", "Right brow arch bottom", "Brows", 295, .63, .325, "Bottom edge of the right brow arch."),
  f("browPeakL", "Left brow arch top", "Brows", 66, .37, .3, "Top edge above the arch-bottom point."),
  f("browPeakR", "Right brow arch top", "Brows", 296, .63, .3, "Top edge above the right arch-bottom point."),
  f("browTailL", "Left brow tail", "Brows", 70, .29, .34, "Outermost end of the left brow."),
  f("browTailR", "Right brow tail", "Brows", 300, .71, .34, "Outermost end of the right brow."),
  f("nasalBase", "Nasal base", "Nose", 2, .5, .59, "Midline where the nose base joins the upper-lip skin (subnasale)."),
  f("noseBottom", "Nose underside midpoint", "Nose", 94, .5, .565, "Lowest central visible columella/underside point, distinct from subnasale."),
  f("alarL", "Left nasal wing", "Nose", 48, .44, .56, "Outermost edge of the left nasal wing."),
  f("alarR", "Right nasal wing", "Nose", 278, .56, .56, "Outermost edge of the right nasal wing."),
  f("bridgeL", "Left nose bridge edge", "Nose", 193, .475, .46, "Visible bridge edge at the same height as the right point; review manually.", true),
  f("bridgeR", "Right nose bridge edge", "Nose", 417, .525, .46, "Matching visible bridge edge; use a consistent level.", true),
  f("upperLip", "Cupid's bow center", "Mouth", 0, .5, .655, "Central dip of the upper vermilion border."),
  f("lipPeakL", "Left Cupid's bow peak", "Mouth", 37, .475, .648, "Top of the left Cupid's bow peak."),
  f("lipPeakR", "Right Cupid's bow peak", "Mouth", 267, .525, .648, "Top of the right Cupid's bow peak."),
  f("mouthSeam", "Mouth seam center", "Mouth", [13, 14], .5, .68, "Middle of the closed lip seam; lips relaxed, not pressed."),
  f("lowerLip", "Lower lip bottom", "Mouth", 17, .5, .715, "Lowest central edge of the lower vermilion."),
  f("mouthL", "Left mouth corner", "Mouth", 61, .39, .68, "Point where the lips meet on the left."),
  f("mouthR", "Right mouth corner", "Mouth", 291, .61, .68, "Point where the lips meet on the right."),
];
export const SIDE_LANDMARKS: readonly LandmarkDefinition[] = [
  s("porion", "Ear opening top · porion", "Level the profile", .29, .405, "Upper edge of the visible external ear opening. Together with orbitale this defines Frankfort horizontal."),
  s("orbitale", "Lower orbital rim · orbitale", "Level the profile", .615, .445, "Lowest visible soft-tissue reference over the lower orbital rim. A photo only approximates the bony landmark."),
  s("hairline", "Hairline center", "Forehead", .54, .13, "Profile intersection of the hairline with the forehead contour."),
  s("forehead", "Upper forehead contour", "Forehead", .615, .24, "A second forehead-contour point between hairline and brow; use the same level across photos."),
  s("glabella", "Brow prominence · glabella", "Forehead", .64, .32, "Most forward forehead point at brow level."),
  s("nasion", "Nasal root · nasion", "Nose", .62, .38, "Deepest dip at the forehead-to-nose transition."),
  s("supratip", "Nose contour above tip", "Nose", .71, .45, "Dorsal contour just above the tip. Keep it separate from the root and tip."),
  s("pronasale", "Nose tip · pronasale", "Nose", .76, .49, "Most projecting point of the nose."),
  s("infratip", "Nose contour below tip", "Nose", .74, .515, "Contour immediately below the nose tip."),
  s("columella", "Columella tangent point", "Nose", .70, .53, "Point on the underside of the columella defining its tangent to subnasale."),
  s("subnasale", "Nose base · subnasale", "Nose", .66, .55, "Junction of the columella and upper-lip skin."),
  s("subalare", "Nasal wing base · subalare", "Nose", .61, .52, "Point where the visible nasal wing meets the cheek."),
  s("cornea", "Front of eye · corneal apex", "Eye & midface", .67, .405, "Most forward point of the visible corneal surface."),
  s("lowerEyelid", "Lower eyelid contour", "Eye & midface", .65, .43, "Visible lower-lid landmark under the eye, separate from orbitale."),
  s("lateralCanthus", "Lateral eyelid endpoint", "Eye & midface", .59, .41, "Outer endpoint of the visible eyelid opening."),
  s("tragus", "Tragus", "Ear & jaw", .29, .48, "Prominent cartilage immediately in front of the ear opening."),
  s("earNotch", "Ear notch / jaw-side start", "Ear & jaw", .3, .46, "Visible notch by the ear defining the ascending jaw-side line."),
  s("gonionUpper", "Upper jaw-side tangent", "Ear & jaw", .32, .63, "Point on the straight ascending back border of the jaw. Ear-notch–point defines the ramus tangent."),
  s("gonionLower", "Lower jaw-border tangent", "Ear & jaw", .34, .74, "Point on the straight lower mandibular border. This point to menton defines the lower tangent."),
  s("upperLip", "Upper lip front", "Lips & chin", .68, .595, "Most forward point of the relaxed upper vermilion."),
  s("lowerLip", "Lower lip front", "Lips & chin", .68, .64, "Most forward point of the relaxed lower vermilion."),
  s("mouthCorner", "Visible mouth corner", "Lips & chin", .60, .625, "Where the lips meet at the visible corner."),
  s("sublabiale", "Lip–chin fold · sublabiale", "Lips & chin", .62, .69, "Deepest point of the fold between lower lip and chin."),
  s("pogonion", "Chin front · pogonion", "Lips & chin", .66, .74, "Most forward point of the soft-tissue chin."),
  s("menton", "Chin bottom · menton", "Lips & chin", .61, .79, "Lowest point of the soft-tissue chin, at the end of the lower jaw tangent."),
  s("cervical", "Under-chin / neck junction", "Neck", .47, .88, "Deepest transition where the under-chin contour turns into the front of the neck."),
  s("neck", "Front neck contour", "Neck", .43, .97, "Point further down the front of the neck defining its tangent."),
];
export function seedDocument(view: "front" | "side", aspect: number, mesh?: readonly XY[], overrides?: Record<number, XY>): MeasurementDocument {
  const points: Record<string, NamedPoint> = {};
  for (const def of view === "front" ? FRONT_LANDMARKS : SIDE_LANDMARKS) {
    const indices = typeof def.mesh === "number" ? [def.mesh] : def.mesh;
    const coords = indices?.map(i => overrides?.[i] ?? mesh?.[i]);
    const valid = coords?.length && coords.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
    const position = valid ? { x: coords.reduce((sum, p) => sum + p!.x, 0) / coords.length, y: coords.reduce((sum, p) => sum + p!.y, 0) / coords.length } : def.template;
    const corrected = valid && indices?.some(i => overrides?.[i]);
    points[def.key] = { ...position, source: corrected ? "manual" : valid && !def.manual ? "mesh" : "template", reviewed: !!corrected };
  }
  return { points, aspect, imageHeight: 768 / Math.max(1, aspect), updatedAt: 0 };
}
