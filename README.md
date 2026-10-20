# Spaced Learning

A personal, research-based study app for university courses. It starts with a curated **Calculus 2**
deck and is built to add any other course without code changes.

- **FSRS-6 scheduling** ([ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)). Each card comes
  back just before you would forget it, and the most at-risk cards come first.
- **Active recall.** You try to answer first, optionally typing your answer, then reveal and rate
  Again / Hard / Good / Easy. Each rating button shows the next interval.
- **Interleaving.** Sessions alternate topics. The deck includes "which technique / which test?" and
  confusable-pair cards.
- **Math everywhere.** Cards use LaTeX via KaTeX, including MathML for screen readers. Cloze deletions work
  inside formulas (`$\int u\,dv = {{c1::uv}} - \int v\,du$`).
- **Local-first PWA.** The app is instant and works offline. It installs on iPhone and desktop, and syncs
  between devices through a tiny Cloudflare Worker and D1.
- **Private.** Cloudflare Access (email one-time PIN) sits in front of everything, and the Worker
  re-verifies the Access JWT.
- **$0 to run** on Cloudflare's free tier.

## Architecture

```
Browser / installed PWA                     Cloudflare (free tier)
┌───────────────────────────┐   HTTPS   ┌────────────────────────────────────┐
│ React SPA (precached)     │ ────────▶ │ Cloudflare Access (email OTP)      │
│ IndexedDB = primary store │           │  ↓ only authenticated requests     │
│ Sync engine (delta, LWW)  │ ◀───────▶ │ Worker: static assets + /api/sync  │
└───────────────────────────┘           │  verifies Access JWT → D1 (SQLite) │
                                        └────────────────────────────────────┘
```

| Path | What lives there |
|---|---|
| `src/domain/` | Pure TypeScript with no React or Dexie: entities, the ts-fsrs adapter (`scheduler.ts`), the study queue (`queue.ts`), card generation and cloze parsing, study-day boundaries, stats |
| `src/content/` | Markdown-lite + LaTeX parser, KaTeX rendering, content validation, curated decks (`decks/calc2.json`) |
| `src/db/` | Dexie schema, the repository and the read-side queries/hooks. Every write goes through `repo.ts`, which stamps `updatedAt` and `dirty` and writes tombstones instead of deleting |
| `src/io/` | Versioned, Zod-validated file formats: full backup and content packs |
| `src/sync/` | Delta push/pull client and the background sync manager |
| `src/app/` | The app shell: navigation, error boundary, sync and update indicators |
| `src/features/` | Screens: dashboard, study, library, editor, settings |
| `worker/` | Cloudflare Worker: Access JWT verification, sync API, D1 migrations |
| `e2e/` | Playwright tests (desktop Chromium and iPhone WebKit, with axe accessibility checks) |
| `docs/decisions/` | Short records of the architectural decisions behind the above |

The import directions between layers are listed in `CLAUDE.md` and enforced by a test.

## Develop

Requires Node 22.22+ (Node 24 recommended).

```sh
npm install
cp .dev.vars.example .dev.vars   # local-only auth bypass (works on localhost only)
npm run db:migrate:local          # creates the local D1 tables
npm run dev                       # SPA + Worker + local D1 on http://localhost:5173
```

| Command | |
|---|---|
| `npm test` | Unit and integration tests (Vitest): domain, persistence, import/export, Worker SQL, two-device sync, deck checks, layer rules. `npm run test:coverage` adds a coverage report |
| `npm run test:e2e` | Playwright end-to-end tests. Uses a throwaway local D1 database. Run `npx playwright install chromium webkit` once first |
| `npm run typecheck` / `npm run lint` / `npm run format` | TypeScript (strict) and Biome |
| `npm run build` | Production build into `dist/` (client, Worker, service worker) |

## Deploy to Cloudflare (one-time setup, about 15 minutes)

1. **Sign in:** `npx wrangler login`
2. **Create the database:** `npx wrangler d1 create spaced-learning`. Copy the printed `database_id` into
   `wrangler.jsonc`.
3. **Create the tables:** `npm run db:migrate:remote`
4. **Deploy:** `npm run deploy`. The app is published at `https://spaced-learning.<your-subdomain>.workers.dev`.
   **It is public until you finish step 5**, so do that right away.

   For every later release, run `npm run db:migrate:remote` **before** `npm run deploy` when the
   release adds a file under `worker/migrations/`: the Worker's SQL expects the new columns.
5. **Lock it down with Cloudflare Access.** The Zero Trust free plan allows up to 50 users.
   1. In the Cloudflare dashboard, open **Workers & Pages → spaced-learning → Settings → Domains & Routes**.
   2. Enable **Cloudflare Access** for both **workers.dev** and **Preview URLs**.
   3. In **Zero Trust → Access → Applications**, edit the application:
      - Set the policy to **Allow** → **Emails** → your email only.
      - Set the session duration to something long, for example 1 month.
   4. In **Zero Trust → Settings → Authentication**, make sure **One-time PIN** is enabled.
6. **Give the Worker its verification settings.** Defence in depth: the Worker checks the Access token
   itself. Run each command and paste the value when prompted:
   ```sh
   npx wrangler secret put ACCESS_TEAM_DOMAIN   # https://<team-name>.cloudflareaccess.com
   npx wrangler secret put ACCESS_AUD           # Application Audience (AUD) tag, from the Access application's overview
   npx wrangler secret put ALLOWED_EMAIL        # exactly one email address (a list is rejected)
   ```
7. **Verify:**
   - `curl -sI https://spaced-learning.<sub>.workers.dev | grep -i location` should point to
     `…cloudflareaccess.com`.
   - In a browser, sign in with the emailed PIN, then go to **Settings → Backup & sync → Sync now**. It
     should show *Synced*.
