# Local FaceIQ installation review

Review date: **2026-10-21**, Europe/Stockholm.

## Provenance and initial checks

- Source: `https://github.com/Blueturboguy07/freeharmony.git`.
- Pinned upstream revision: `fa54d317dfaf762d8abbaa70d752a5a1fa92f242`.
- Imported into the existing empty repository on branch `codex/local-faceiq`.
  The `upstream` remote and AGPL-3.0 license are retained. No code was pushed.
- Downloaded source was reviewed before dependency installation, including
  package manifests, lifecycle scripts, asset preparation and network paths.
- Microsoft Defender Antivirus and real-time protection were enabled; signatures
  were dated 2026-10-21. The initial custom scan of the source returned exit code
  0 and **found no threats**, before dependency installation.

## Dependency review before execution

The upstream lockfile audit reported **26 advisory entries**: 5 critical, 9 high,
10 moderate and 2 low. These are advisory counts, not 26 separate packages.
Findings included vulnerable Next.js, PostCSS, sharp and test-tool dependencies.
Raw upstream results: `.security/upstream-audit.json`.

Changes made before installing the application dependencies:

- Removed `@anthropic-ai/sdk` and subsequently removed the cloud provider code,
  API-key settings and UI.
- Updated Next.js to **16.4.2**, Vitest to **5.0.5** and Node type definitions to
  the Node 24 series.
- Pinned patched transitive dependencies: PostCSS 8.5.31, sharp 0.35.5,
  nanoid 3.3.18 in its version-3 dependency branch, source-map-js 1.2.2,
  tinypool 2.2.0 and Vite 8.3.5. Overrides are in `pnpm-workspace.yaml`.
- Regenerated and audited the lockfile without installing packages. That audit
  reported **zero known vulnerabilities** before the initial install.
- Installed with `pnpm install --frozen-lockfile --ignore-scripts`. Lifecycle
  scripts were disabled. pnpm's integrity and supply-chain checks passed.
- Scanned the installed tree with Defender before running the app/toolchain.
  It returned exit code 0 and **found no threats**.
- `pnpm audit signatures --json` verified **184 dependency entries**, with no
  invalid or missing signatures. See `.security/registry-signatures.json`.

## Model and runtime assets

The face model was downloaded from the official pinned Google model URL:

`https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`

SHA-256:
`64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`

The preparation script verifies this hash. The root launcher verifies it again
before starting the server. Model and WASM files are served locally from
`apps/web/public/mediapipe/`, which is ignored by Git. No model download is
triggered by normal application startup. Asset hashes are recorded in
`.security/local-assets.json`.

## Local-only controls

- Production and development launchers bind to `127.0.0.1:3000`.
- The root launcher sets `NEXT_TELEMETRY_DISABLED=1` and `DO_NOT_TRACK=1` for its
  child process. External Google fonts were removed.
- CSP restricts network connections to the app's origin and the two explicit
  local Ollama origins. Scripts, fonts, images, workers and media are restricted
  to local resources, required inline framework code and data/blob assets.
- The production CSP omits the development-only `unsafe-eval` permission.
  WebAssembly compilation and required Next.js inline scripts remain allowed.
- Camera access is scoped to the application origin. Microphone, geolocation
  and payment permissions are disabled.
- No cloud AI provider, API-key entry, analytics, subscription or payment path
  remains in the application. Optional AI is off by default. The provider checks
  origins, model tags and installed-model metadata, and rejects redirects.
- Browser backup import validates measurements, profile fields, scan identifiers
  and embedded photo data. Remote image URLs are rejected. Import does not
  replace existing scan IDs. Storage failure does not silently discard photos.

## Verification and limits

Final test, build and scan results are recorded in `.security/verification.json`.
Browser checks use a separate origin on port 3001 for synthetic backup/report
data, so QA does not seed or modify the normal workspace on port 3000. Tests cover backup
round-trips, invalid imports, quota failure, duplicate prevention, remote AI
blocking and profile aspect-ratio invariance, alongside the upstream suites.

The local model was initialized in the browser and an unsuitable public test
portrait was correctly rejected with photo-quality reasons. Synthetic reports
were used to verify restoration, comparison and the results explorer. No user
photo was accessed, and the user's camera was not activated. Actual measurement
quality on the user's own photo and optional Ollama execution are not established
by these checks.

