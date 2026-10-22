# ElevaFaceQ web app

See the [project README](../../README.md) for local startup, backups, development
and the security review. Run development and production commands from the root
so telemetry opt-out, model verification and loopback binding are applied.

For Vercel, use this folder (`apps/web`) as the project Root Directory; see
[DEPLOYMENT.md](../../DEPLOYMENT.md). Enable outside-root workspace access and
the Vercel build setting `ENABLE_EXPERIMENTAL_COREPACK=1`. The app's `build`
command prepares pinned vision assets and then builds Next.js. The tracked
Vercel command verifies the resulting hosted flag, CSP and model files.
No application secrets are required.

The application is a Next.js App Router client interface. Measurement code lives
in `packages/engine`; rule-based explanations live in `packages/advice`.
