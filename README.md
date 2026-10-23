# ElevaFace

**Elevate your face.**

A private face rating app. Add a front photo and a side profile and get a
rating out of 10 in the style of FaceIQ Labs: Harmony, Angularity, Dimorphism
and Features pillars, your percentile and rarity, strengths and flaws ranked by
their effect on your score, and your potential. Everything runs in your browser.
Based on [FreeHarmony](https://github.com/Blueturboguy07/freeharmony).
No account, subscription, paid API, photo upload or hosted deployment is needed.

## Deploy your hosted version

The source is configured for Vercel. Import **elias-b33/ElevaFaceQ** and leave
**Root Directory** at the repository root. The root `vercel.json` selects
Next.js, builds the hosted edition and uses `apps/web/.next` as its output.
Projects already rooted at `apps/web` remain supported by that folder's config.
No application API keys or database are required.
See [DEPLOYMENT.md](DEPLOYMENT.md) for the exact settings and verification steps.
Photos and measurements still run in each visitor's browser. Browser histories
are separate for localhost, Vercel previews and your production domain.

## Open the app

Double-click **Start ElevaFace.cmd** in this folder. Keep its console window
open, then visit **http://127.0.0.1:3000** in your browser. Press Ctrl+C in the
console to stop it. The server binds to the loopback address, so it is not
exposed to other devices on your network. On a fresh clone, complete the
installation and build steps below first.

Use the same browser and the exact same address to keep your history together.
`localhost:3000`, `127.0.0.1:3000` and another browser have separate browser storage.

## What is included

- **A guided rating in three steps.** Choose the gender you are rated against,
  add a front photo, then a side profile facing either way. Upload a file or use
  the camera with a countdown. Each photo takes about 2–3 seconds to map on a
  laptop CPU.
- **Automatic landmarks on both views.** The front uses MediaPipe's 478-point
  face mesh, with hair/skin/clothing segmentation for the hairline, face outline,
  ears and neck. The profile is traced from the segmented silhouette: glabella,
  nasion, nose, lips, chin, under-chin and neck come from the outline. The eye,
  ear and orbital references are estimated with help from a lightweight pose
  model, and they count for less until you review them.
- **The rating report.** It shows an overall score with its label, percentile,
  rarity and potential, plus the four pillar scores. Strengths and flaws are
  ranked by how far each one moves your overall score. All 66 scored Harmony
  measurements show your value, the ideal range for your gender and a score. The
  Angularity, Dimorphism and Features assessments (25 for men, 24 for women)
  each have a reading.
- **Landmark fine-tuning with a live rating.** Move any point and the rating
  updates as you go. Saved changes update the report. Formulas, construction
  overlays, placement sensitivity and the full 71-measurement library remain
  available, with a guided editor for 53 front and 27 side landmarks.
- **Your ratings.** Every rating stays in this browser, with a trend across
  ratings. Version-4 JSON backups include photos, landmarks, the rated gender and
  the photo measurements. Older backups and scans still open.
- The Private Atlas campaign site with restrained motion, keyboard navigation
  and support for the reduced-motion preference. CSV/JSON exports, a
  self-contained offline HTML report and Print / PDF through the browser.
- The original 18 frontal metrics and the classic FreeHarmony results remain
  available for studies that have them.
- Optional local Ollama integration, off by default. No cloud AI integration.

## How the rating works

- **The scale.** Scores run from 0 to 10, and 5 is the reference population's
  average. The scale is percentile-based and symmetric around 5: a 6 is about
  the top 29%, a 7 about 1 in 18 people, an 8 about 1 in 250, and a 3 is as rare
  as a 7.
- **Harmony** scores the 66 measurements in FaceIQ Labs' public Harmony guide:
  33 front and 33 side. Each measurement scores 10 inside a gender-specific
  ideal range. Outside it, the score falls smoothly with distance, measured in
  population standard deviations. Each measurement is weighted by its
  importance and by how directly its landmarks were observed. The front counts
  for 60% and the profile for 40%.
- **Angularity, Dimorphism and Features** combine geometry with in-photo
  comparisons, each standardised against the reference population for your
  gender. The comparisons cover skin texture and evenness, under-eye darkness,
  sclera, creasing, brow and lip contrast, facial hair (men only), hair length,
  temple recession, cheek and jaw shading, and symmetry.
- **Overall** is a power mean of the four pillars, with exponent 0.1, so the
  weakest pillar weighs most. **Potential** is your overall score with your five
  largest flaws at their ideal. Each flaw shows what reaching its ideal would
  add to your score. Each strength shows what you would lose if it were only
  typical.
- **Calibration and accuracy.** The population constants were fitted by running
  this app's own pipeline on the Face Research Lab London Set (DeBruine & Jones
  2017, CC BY 4.0): 102 adults, each with a neutral front photo and both
  profiles. On those faces, the overall score's Spearman correlation with mean
  human attractiveness ratings is +0.49 for men and +0.50 for women, measured
  within each sex (Harmony: +0.44 and +0.59). A person's left- and right-profile
  ratings correlate at r = 0.93. These figures come from the same people the
  constants were fitted to, so treat them as optimistic.
  [calibration/rating](calibration/rating/README.md) explains how to reproduce
  or recalibrate them.

