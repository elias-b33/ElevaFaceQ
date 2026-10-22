import { afterEach, describe, expect, it, vi } from "vitest";
import { analyze, analyzeDiagnostic, METRICS, type ScanInput } from "../src/index";
import { REGION_SETS } from "../src/landmarks/indices";
import { canonicalInput, projectCanonical, rotXYZ, toColMajor16 } from "./helpers";

function posed(yaw = 0, pitch = 11, roll = 0): ScanInput {
  const rotation = rotXYZ(yaw, pitch, roll);
  return canonicalInput({ landmarks: projectCanonical(rotation), transformationMatrix: toColMajor16(rotation) });
}

afterEach(() => vi.restoreAllMocks());

describe("optional post-refusal diagnostics", () => {
  it("keeps accepted scans separate and does not produce a second score", () => {
    const input = canonicalInput({ bandProfile: "calibrated" });
    const accepted = analyze(input), before = JSON.stringify(accepted);
    expect(accepted.ok).toBe(true);
    expect(analyzeDiagnostic(input)).toBeNull();
    expect(JSON.stringify(analyze(input))).toBe(before);
  });

  it.each([[13, 0, 0, "yaw"], [0, 11, 0, "pitch"], [0, 0, 24, "roll"]] as const)(
    "labels a yaw=%s pitch=%s roll=%s refusal explicitly provisional",
    (yaw, pitch, roll, code) => {
      const input = { ...posed(yaw, pitch, roll), bandProfile: "calibrated" as const };
      const original = analyze(input), beforeInput = JSON.stringify(input);
      expect(original.ok).toBe(false);
      expect(original.overall).toBeNull();
      const diagnostic = analyzeDiagnostic(input)!;
      expect(diagnostic).not.toBeNull();
      expect(diagnostic).toMatchObject({ kind: "post-refusal-diagnostic", provisional: true, accepted: false, bandProfile: "calibrated", sex: "neutral" });
      expect(diagnostic.gates.pass).toBe(false);
      expect(diagnostic.gates.blocking.map(gate => gate.code)).toContain(code);
      expect(diagnostic.gates).toEqual(original.gates);
      expect(diagnostic.frame).toEqual(original.frame);
      expect(diagnostic.metrics.length).toBeGreaterThan(0);
      expect(diagnostic.metrics.every(metric => metric.percentile === null)).toBe(true);
      for (const field of ["overall", "overallPercentile", "standardized", "tier"]) expect(diagnostic).not.toHaveProperty(field);
      expect(analyze(input)).toEqual(original);
      expect(JSON.stringify(input)).toBe(beforeInput);
    },
  );

  it("retains all multiplier and regional caps and exposes an omitted area", () => {
    const input = posed();
    input.imageWidth = 512; input.imageHeight = 640;
    input.blendshapes = { jawOpen: .2 };
    // A synthetic localized mismatch invokes the existing regional confidence
    // cap. No image, person's landmarks, or target score is used by this test.
    for (const index of REGION_SETS.jaw) input.landmarks[index]!.x = .5 + (input.landmarks[index]!.x - .5) * 1.3;
    const original = analyze(input);
    expect(original.gates.blocking.map(gate => gate.code)).toEqual(["pitch"]);
    const diagnostic = analyzeDiagnostic(input)!;
    expect(diagnostic.gates.confidenceMultiplier).toBeCloseTo(.68, 10);
    expect(diagnostic.gates.regionConfidence.jaw).toBe(.35);
    expect(diagnostic.metrics.find(metric => metric.key === "jawToCheekbone")!.confidence).toBe(.35);
    expect(diagnostic.metrics.find(metric => metric.key === "chinToPhiltrum")!.confidence).toBeCloseTo(.68, 10);
    expect(diagnostic.metrics.find(metric => metric.key === "jawlineDefinition")!.confidence).toBeCloseTo(.34, 10);
    expect(diagnostic.areas.jawline.score).toBeNull();
    expect(diagnostic.areas.jawline.confidence).toBeLessThan(.5);
    expect(diagnostic.omittedAreas).toEqual(["jawline"]);
    expect(diagnostic.provisionalOverall).not.toBeNull();
    expect(original.metrics).toEqual([]);
    expect(original.overall).toBeNull();
  });

  it("preserves the unknown-pitch confidence cap when yaw is estimated from landmarks", () => {
    const input = posed(13, 0, 0);
    input.transformationMatrix = undefined;
    const diagnostic = analyzeDiagnostic(input)!;
    expect(diagnostic.frame.pitchDeg).toBeNull();
    expect(diagnostic.frame.poseSource).toBe("landmark-proxy");
    expect(diagnostic.metrics.find(metric => metric.key === "midfaceRatio")!.confidence).toBe(.55);
    expect(diagnostic.gates.blocking.map(gate => gate.code)).toContain("yaw");
  });

  it("keeps expected area coverage when computations are missing or nonfinite", () => {
    for (const definition of METRICS) {
      if (definition.area === "jawline") vi.spyOn(definition, "compute").mockReturnValue(null);
      if (definition.area === "eyeArea") vi.spyOn(definition, "compute").mockReturnValue({ value: NaN, confidence: 1 });
    }
    const diagnostic = analyzeDiagnostic(posed())!;
    expect(diagnostic.provisionalOverall).toBeNull();
    expect(diagnostic.omittedAreas).toEqual(["eyeArea", "jawline"]);
    expect(diagnostic.areas.eyeArea).toEqual({ score: null, confidence: 0 });
    expect(diagnostic.areas.jawline).toEqual({ score: null, confidence: 0 });
    expect(diagnostic.gates.warnings.some(gate => gate.code === "invalid-geometry")).toBe(true);
    expect(diagnostic.metrics.every(metric => Number.isFinite(metric.value) && Number.isFinite(metric.score))).toBe(true);
    expect(analyze(posed()).gates.warnings.some(gate => gate.code === "invalid-geometry")).toBe(false);
  });

  it.each(["expression", "eyes-closed", "face-too-small", "occlusion-jaw"])("does not bypass %s alongside a pose refusal", code => {
    const input = posed();
    if (code === "expression") input.blendshapes = { jawOpen: .6 };
    if (code === "eyes-closed") input.blendshapes = { eyeBlinkLeft: .8 };
    if (code === "face-too-small") { input.imageWidth = 128; input.imageHeight = 160; }
    if (code === "occlusion-jaw") for (const index of REGION_SETS.jaw) input.landmarks[index]!.x = .5 + (input.landmarks[index]!.x - .5) * 1.9;
    expect(analyze(input).gates.blocking.map(gate => gate.code)).toContain(code);
    expect(analyzeDiagnostic(input)).toBeNull();
  });

  it.each([128, 0])("does not bypass blur or exposure failure in a constant %s image", intensity => {
    const input = posed();
    const data = new Uint8ClampedArray(input.imageWidth * input.imageHeight * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = intensity; data[i + 1] = intensity; data[i + 2] = intensity; data[i + 3] = 255; }
    input.image = { data, width: input.imageWidth, height: input.imageHeight };
    const codes = analyze(input).gates.blocking.map(gate => gate.code);
    expect(codes).toContain("blur");
    if (intensity === 0) expect(codes).toContain("exposure");
    expect(analyzeDiagnostic(input)).toBeNull();
  });

  it.each(["topology", "landmark", "sparse-landmark", "out-of-frame", "override", "dimensions", "matrix", "blendshape", "image-buffer", "overflow"])(
    "rejects malformed %s input without offering a diagnostic",
    kind => {
      const input = posed();
      if (kind === "topology") input.landmarks = input.landmarks.slice(0, 467);
      if (kind === "landmark") input.landmarks[4]!.z = NaN;
      if (kind === "sparse-landmark") delete input.landmarks[4];
      if (kind === "out-of-frame") input.landmarks[4]!.x = 1.1;
      if (kind === "override") input.overrides = { 4: { x: Infinity, y: .5 } };
      if (kind === "dimensions") input.imageWidth = 0;
      if (kind === "matrix") input.transformationMatrix![0] = NaN;
      if (kind === "blendshape") input.blendshapes = { jawOpen: NaN };
      if (kind === "image-buffer") input.image = { width: input.imageWidth, height: input.imageHeight, data: new Uint8ClampedArray(4) };
      if (kind === "overflow") { input.imageWidth = Number.MAX_VALUE; input.imageHeight = Number.MAX_VALUE; }
      expect(analyzeDiagnostic(input)).toBeNull();
    },
  );

  it("returns byte-identical diagnostics on repeated calls", () => {
    const input = posed();
    expect(JSON.stringify(analyzeDiagnostic(input))).toBe(JSON.stringify(analyzeDiagnostic(input)));
  });
});