8. **Optional, git-push deploys:** in **Workers & Pages → spaced-learning → Settings → Builds**, connect
   this GitHub repository:
   - Build command: `npm ci && npm run build`
   - Deploy command: `npx wrangler deploy`

   Branches get Access-protected preview URLs.

> **Every hostname must be covered by Access.** If you add a custom domain later, add it to the Access
> application before using it.

### iPhone

1. Open the URL in **Safari** and sign in with the PIN.
2. Tap **Share → Add to Home Screen**.
3. Open the installed app and sign in once more. The installed app keeps its own storage, separate from
   Safari. Sync then downloads your data.
4. **Study only from the installed app.** Safari may delete website data after 7 days without a visit.
   Home-screen apps are exempt.

## Backups and recovery

Your progress is protected in three independent ways:

1. **Sync (continuous).** Every change is pushed to D1 when the app opens, when a session ends, when the
   app goes to the background, every 5 minutes while there are pending changes, and on *Sync now*. A
   reinstalled app restores everything on its first sync.
2. **Backup file.** Use **Settings → Export backup** for a complete JSON copy that doesn't depend on any
   server. Restoring validates the file, shows what it contains, and downloads your current data first.
   The dashboard reminds you when no backup has been made for 14 days and sync isn't working.
3. **D1 Time Travel (server point-in-time restore).** This is for a mistake that has already synced
   everywhere:
   ```sh
   npx wrangler d1 time-travel info spaced-learning
   npx wrangler d1 time-travel restore spaced-learning --timestamp=2026-10-01T12:00:00Z
   ```
   Then on each device, use **Settings → Reset this device**. The device re-downloads the restored state.
   Devices don't roll back by themselves, because their local copy is already considered synced.

Deletions are tombstones and review logs are append-only, so nothing synced is ever silently lost.

## Content format

Fields use **markdown-lite + LaTeX**:

| Syntax | Meaning |
|---|---|
| `$…$` | Inline math |
| `$$…$$` | Display math |
| `**bold**`, `*italic*`, `` `code` `` | Text emphasis |
| `- ` or `1. ` | Lists |
| A blank line | New paragraph |
| `\$` | A literal dollar sign |

Raw HTML is never rendered.

**Cloze deletions:** `{{c1::hidden}}` or `{{c1::hidden::hint}}`. Each number becomes its own card.

**Importing content:** to add a whole course, write a content pack and use **Settings → Import content
pack**. Re-importing never duplicates items, and items you deleted stay deleted.

```json
{
  "format": "spaced-learning-content",
  "version": 1,
  "deck": { "id": "discrete-math", "version": 1, "title": "Discrete Mathematics" },
  "courses": [{ "key": "discrete", "name": "Discrete Mathematics" }],
  "topics": [
    { "key": "logic", "courseKey": "discrete", "parentKey": null, "name": "Logic" },
    { "key": "logic-laws", "courseKey": "discrete", "parentKey": "logic", "name": "Laws" }
  ],
  "items": [
    {
      "key": "de-morgan-and",
      "topicKey": "logic-laws",
      "type": "cloze",
      "prompt": "$\\neg(p \\land q) \\equiv {{c1::\\neg p \\lor \\neg q}}$",
      "answer": "",
      "explanation": "Negating an *and* flips it to an *or* of negations.",
      "tags": ["identity"]
    }
  ]
}
```

The full backup format (`spaced-learning-backup`, version 1) and the content-pack format are defined
in `src/io/schema.ts`. Changing either requires a new version number and a migration.

## Curated decks

Four decks ship with the app. When you install one, you choose which topics your course has
covered; new cards come only from active topics, and you activate more in the Library as
lectures progress. Each deck's outline, sources and open questions are in `docs/content-plans/`.

| Deck | Items | Units | Written from |
|---|---|---|---|
| Calculus 2 | 214 | 8 | Stewart-style course; 125 numeric spot-checks verify the formulas (`calc2.checks.ts`) |
| COMP 352 · Data Structures & Algorithms | 221 | 10 | Fall 2026 slides and midterm prep for weeks 1–3; later units (102 items tagged `ahead`) from Goodrich–Tamassia |
| COMP 232 · Mathematics for Computer Science | 230 | 10 | Fall 2026 slides for weeks 1–5; later units (60 items tagged `ahead`) from Rosen |
| ECON 203 · Introduction to Macroeconomics | 208 | 10 | Fall 2026 chapter slides 4–10; chapters 11–19 (56 items tagged `ahead`) from Ragan |

Items written ahead of the lectures carry the `ahead` tag and no `source`; when those slides
arrive, verify them, add sources and drop the tag. Every item in every deck is checked by
`npm test`: schema, topic tree, KaTeX rendering and the editor's quality rules. To check one
file while editing it: `DECK=src/content/decks/comp352.json npx vitest run test/deck-file.test.ts`.

Calculus 2 conventions worth a look against your textbook:

| Item | Convention used |
|---|---|
| `trigsub-sec` | Stewart's θ-range: 0 ≤ θ < π/2 or π ≤ θ < 3π/2 |
| `trigsub-int-sqrt-x2-plus-a2` | No absolute value bars, since the argument is always positive |
| `polar-area` | Assumes the region is swept exactly once |

## Roadmap (after the MVP)

1. A leech workflow and a "difficult concepts" view.
2. MathLive math keyboard for typed answers.
3. Problem items with rotating variants.
4. Exam mode, which temporarily raises desired retention.
5. Richer statistics.
6. CSV import.
7. Images for graphs.
8. Curated-deck updates by stable key.

Later, only if needed: FSRS parameter optimisation from your review history, AI-assisted card
generation, PDF import, symbolic answer checking, and Anki import.
