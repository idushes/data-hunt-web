# AGENTS.md

Guidance for coding agents working in this repository.

## Project Scope

- This is the frontend web app for Data Hunt.
- The stack is Next.js App Router, React, TypeScript, Tailwind CSS, and ESLint.
- Keep changes narrowly scoped. Do not make major product, architecture, API, UX, or business-logic changes without explicit user confirmation.

## Repository Layout

- `app/` contains App Router routes, layouts, API routes, and global CSS.
- `components/` contains reusable UI components organized by feature area.
- `components/landing/` owns the landing page sections and animations.
- `components/auth/` owns authentication UI.
- `public/` stores static images, icons, and favicon assets.
- `openapi.json` is the local API contract snapshot.

## Development Commands

- Install dependencies with `npm install`.
- Run the dev server with `npm run dev`.
- Build production output with `npm run build`.
- Run linting with `npm run lint`.

## Deployment

- This app is hosted on Vercel under team/project `lisateam/data-hunt-web`.
- Vercel project dashboard: `https://vercel.com/lisateam/data-hunt-web`.
- The production frontend domain is `https://crypto.lisacorp.com/`.
- The production backend API domain is `https://hunt.data.lisacorp.com`.
- This repository does not currently include a checked-in Dockerfile, `vercel.json`, Kubernetes manifest, or CI deployment workflow.
- Keep the default Vercel Next.js build flow unless the user explicitly approves platform-specific configuration changes.
- Validate production readiness with `npm run build` before deploying or before pushing changes expected to deploy.
- Configure `NEXT_PUBLIC_API_URL=https://hunt.data.lisacorp.com` in the Vercel project environment variables so browser-side requests target the deployed backend API instead of the local fallback.
- Deployment is meant to be automatic: pushing to `main` triggers a production build through Vercel's GitHub integration. There is no CI workflow in the repo.
- Always verify that the push actually produced a build instead of assuming it did. The Vercel CLI is not installed on the usual dev machine, so list the project's deployments through the Vercel MCP tools (project `data-hunt-web`, team `lisateam`) and match `meta.githubCommitSha` against the commit you pushed. A build normally appears within a couple of minutes.
- The integration has been observed to silently not fire — a push sat for 25+ minutes with no build and no error anywhere. If the commit never shows up, say so rather than reporting the change as shipped, and ask before touching Vercel project settings or triggering a manual deploy.
- For a manual deploy when the integration is genuinely unavailable, use `vercel deploy` for preview and `vercel deploy --prod` for production from this repository root after confirming the linked Vercel project.
- Backend columns and API fields are NOT deployed from this repo. The Sheets table renders whatever columns the backend CSV returns, so a new column ships by deploying the backend — see the Deployment section in the sibling backend repo's `AGENTS.md`.
- Do not add or change Vercel project settings, domains, deployment protection, environment variable names, or CI automation without explicit user confirmation.

## Coding Rules

- Prefer Server Components by default. Add `'use client'` only for components that need browser APIs, state, effects, or event handlers.
- Keep route and component behavior compatible with the existing API contract unless the user explicitly approves an API change.
- Preserve the existing dark visual direction and Tailwind-based styling conventions.
- Use TypeScript types for new data shapes and avoid `any` unless the boundary is genuinely unknown.
- Keep browser-only APIs such as `localStorage` inside client components and effects.
- Do not commit secrets, API keys, tokens, wallet data, or local `.env*` files.

## Landing Page Communication

- When adding or materially changing user-facing functionality, update the landing page within the same task.
- This includes new data sources, integrations, supported platforms or blockchains, workflows, and capabilities that users can select or use.
- Present the change concisely and visually, emphasizing the user benefit instead of implementation details. Keep the landing page easy to understand with minimal reading.
- Only advertise functionality that is actually implemented and verified. Internal refactors, maintenance, and fixes that do not change visible capabilities do not require a landing-page update.
- Verify that landing-page claims match the deployed product before completing the task.

## Verification

- Run `npm run lint` for code changes.
- Run `npm run build` for route, data-fetching, config, or TypeScript-significant changes.
- For visual or interaction changes, verify the affected page in a browser when feasible.
- For docs-only changes, tests are not required.

## Git Workflow

- Check `git status --short --branch` before editing and before committing.
- Do not revert or overwrite unrelated user changes.
- Stage only files changed for the requested task.
- Commit the finished change and push the branch unless the user explicitly says not to.
