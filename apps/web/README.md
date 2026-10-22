# ElevaFace web app

See the [project README](../../README.md) for local startup, backups, development
and the security review. Run development and production commands from the root
so telemetry opt-out, model verification and loopback binding are applied.

For Vercel, import the repository root; its `vercel.json` selects Next.js and
this app's build output. Existing projects rooted at `apps/web` also work with
outside-root workspace access enabled; see [DEPLOYMENT.md](../../DEPLOYMENT.md).
The app's `build` command prepares pinned vision assets and then builds Next.js.
The tracked Vercel command verifies both deployment entrypoints, the resulting
hosted flag, CSP and model files.
No application secrets are required.

The application is a Next.js App Router client interface. Measurement code lives
in `packages/engine`; rule-based explanations live in `packages/advice`.
