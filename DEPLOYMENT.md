# Deploy ElevaFaceQ to Vercel

Use [elias-b33/ElevaFaceQ](https://github.com/elias-b33/ElevaFaceQ) as the Git source. The web application lives in `apps/web`; its local workspace dependencies live in `packages/engine` and `packages/advice`. Vercel hosts the interface and static model files. Photo analysis runs in the visitor's browser.

## Import the repository

1. In Vercel, choose **Add New → Project** and import **elias-b33/ElevaFaceQ**. If the repository is absent, grant the Vercel GitHub integration access to this repository.
2. Set **Root Directory** to **apps/web** and enable **Include source files outside of the Root Directory in the Build Step**. This makes the workspace packages and root lockfile available.
3. Choose the **Next.js** preset, **main** as the production branch, and **Node.js 24.x**.
4. Add the build setting **ENABLE_EXPERIMENTAL_COREPACK=1** for Production and Preview. It is a public build flag, not a secret. Both package manifests pin **pnpm 11.25.0**.
5. Keep the commands from the tracked `apps/web/vercel.json` and deploy.

| Setting | Value |
| --- | --- |
| Git repository | `elias-b33/ElevaFaceQ` |
| Production branch | `main` |
| Root Directory | `apps/web` |
| Framework | Next.js |
| Node.js | `24.x` |
| Build environment | `ENABLE_EXPERIMENTAL_COREPACK=1` |
| Install command | `corepack pnpm install --frozen-lockfile --ignore-scripts` |
| Build command | `corepack pnpm run build && node scripts/verify-hosted-build.mjs` |
| Output directory | `.next` |

No application API keys, database or inference-provider account are required. The Git connection, root directory, outside-root access, production branch and Corepack environment flag are Vercel project settings; source files cannot update an existing project's settings by themselves. Redeploy after changing them. Vercel documents [Corepack activation](https://vercel.com/docs/builds/configure-a-build#corepack), [supported package managers](https://vercel.com/docs/package-managers), [shared monorepo source](https://vercel.com/docs/monorepos/monorepo-faq#can-i-share-source-files-between-projects-are-shared-packages-supported) and [Node.js selection](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## What the build verifies

The application build copies MediaPipe's WASM runtime from the frozen dependency installation, fetches missing Face Landmarker and SelfieMulticlass model files from Google's official storage, checks their pinned SHA-256 hashes and compiles Next.js. Generated model files stay out of Git and are reconstructed during a clean build. Fonts and campaign images are self-hosted application assets. Research photographs, local captures, backups and training data are excluded from the source deployment.

The final verification checks that Next.js produced a production build, the compiled hosted-edition flag is enabled, the hosted Content Security Policy excludes localhost services and development `unsafe-eval`, the model hashes match and WASM files are present. A failure stops CI or the Vercel deployment. `wasm-unsafe-eval` remains enabled because the in-browser vision runtime needs WebAssembly.

Dependency lifecycle scripts stay disabled during installation. Asset preparation is an explicit build step; starting an already prepared local installation performs no downloads. Both root `pnpm build` and the app's `pnpm build` use this portable build path. The explicit `pnpm build:offline` command retains the local build that requires models to have been prepared already.

## Reproduce the hosted build

From the repository root, with Node.js 24 and Corepack available:

```powershell
corepack pnpm install --frozen-lockfile --ignore-scripts
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build:vercel
corepack pnpm verify:hosted
```

`build:vercel` selects the hosted edition within its child process on Windows, macOS and Linux. It does not require changing the terminal's environment. The same checks run in `.github/workflows/ci.yml` for pushes to `main`, pull requests and manual workflow runs.

A successful local/CI build confirms source compatibility and packaged assets; the actual Vercel deployment must also succeed under the connected account. Do not infer that a public URL exists from a local build.

## If an import fails

| Build symptom | Check |
| --- | --- |
| Next.js cannot be detected, or the expected `.next` is missing | Root Directory must be `apps/web`, with the Next.js preset. Remove stale root-level build/output overrides. |
| Workspace package or `pnpm-lock.yaml` cannot be found | Enable outside-root source access; import the whole repository. |
| Wrong pnpm version or incompatible lockfile | Set `ENABLE_EXPERIMENTAL_COREPACK=1`; retain the tracked install command and exact `packageManager` fields. Do not substitute plain `pnpm install` as a custom command. |
| Frozen-lockfile failure | Commit matching manifest and lockfile changes; do not disable frozen installation to hide drift. |
| Model download or model integrity failure | Check the build's network access to the official Google Storage URLs. Retry a failed transfer; never bypass the hash check. |
| Hosted verification reports local mode | Build on Vercel or run `pnpm build:vercel` locally. A local `pnpm build` deliberately retains local-only controls. |

## Verify the deployed page

Open the deployment URL, begin a study and check a frontal report. Add a side photo to inspect the profile draft. Models must load from `/mediapipe/` on the deployment origin and fonts from `/fonts/`. No photo-upload request should occur. The hosted edition disables optional localhost Ollama controls and removes local service addresses from its Content Security Policy.

Save and reload an analysis in the same browser. Browser history belongs to an origin, so localhost, each Vercel preview hostname and the production domain have separate storage. Use **Settings → Export backup / Restore backup** to move your own saved work; those files are not part of deployment.

The application keeps the upstream FreeHarmony attribution and AGPL-3.0 license. Vercel's normal hosting and traffic limits apply. The hosted interface does not turn the local research rating pilot into a validated production attractiveness score.
