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

## Coding Rules

- Prefer Server Components by default. Add `'use client'` only for components that need browser APIs, state, effects, or event handlers.
- Keep route and component behavior compatible with the existing API contract unless the user explicitly approves an API change.
- Preserve the existing dark visual direction and Tailwind-based styling conventions.
- Use TypeScript types for new data shapes and avoid `any` unless the boundary is genuinely unknown.
- Keep browser-only APIs such as `localStorage` inside client components and effects.
- Do not commit secrets, API keys, tokens, wallet data, or local `.env*` files.

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