No antivirus scan, signature check or package advisory database can prove that
software is free of all malicious code or future vulnerabilities. These results
describe the reviewed revision, dependency lockfile and scans at this date.
Source files or backups saved inside this OneDrive folder follow the existing
OneDrive sync settings; the app does not initiate cloud uploads.

## Complete measurement upgrade — 2026-10-22

The upgrade adds an independent geometry engine implementing all 71 current
public measurement definitions (36 front, 35 side), a named-landmark editor,
front/profile reports, a measurement library and local exports. The public
overview's 37+33 count differs from the detailed guide. Sources and explicit
local adaptations are attached to each catalogue entry; no private scoring data
or remote AI is used for these reports.

The final upgrade verification is recorded in
`.security/measurements-verification.json`: 140 tests passed across 12 files,
all workspace type checks passed and the production build completed. Desktop
and 390 × 844 mobile checks cover the editor, reports, custom ranges, measured
scale conversion, comparisons, filters, profile upload and exports. A mobile
table accessibility-label overflow found during QA was corrected and retested.

No packages, models, binaries, extensions or services were installed for this
upgrade. The dependency lockfile SHA-256 remains
`a8b54dcd4a0d9ffd379104133540fa3d95704b76e74531914511c3987d520197`.
The current audit reports zero known vulnerabilities at all severities; see
`.security/measurements-audit.json`. Microsoft Defender's custom scan of the
project returned exit code 0 and found no threats; see
`.security/defender-measurements.txt`. Real-time protection remains enabled.

The new engine never computes from unplaced template landmarks. Model points
are explicitly provisional until reviewed. Degenerate constructions return an
unavailable result, and measurements using the profile reference require the
ear and orbital landmarks. Ratios and angles use equal image units, with tested
aspect/roll/mirror invariance, including partial left-facing profiles. Distances
default to % of marked face height; millimeters require a supplied real scale.
Placement sensitivity is a deterministic ±2-pixel perturbation, not a clinical
error bound or a statistical confidence interval.

Version-2 backups validate named point keys, coordinate bounds, review/source
states, dimensions, calibration endpoints, custom range order and notes. They
remain compatible with version-1 imports and do not overwrite existing scan
IDs. Original reports and photos remain in the scan. Exported HTML escapes user
text, embeds only local image data, contains no script, and carries a restrictive
Content Security Policy. CSV exports contain catalogue labels and numeric values,
without user-supplied notes or spreadsheet formulas.

Regression tests now cover the complete catalogue and every formula's geometric
preconditions, all-view computability with known points, photo transforms,
signed lip distances, reflex convexity, real scale conversion, missing-data and
review states, sensitivity, backup compatibility and escaped report output.
Browser QA uses synthetic schematics on port 3001, separate from the user's
normal origin on port 3000. The user's camera and personal photos were not used.
The local face model rejects the schematic image, and the manual fallback keeps
that failed quality check visible rather than assigning an automatic score.

The expanded report uses editable working ranges, with no claim that a range
validates attractiveness or diagnoses anatomy. The original FreeHarmony score
is available in the classic view and is distinct from the 71-measurement report.


## Automatic landmarks and Private Atlas redesign — 2026-10-22

This upgrade uses the already installed @mediapipe/tasks-vision runtime. No new
npm package, Python package, executable, extension, background service or paid
API was installed. The package lockfile hash is unchanged. The new inference
asset is the pinned official Google SelfieMulticlass model (version 1, Apache-2.0,
16,371,837 bytes), SHA-256
c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0.
Its Google Storage MD5 also matched. The model and Instrument Serif font files
were downloaded into .security/quarantine, checked for the expected format and
source/license, then scanned with Microsoft Defender before being copied into
the application. See .security/automatic-model.json,
.security/editorial-fonts.json and .security/defender-auto-assets.txt.

Both vision models are verified by SHA-256 at local startup. Models, WASM,
fonts and illustrations are served from this installation. The new detector
has no external endpoint, telemetry or photo upload. Existing CSP restrictions,
loopback binding, disabled install scripts and optional Ollama restrictions
remain in place. Local fonts retain their complete SIL Open Font License.

Automatic drafts combine face-mesh coordinates, class-based skin/hair contours
and local RGB edge evidence. A lenient mesh attempt and head-crop retry improve
profile handling; silhouette-assisted placement works when no mesh is found.
Ear, orbit, jaw and corneal references are clearly marked estimates. Low-quality
suggestions and template points are excluded until confirmed. The review flow
never silently marks predictions reviewed, and reruns preserve manual/reviewed
positions and a measured scale. The harmony index uses the original saved
FreeHarmony score without score inflation; the detailed atlas is independent.

