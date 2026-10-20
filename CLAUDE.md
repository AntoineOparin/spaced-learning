# Spaced Learning — working notes for contributors and agents

Personal spaced-repetition PWA (React 19, Dexie, Tailwind 4) with a Cloudflare Worker + D1 sync
backend. The README covers features, deployment and the data formats; this file covers how the
code is organised and the rules that keep it that way.

## Commands

```sh
npm run dev          # SPA + Worker + local D1 (http://localhost:5173); needs .dev.vars
npm test             # Vitest: domain, repo, io, sync, Worker SQL, deck checks, layering
npm run test:coverage  # the same with a coverage summary (lcov in coverage/)
npm run typecheck    # tsc -b (app, worker and node projects)
npm run lint         # Biome (format + lint); `npm run format` fixes
npm run test:e2e     # Playwright, desktop Chromium + iPhone WebKit (install browsers once)
npm run build && npx wrangler deploy --dry-run
```

## Layers and allowed imports (enforced by `test/layering.test.ts` and Biome)

| Layer | May import | Role |
|---|---|---|
| `src/domain` | nothing in the app | Pure TypeScript: entities, FSRS adapter, queue, cloze, stats. No React, no Dexie. |
| `src/lib` | — | Generic browser/utility helpers (`cn`, storage, theme, platform). |
| `src/ui` | lib | Design-system primitives. No data access. |
| `src/content` | domain, lib | Markup + KaTeX rendering, validation; `content/decks` may import `io`. |
| `src/db` | domain, lib | Dexie schema, `Repo` (all writes), `queries.ts` (reads), `hooks.ts` (reactive reads). |
| `src/io` | db, domain, lib | Versioned file formats (backup, content pack) and their Zod schemas. |
| `src/sync` | db, domain, io, lib | Delta sync client (validates pulled records with the `io` schemas) + background manager. |
| `src/app` | db, domain, lib, sync, ui | App shell only: navigation, error boundary, update/sync indicators. |
| `src/features/*` | everything above + `features/decks` | Screens. `features/study` may also import `features/editor`. |
| `worker/` | only `worker/` | Cloudflare Worker: Access JWT check, sync API, migrations. Never imports `src`. |

Only `src/db` and `src/sync` import `dexie`; only `src/domain/scheduler.ts` imports `ts-fsrs`.

## Invariants

- **Writes go through `Repo`** (`src/db/repo.ts`). It stamps `updatedAt`/`dirty`, writes
  tombstones instead of deleting, and keeps review logs append-only. Pages never call
  `db.table.put/add/delete`.
- **Reads go through `src/db/queries.ts` or `src/db/hooks.ts`.** Add a query there rather than
  touching tables in a component.
- **Never edit an existing Dexie `version(n)`** in `src/db/db.ts`; add `version(n+1)` with an
  upgrade function.
- **File formats and the sync wire format are versioned.** Changing a record shape means a new
  version number in `src/io/schema.ts`, a migration, and (for synced records) a bump of
  `SCHEMA_VERSION` in `src/domain/types.ts` with an entry in `src/db/upgrades.ts`.
- **The Worker is schema-agnostic and single-tenant.** It stores client records as JSON by
  `(tbl, id)` with last-write-wins on `updatedAt`; exactly one email is allowed.
- **Curated decks are data.** `src/content/decks/*.json` are content packs validated by tests
  (`calc2.checks.ts` holds numeric spot-checks); don't hand-edit formulas without a check.

## Working conventions

- Work on `develop`; `main` is updated by the user through PRs. Commit and push only when asked.
- The app is iPhone-first. Verify UI changes in a browser at a phone viewport, not just in tests.
- Tests construct their own `AppDB`/`Repo` with a fake clock (`src/test/factories.ts`,
  `fake-indexeddb/auto`); Worker tests run the real SQL on `node:sqlite` (`worker/test/sqlite.ts`).
- Design decisions with lasting consequences are recorded in `docs/decisions/`.