The rating describes photographed geometry and appearance. Lens distance,
lighting, expression and head angle change it, so compare photos taken the same
way. Ideal ranges follow public facial-aesthetics conventions, adjusted on the
reference set. They are not validated beauty thresholds or clinical targets.
FaceIQ Labs' proprietary weights, reference corpus and AI are not reproduced,
and this project is not affiliated with FaceIQ Labs.

The [public definition index](https://www.faceiqlabs.com/support/harmony),
checked on 22 October 2026, contains 71 guides: 33 front and 33 side definitions
used in their Harmony score, plus five supporting definitions (36 front, 35 side
in total). All 71 are implemented in `packages/engine/src/harmony/`; the rating
is in `packages/engine/src/rating/`.

The numerical audit and its limits are documented in [MATH_AUDIT.md](MATH_AUDIT.md).
Every definition has an independent numerical fixture. Seeded transformation
tests check all values under translation, scaling, rotation, mirroring of a
profile and changes in image aspect. Missing leveling points, invalid angles
and insufficient score coverage produce explicit missing/invalid results.

## Get your rating

1. Choose **Rate my face**, pick the gender you want to be rated against and
   continue.
2. Add a front photo. Face the camera with a neutral expression and even light,
   with your hair off your forehead and ears if possible. The landmarks appear on
   the photo once it is mapped.
3. Add a side profile. Turn 90° and keep your head level, with the whole face,
   ear, chin and neck visible against a plain background. Either direction works.
   You can skip this step and rate the front alone; the rating is then marked
   incomplete.
4. Open your rating. Use **Adjust landmarks** to correct any point; the live
   rating follows your edits, and saving updates the report. Estimated points
   (the profile's ear, orbital rim and eye) count for less until you review them.
5. Switch **Male / Female** on the report to rate against the other gender's
   ideals. **Print / PDF** creates a local PDF. Complete photo backups are in
   Settings.

Millimeter distances require a real known distance in the same image plane.
Without it, `% FH` means a percentage of marked vertical hairline-to-chin height.
A reviewed landmark is a user's placement confirmation, not a clinical
validation. The sensitivity envelope moves one coordinate at a time and is not
a statistical confidence interval or a bound on all photo error.

## Local data and privacy

Photos, measurements and corrections are stored in browser localStorage. The app
does not save scans into the project directory or send them to an external
service. Clearing browser site data removes that browser's history.

Use **Settings & backups → Export backup** before clearing browser data or moving
to another browser. Restore merges new scan IDs and keeps existing scans. The
backup includes the core photos, profile, geometry and corrections; optional AI
annotations and AI caches are excluded. Storage errors preserve existing photos
and ask you to export/delete manually. History currently allows up to 40 scans;
the browser's quota may be reached earlier.

This project is inside your OneDrive folder. Source files and exported backups
saved there may sync under your existing OneDrive settings. Save sensitive
backups in a location you choose. The app itself does not initiate cloud sync.

## Development

Node.js 24 and pnpm 11 were used for this setup. From this folder:

```powershell
pnpm dev            # http://127.0.0.1:3000, with live code changes
pnpm test           # engine, advice and application regression tests
pnpm typecheck
pnpm build          # prepare pinned assets, then build the local edition
pnpm build:offline  # build using already prepared assets, without downloads
pnpm build:vercel   # reproduce the hosted edition on any supported OS
pnpm verify:hosted  # check the hosted build and packaged model assets
pnpm start          # serve the production build on loopback
pnpm security:audit
```

The root launcher disables Next.js telemetry in its child process. There are no
external fonts, analytics, payment SDKs or cloud inference SDKs. The browser's
Content Security Policy blocks external resource and API origins. Optional AI
requests are limited to `localhost:11434` or `127.0.0.1:11434`, reject redirects,
and reject cloud tags and Ollama entries marked as remote models.

Ollama is **not installed or started by this app**. If you already run it, enable
it in Settings, select installed local models and use Check local connection.
Photo requests occur only when you explicitly choose an AI report/check.

## Reinstalling or moving the project

Initial installation requires internet access for packages and the three public
vision models. Regular use after setup requires no internet connection.

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm setup:assets
pnpm security:audit
pnpm build
pnpm start
```

The reviewed asset setup copies MediaPipe's installed WASM files and downloads
the pinned version-1 Face Landmarker, SelfieMulticlass and Pose Landmarker Lite
models from Google's official storage only if missing. Their SHA-256 hashes are checked before use. Starting the app never downloads anything.
The workspace configuration disables install lifecycle scripts and enables
package-store integrity checking; `.npmrc` also retains these settings for older
pnpm versions. Review and scan new dependencies before changing the lockfile.

## Security review and attribution

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for the upstream revision, scans,
dependency updates, integrity checks, verification and limits. Machine-specific raw audit results
are kept locally in the ignored `.security/` folder. Microsoft Defender is not bundled with the app.

Based on FreeHarmony by Blueturboguy07, upstream revision
`fa54d317dfaf762d8abbaa70d752a5a1fa92f242`, retrieved on 2026-10-21. Original
license: **AGPL-3.0**, retained in [LICENSE](LICENSE). This is a modified personal
fork, with the original Git history and upstream remote preserved. It is not
affiliated with FaceIQ Labs.


## Automatic vision assets and typography

The contour model is Google MediaPipe SelfieMulticlass 256×256 float32, version 1
(Apache-2.0; 16.4 MB). It predicts background, hair, body skin, face skin, clothing
and accessories, and supplies a draft contour rather than bony anatomy. The
[official model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf)
and [Image Segmenter documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter)
describe its intended use and limitations.

SHA-256: c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0.
The original 3.8 MB Face Landmarker model remains unchanged.

Profile photos also use MediaPipe Pose Landmarker Lite, float16 version 1
(Apache-2.0; 5.8 MB), to locate the eye, ear and mouth before the silhouette is
traced. SHA-256: 59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a.
All three models run on the CPU, as in the calibration. Their hashes are
verified by the local launcher, which downloads nothing during startup.

Instrument Serif Regular and Italic come from Google's official fonts repository,
under the SIL Open Font License. The complete license is retained at
apps/web/public/fonts/OFL.txt. Exact source URLs and hashes are recorded in
.security/editorial-fonts.json. Models and fonts were quarantined and scanned
with Microsoft Defender before they were copied into the application. There
were no package installs or lockfile changes for this upgrade.
