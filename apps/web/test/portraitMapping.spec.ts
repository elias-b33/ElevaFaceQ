import { describe, expect, it } from "vitest";
import { observedAnchor, observedFaceBounds, projectPortrait } from "../src/components/portrait-mapping-geometry";

describe("portrait mapping presentation geometry", () => {
  it("letterboxes the photo and uses one scale for both overlay axes", () => {
    const projection = projectPortrait(1200, 800, 400, 600, { x: 0, y: 0, width: 1, height: 1 })!;
    expect(projection.map({ x: 0, y: 0 }).x).toBe(0);
    expect(projection.map({ x: 0, y: 0 }).y).toBeCloseTo(600 / 2 - (800 / 3) / 2, 10);
    expect(projection.map({ x: .5, y: .5 })).toEqual({ x: 200, y: 300 });
    const a = projection.map({ x: .25, y: .25 }), b = projection.map({ x: .35, y: .4 });
    // These displacements each represent 120 source pixels, despite unequal normalized values.
    expect(b.x - a.x).toBeCloseTo(b.y - a.y, 10);
  });
  it("crops presentation without changing source point coordinates", () => {
    const projection = projectPortrait(1000, 2000, 300, 400, { x: .2, y: .25, width: .6, height: .5 })!;
    expect(projection.map({ x: .2, y: .25 })).toEqual({ x: 30, y: 0 });
    expect(projection.map({ x: .8, y: .75 })).toEqual({ x: 270, y: 400 });
    expect(projection.map({ x: .5, y: .5 })).toEqual({ x: 150, y: 200 });
  });
  it("does not manufacture anatomy or a crop from missing and degenerate points", () => {
    expect(observedAnchor({ x: .5, y: .3, source: "template", reviewed: true })).toBe(false);
    expect(observedAnchor({ x: .5, y: .3, source: "estimated", confidence: .99, reviewed: false })).toBe(false);
    expect(observedAnchor({ x: .5, y: .3, source: "mesh", confidence: NaN, reviewed: true })).toBe(false);
    expect(observedAnchor({ x: 1.1, y: .3, source: "manual", reviewed: true })).toBe(false);
    expect(observedAnchor({ x: .5, y: .3, source: "manual", reviewed: true })).toBe(true);
    expect(observedFaceBounds([{ x: .5, y: .5 }, { x: .5, y: .5 }, { x: .5, y: .5 }])).toBeNull();
    expect(observedFaceBounds([{ x: .1, y: .1 }, { x: .9, y: .9 }, { x: .5, y: .5 }])).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});
