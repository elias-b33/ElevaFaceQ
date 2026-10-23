import { describe, expect, it } from "vitest";
import { analyzeHarmony, automaticLandmarks, mergeAutomaticDocument, seedDocument, SIDE_LANDMARKS, type SegmentationPlane } from "../src/index";
import { canonicalInput } from "./helpers";

/** A continuous labelled profile, independent of the placement implementation. */
function silhouette(mirror = false, neck = true): SegmentationPlane {
  const width = 256, height = 256, categories = new Uint8Array(width * height);
  const outline = [[.10,.51],[.24,.57],[.31,.60],[.37,.56],[.48,.72],[.55,.56],[.60,.62],[.63,.56],[.67,.61],[.71,.54],[.77,.62],[.81,.53]];
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1), n = outline.findIndex(p => p[0]! >= v);
    if (n > 0) {
      const [ya,xa] = outline[n-1]!, [yb,xb] = outline[n]!;
      const edge = xa! + (xb! - xa!) * (v - ya!) / (yb! - ya!);
      for (let x = Math.round(width * .24); x <= Math.round((width-1)*edge); x++) categories[y * width + (mirror ? width - 1 - x : x)] = 3;
    }
    if (neck && v > .81 && v < .96) for (let x = Math.round(width*.30); x < width*.47; x++) categories[y*width+(mirror?width-1-x:x)] = 2;
  }
  return { width, height, categories };
}
describe("local automatic landmark drafts", () => {
  it("does not turn an empty photo or a missing front mesh into measurements", () => {
    for (const view of ["front", "side"] as const) {
      const doc = automaticLandmarks({view,aspect:1,imageHeight:768,segmentation:{width:32,height:32,categories:new Uint8Array(1024)}});
      expect(doc.automatic?.detected).toBe(0);
      expect(Object.values(doc.points).every(p => p.source === "template")).toBe(true);
      expect(analyzeHarmony(view,doc).available).toBe(0);
    }
  });
  it("traces the visible profile without claiming internal ear and orbital anatomy was detected", () => {
    const doc = automaticLandmarks({view:"side",aspect:1,imageHeight:768,segmentation:silhouette(),at:42});
    expect(doc.points.pronasale!.source).toBe("contour");
    expect(doc.points.pronasale!.x).toBeGreaterThan(.68);
    expect(doc.points.pronasale!.y).toBeCloseTo(.48,1);
    expect(doc.points.nasion!.y).toBeLessThan(doc.points.pronasale!.y);
    expect(doc.points.upperLip!.y).toBeLessThan(doc.points.lowerLip!.y);
    expect(doc.points.porion!.source).toBe("estimated");
    expect(doc.points.orbitale!.source).toBe("estimated");
    expect(doc.automatic).toMatchObject({at:42,meshFound:false,facing:"right"});
    expect(Object.values(doc.points).every(p => !p.reviewed)).toBe(true);
    expect(doc.automatic!.warnings.join(" ")).toContain("Ear opening, orbital rim and eye references are estimated");
    expect(Object.values(doc.points).filter(p => p.source !== "template").length).toBeGreaterThan(20);
  });
  it("places left-facing and right-facing silhouettes symmetrically, including reference orientation", () => {
    const right=automaticLandmarks({view:"side",aspect:.8,imageHeight:768,segmentation:silhouette()});
    const left=automaticLandmarks({view:"side",aspect:.8,imageHeight:768,segmentation:silhouette(true)});
    expect(left.automatic?.facing).toBe("left");
    for(const def of SIDE_LANDMARKS) {
      const a=right.points[def.key]!,b=left.points[def.key]!;
      expect(a.source).toBe(b.source);
      if(a.source!=="template") { expect(a.x+b.x).toBeCloseTo(1,6); expect(a.y).toBeCloseTo(b.y,6); }
    }
    const a=analyzeHarmony("side",right),b=analyzeHarmony("side",left);
    for(let i=0;i<a.measurements.length;i++) expect(a.measurements[i]!.value).toBeCloseTo(b.measurements[i]!.value!,6);
  });
  it("leaves a cropped neck unplaced instead of fabricating an angle", () => {
    const doc=automaticLandmarks({view:"side",aspect:1,imageHeight:768,segmentation:silhouette(false,false)});
    expect(doc.points.neck!.source).toBe("template");
    expect(doc.points.cervical!.source).toBe("template");
    expect(doc.automatic!.warnings.join(" ")).toContain("neck contour is cropped");
  });
  it("refines a coarse segmentation edge toward visible image evidence", () => {
    const actual=silhouette(),coarse={...actual,categories:new Uint8Array(actual.categories.length)};
    const data=new Uint8Array(actual.width*actual.height*4);
    for(let y=0;y<actual.height;y++)for(let x=0;x<actual.width;x++) {
      const i=y*actual.width+x;
      if(actual.categories[i]===3) for(let d=0;d<=5;d++)if(x+d<actual.width)coarse.categories[i+d]=3;
      const shade=actual.categories[i]===3?100:225;data.set([shade,shade,shade,255],i*4);
    }
    const raw=automaticLandmarks({view:"side",aspect:1,imageHeight:256,segmentation:coarse});
    const refined=automaticLandmarks({view:"side",aspect:1,imageHeight:256,segmentation:coarse,pixels:{width:256,height:256,data}});
    const truth=automaticLandmarks({view:"side",aspect:1,imageHeight:256,segmentation:actual});
    expect(Math.abs(refined.points.pronasale!.x-truth.points.pronasale!.x)).toBeLessThan(Math.abs(raw.points.pronasale!.x-truth.points.pronasale!.x));
  });
  it("excludes faint crease estimates until a user confirms the position", () => {
    const doc=automaticLandmarks({view:"front",aspect:.8,imageHeight:768,mesh:canonicalInput().landmarks});
    expect(doc.points.creaseL).toMatchObject({source:"estimated",reviewed:false,confidence:.24});
    const before=analyzeHarmony("front",doc).measurements.find(m=>m.missing.includes("creaseL"));
    expect(before).toBeDefined();
    expect(before!.value).toBeNull();
    doc.points.creaseL!.reviewed=true;doc.points.creaseR!.reviewed=true;
    expect(analyzeHarmony("front",doc).measurements.find(m=>m.key===before!.key)!.value).not.toBeNull();
  });
  it("retains manual corrections, confirmed suggestions and calibration on a fresh detection", () => {
    const existing=seedDocument("front",.8,canonicalInput().landmarks);
    existing.points.hairline={x:.48,y:.12,source:"manual",reviewed:true};
    existing.points.pupilL={x:.35,y:.41,source:"mesh",reviewed:true};
    existing.calibration={from:"pupilL",to:"pupilR",millimeters:63};
    const automatic=automaticLandmarks({view:"front",aspect:.8,imageHeight:768,mesh:canonicalInput().landmarks});
    const merged=mergeAutomaticDocument(existing,automatic);
    expect(merged.points.hairline).toEqual(existing.points.hairline);
    expect(merged.points.pupilL).toEqual(existing.points.pupilL);
    expect(merged.calibration).toEqual(existing.calibration);
    expect(merged.automatic).toEqual(automatic.automatic);
    expect(merged.points.menton!.confidence).toBe(.85);
  });
  it("rejects separated large face regions and corrupted mask dimensions", () => {
    const categories=new Uint8Array(10000);
    for(let y=15;y<75;y++)for(let x=10;x<30;x++){categories[y*100+x]=3;categories[y*100+x+55]=3;}
    const multiple=automaticLandmarks({view:"side",aspect:1,imageHeight:768,segmentation:{width:100,height:100,categories}});
    expect(multiple.automatic!.warnings.join(" ")).toContain("More than one face");
    expect(multiple.automatic!.detected).toBe(0);
    const invalid=automaticLandmarks({view:"side",aspect:1,imageHeight:768,segmentation:{width:100,height:100,categories:new Uint8Array(80)}});
    expect(analyzeHarmony("side",invalid).available).toBe(0);
  });
});
