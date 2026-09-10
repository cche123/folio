# Folio — The research desk

Public, no-login company research and valuation workspace. Next.js, React, Tailwind, Recharts, and Neon Postgres. No paid AI integration or model charges.

## Features

- Charcoal/lime dark theme and warm light theme, responsive research interface.
- SEC annual US-GAAP financial imports and normalized CSV imports.
- Source-linked financial statements, FCFF DCF, sensitivity analysis, scenarios, manual comparables and sum-of-parts valuation.
- Document uploads for manual review and editable investment memo exports.
- Private browser workspaces: a secure HTTP-only cookie controls access to saved companies and documents. Clearing browser cookies loses access; export important work. There is no cross-device account sync.

The example company is fictional. PDF extraction and AI chat are not enabled. Valuations depend on user-reviewed assumptions; market prices are not live.

## Local setup

Use Node 22 or newer. Run `npm ci`, set `DATABASE_URL` in `.env.local`, apply the generated SQL in `migrations/0000_tranquil_red_hulk.sql` to an empty PostgreSQL database, then run `npm run dev`.

## Deploy

Import this repository in Vercel using the Next.js preset. Set `DATABASE_URL` in encrypted environment settings and deploy. Never commit credentials. Public production access does not expose other visitors' saved workspaces.

Document uploads use 1.5 MB chunks to stay below serverless request limits and streamed downloads. Limits: 12 MB/file, 50 MB/browser workspace, 200 MB shared document capacity, 40 companies/browser workspace. This is a small-scale personal research app, not an unlimited public storage service.

## Verification

`npm run build`, `npm run lint`, `node --experimental-strip-types --test tests/finance.test.ts`.

With the app running: `node tests/api-check.mjs http://localhost:3000`. The integration check creates a synthetic workspace and verifies persistence, chunked document storage, session isolation, and cross-site write rejection.