The full project custom scan returned Defender exit code 0 with no threats;
real-time protection remains enabled. See .security/defender-automatic-final.txt
and .security/automatic-defender-status.json. The dependency audit reports zero
known vulnerabilities at every severity (.security/automatic-audit.json).

Verification: 150 tests across 13 files, workspace type checks, production build,
local asset/startup checks and desktop/mobile browser QA. New regressions cover
blank and multiple-face masks, silhouette direction and mirrored geometry,
cropped necks, image-edge refinement, low-evidence exclusions, rerun correction
preservation and v1/v2/v3 backup compatibility. Browser QA used disposable public
research photos on port 3001; no personal camera or private user photos were
used. A front fixture suggested 51/53 points and 35/36 front measurements. Left-
and right-facing profile fixtures suggested 27/27 points and 35/35 provisional
profile measurements; internal references remained inferred. These are behavior
checks, not accuracy benchmarking or clinical validation. The complete v3 backup
exported and restored without duplicate analyses. Normal user storage on port
3000 was not seeded with test data.

Production visual checks use the local self-hosted font and artwork. The app
keeps all calculations and report content usable without a paid model or an
internet connection after setup. Third-party fixture images are excluded from
the product; their sources and license notes are in .security/qa/PROFILE_FIXTURES.txt.


## GitHub source and Vercel build preparation — 2026-10-22

The user authorized publishing this customized source to elias-b33/facelab.
Raw .security records, quarantined assets, QA photos/backups, downloaded research
faces, generated galleries, caches and local environment files are excluded from
Git and Vercel uploads. The original upstream history and AGPL-3.0 license remain.
The historical local-only review above records the installation as it stood at
that time; the hosted option now serves code/assets from Vercel while leaving
photo processing and saved reports in the visitor's browser.

The Vercel build uses Node 24, pinned pnpm 11.25.0 through Corepack, a frozen
lockfile and disabled install lifecycle scripts. It explicitly prepares both
SHA-256-pinned model files from official Google storage before Next.js builds.
Workspace file tracing includes the engine and advice packages. No packages,
cloud inference provider, API keys or database were added for deployment.

VERCEL=1 selects the hosted edition at build time. Its CSP omits localhost
service addresses, and client code disables optional Ollama access both in the
settings UI and at the request boundary. New tests verify that public origins
and hosted builds cannot issue a local-service/photo request, even with a stale
Ollama configuration. The local installation retains explicit opt-in Ollama.

The inherited paid cloud patch-agent workflow was removed. CI now has read-only
repository permissions, pinned official checkout/setup-node actions, a 15-minute
timeout and the same frozen install, type checks, tests and hosted build. The
new source validation passed 154 tests and all workspace type checks. Clean-
checkout build and GitHub push verification are recorded locally in .security.

## Campaign design update — 2026-10-22

The interface now includes two original generated portraits of fictional adults.
They are campaign artwork, not customer photographs or measurement results. The
homepage identifies its geometry preview as illustrative. Both images are stored
locally as WebP files (under 160 kB combined); their complete generation prompts
and provenance are tracked in apps/web/public/images/credits.json. No reference
brand's photographs, videos, logos or source code were copied into the product.

No package or remote runtime service was added. Animation uses CSS and the
browser's existing APIs, respects reduced motion, and includes a portrait pause
control. Defender's custom scan of the new image directory completed with no
threats found. The updated source passes the existing 154 tests and the Vercel
production build. Browser QA covers desktop/mobile navigation, portrait controls,
front and profile drafts, and report access using fictional test imagery on the
separate test origin; the user's localhost:3000 history was not seeded.

## Interior interface refinement — 2026-10-22

The working pages now share a scoped interior style system and accessible page
headers. The measurement library retains the full catalogue and every formula,
landmark list, caution, adaptation and source link, with indexed expansion and
front/profile/region/search controls. Collection framing uses existing face-crop
geometry only for display; stored photos and measurement coordinates are not
rewritten. Comparison choices include study numbers and capture times.

Backup validation/merging, local AI request restrictions, report exports, photo
checks and measurement computation remain on their existing code paths. The
data-deletion confirmation is retained. No dependency, model, font, external
image or runtime service was added. The campaign homepage source and stylesheet
were preserved. Browser checks use a separate local QA origin and fictional or
public test imagery; no test analysis was added to the user's normal origin.
