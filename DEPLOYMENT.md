# Deploy FaceIQ to Vercel

The app is ready to import from [elias-b33/facelab](https://github.com/elias-b33/facelab).
Vercel serves the application and its model files. Face landmark inference,
measurement, photos, history and reports stay in each visitor's browser.
No API key, database, account system or paid inference provider is required.

## Import settings

1. In Vercel, choose **Add New → Project** and import **elias-b33/facelab**.
2. Set **Root Directory** to **apps/web**. Keep **Include source files outside of
   the Root Directory** enabled so the engine/advice workspace packages are available.
3. Keep the **Next.js** preset and deploy the **main** branch. No application secrets
   or environment variables need to be supplied.

The tracked `apps/web/vercel.json` provides these commands automatically:

| Setting | Value |
| --- | --- |
| Node.js | 24.x (declared in package.json) |
| Package manager | pnpm 11.25.0, selected through Corepack |
| Install command | corepack pnpm install --frozen-lockfile --ignore-scripts |
| Build command | corepack pnpm run build |
| Output directory | .next |

Corepack uses the exact pnpm version declared in package.json. Install lifecycle
scripts stay disabled; the build explicitly prepares the reviewed vision assets.
Do not choose the repository root as the Next.js project root. The root-level
`pnpm build` is the offline local-installation build; Vercel uses the app's own build.

## What the build does

- Copies MediaPipe WASM from the locked installed dependency.
- Fetches missing Face Landmarker and SelfieMulticlass model files from Google's
  official storage, checking their pinned SHA-256 values before saving them.
- Compiles Next.js with the workspace engine/advice source included in file tracing.
- Includes self-hosted Instrument Serif fonts and original SVG artwork.
- Disables application build telemetry and selects the hosted edition automatically
  when Vercel sets VERCEL=1.

The generated `public/mediapipe/` folder is intentionally ignored by Git. It is
reconstructed on a fresh Vercel build, so a clean checkout contains everything
needed to build without committing duplicate binaries. No models are fetched from
a third-party CDN during a visitor's analysis; the deployed assets use the same origin.

## Hosted privacy and storage

The hosted edition disables the optional localhost Ollama feature and omits local
service addresses from its Content Security Policy. Automatic face detection and
all geometry remain available in the browser. The local installation retains its
optional local Ollama controls.

History belongs to a specific browser and origin. The localhost installation,
Vercel preview URLs and the production domain each have separate browser storage.
Use **Settings → Export backup / Restore backup** to move your own analyses.
Neither GitHub nor Vercel receives those backups as part of this source deployment.

The repository excludes local research face downloads, generated galleries, QA
photos, backups, machine-specific security logs, dependency folders and build output.
The source keeps the original FreeHarmony history and AGPL-3.0 license.

Vercel hosts the page and serves static assets; its normal hosting/traffic limits
apply. The application does not charge for inference or require a paid service.

## Reproduce the deployment build locally

From the repository root, with Node 24 and pnpm 11.25.0 installed:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm typecheck
$env:VERCEL = '1'
pnpm build:vercel
Remove-Item Env:VERCEL
```

This build may download the two pinned model assets if absent. Use a disposable
checkout if you want to keep the normal localhost production build untouched.

## Verify after deployment

Open the generated Vercel URL, choose a photo, and check the front report. Add a
side photo to test the profile draft. Models should load from `/mediapipe/` on your
own deployment, fonts from `/fonts/`, and no photo-upload request should occur.
Saved reports should survive a page reload in the same browser.

Reference: [Vercel monorepos](https://vercel.com/docs/monorepos),
[Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
[package managers](https://vercel.com/docs/package-managers), and
[project configuration](https://vercel.com/docs/project-configuration/vercel-json).
