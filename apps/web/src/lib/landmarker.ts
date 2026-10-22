"use client";

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let instance: Promise<FaceLandmarker> | null = null;

type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

function createLandmarker(fileset: Fileset) {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: "/mediapipe/face_landmarker.task",
      delegate: "CPU",
    },
    runningMode: "IMAGE",
    // 2 so we can DETECT a second face and refuse, rather than silently
    // scoring whichever face the model liked more.
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
  });
}

/**
 * Lazy singleton FaceLandmarker. WASM + model are served from our own origin
 * (see scripts/prepare-assets.mjs) — no third-party requests at runtime.
 *
 * Still-photo studies use the CPU delegate, matching the saved mapping pilot.
 * Selecting GPU by device changed the predicted geometry and therefore the
 * score. Keep one inference path instead of silently changing it by hardware.
 * Browser image decoding/runtime versions can still introduce small differences.
 */
export function getLandmarker(): Promise<FaceLandmarker> {
  if (!instance) {
    instance = (async () => {
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      return await createLandmarker(fileset);
    })().catch((err) => {
      instance = null; // allow retry (e.g. transient fetch failure, offline)
      throw err;
    });
  }
  return instance;
}
