# Deploy ElevaFace to Vercel

Use [elias-b33/ElevaFaceQ](https://github.com/elias-b33/ElevaFaceQ) as the Git source. The web application lives in `apps/web`; its local workspace dependencies live in `packages/engine` and `packages/advice`. Vercel hosts the interface and static model files. Photo analysis runs in the visitor's browser.

## Import the repository

1. In Vercel, choose **Add New → Project** and import **elias-b33/ElevaFaceQ**. If the repository is absent, grant the Vercel GitHub integration access to this repository.
2. Leave **Root Directory** blank, at the repository root. The workspace packages and root lockfile are then available without additional directory settings.
3. Use **main** as the production branch and **Node.js 24.x**.
4. Deploy with the tracked root `vercel.json`. It explicitly selects **Next.js**, installs with the pinned **pnpm 11.25.0**, builds the hosted edition and selects **apps/web/.next**. Its framework, build, install and output settings override stale project values such as the **Other** preset and **public** output directory.

| Setting | Value |
| --- | --- |
| Git repository | `elias-b33/ElevaFaceQ` |
| Production branch | `main` |
| Root Directory | Repository root (blank) |
| Framework | Next.js |
| Node.js | `24.x` |
| Install command | `corepack pnpm install --frozen-lockfile --ignore-scripts` |
| Build command | `corepack pnpm run build:vercel && corepack pnpm run verify:hosted` |
| Output directory | `apps/web/.next` |

No application API keys, database or inference-provider account are required. The install command invokes Corepack explicitly, so it does not rely on Vercel's automatic package-manager selection. The Git connection, root directory and production branch remain account settings; source files cannot change those. Vercel documents [configuration overrides](https://vercel.com/docs/project-configuration/vercel-json), [supported package managers](https://vercel.com/docs/package-managers) and [Node.js selection](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Projects already configured with **Root Directory apps/web** remain supported. Enable **Include source files outside of the Root Directory in the Build Step** and retain that folder's `vercel.json`: it builds from the app directory and uses `.next`. Both entrypoints deploy the same application. Do not put `rootDirectory` into `vercel.json`; select it in the project settings when needed.

The root package declares the same pinned Next.js and React versions as `apps/web` so Vercel can detect Next.js from either entrypoint. Keep these versions aligned. Static models, fonts and images remain in `apps/web/public`; the Next.js builder finds them beside the configured build output. Do not create an empty root `public` folder, which would take precedence over those assets.

## What the build verifies

The application build copies MediaPipe's WASM runtime from the frozen dependency installation, fetches missing Face Landmarker, SelfieMulticlass and Pose Landmarker Lite model files from Google's official storage, checks their pinned SHA-256 hashes and compiles Next.js. Generated model files stay out of Git and are reconstructed during a clean build. Fonts and campaign images are self-hosted application assets. Research photographs, local captures, backups and training data are excluded from the source deployment.

The final verification checks that both deployment entrypoints select Next.js and the correct output directory, and resolve the pinned Next.js version. It also checks that Next.js produced a production build, the compiled hosted-edition flag is enabled, the hosted Content Security Policy excludes localhost services and development `unsafe-eval`, the model hashes match and WASM files are present. A failure stops CI or the Vercel deployment. `wasm-unsafe-eval` remains enabled because the in-browser vision runtime needs WebAssembly.

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
| `STATIC_BUILD_NO_OUT_DIR` mentions `public` | Redeploy the latest `main` commit containing the root `vercel.json`. It selects Next.js and `apps/web/.next` for a repository-root import. Do not solve this by publishing `.next` as static files. |
| Next.js cannot be detected, or the expected `.next` is missing | Use either the repository root with the root config or `apps/web` with the app config. Keep the root and app Next.js dependencies aligned and install the frozen lockfile. |
| Workspace package or `pnpm-lock.yaml` cannot be found | Enable outside-root source access; import the whole repository. |
| Wrong pnpm version or incompatible lockfile | Retain the tracked explicit `corepack pnpm` install command and exact `packageManager` fields. For a project using Vercel's automatic install command instead, enable `ENABLE_EXPERIMENTAL_COREPACK=1`. |
| Frozen-lockfile failure | Commit matching manifest and lockfile changes; do not disable frozen installation to hide drift. |
| Model download or model integrity failure | Check the build's network access to the official Google Storage URLs. Retry a failed transfer; never bypass the hash check. |
| Hosted verification reports local mode | Build on Vercel or run `pnpm build:vercel` locally. A local `pnpm build` deliberately retains local-only controls. |

## Verify the deployed page

Open the deployment URL, choose **Rate my face**, add a front photo and a side profile, and check that the rating report opens with all four pillars scored. Models must load from `/mediapipe/` on the deployment origin and fonts from `/fonts/`. No photo-upload request should occur. The hosted edition disables optional localhost Ollama controls and removes local service addresses from its Content Security Policy.

Save and reload an analysis in the same browser. Browser history belongs to an origin, so localhost, each Vercel preview hostname and the production domain have separate storage. Use **Settings → Export backup / Restore backup** to move your own saved work; those files are not part of deployment.

The application keeps the upstream FreeHarmony attribution and AGPL-3.0 license. Vercel's normal hosting and traffic limits apply. The rating's calibration, accuracy and limits are described in the [README](README.md#how-the-rating-works); hosting it does not make it a validated measure of attractiveness.
