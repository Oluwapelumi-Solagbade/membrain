# MemBrain site

The MemBrain front end: the landing page, the "raise a concern" chat and the clinician workspace.
Built on the same stack as KlimateX: Next.js 16 (static export), React 19, Tailwind 4 and lucide icons.

## Run it

```bash
cd site
npm install
npm run dev          # http://localhost:3000, workspace runs in the browser
npm run build        # static files in out/
```

With the backend, from the repository root (the API serves `site/out` at `/`):

```bash
(cd site && npm run build)
uvicorn api.main:app --port 8000      # then open http://localhost:8000/clinician/
```

Or point the dev server at a running API: `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev`.

## Two modes, one interface

Every clinician page talks to `lib/workspace/backend.ts`, which picks a backend once per page load:

- **Server** (`lib/workspace/server.ts`): the MemBrain API (`api/main.py`) when it answers on the same origin,
  at `NEXT_PUBLIC_API_URL`, or at `?api=<url>`. Actions, referrals and concerns go to the server, which runs the
  Python engine and writes the audit log. Its store is in memory (it resets on restart) and the role header stands
  in for sign-in, as the API documents.
- **Browser** (`lib/workspace/local.ts`): when no server answers, or with `?mode=browser`. The JavaScript engine
  copies decide every level and changes are kept in this browser's storage. Nothing leaves the browser.

Both return the same `Case` shape as `GET /cases`, so the pages do not know which one they are using. The sidebar
shows which mode is live.

## Pages

| Page | What it is |
|---|---|
| `/` | Landing page. The hero card, the queue preview and the chat outcomes are the engine's real output, computed at build time. |
| `/concern/` | The concern chat, in English or Gulf Arabic (`?lang=ar`). A confirmed concern becomes a case (`POST /concerns`). |
| `/clinician/` | Review queue: every case by urgency, with reasons, thresholds and the clinician's actions. |
| `/clinician/case/?id=` | One case: profile, task actions, referral with a grounded draft, scores over time, concern, prevention, activity. |
| `/clinician/referrals/` | Every referral through the closed loop, stalled ones first, and the service directory. |
| `/clinician/cohorts/` | The whole cohort, filterable, with CSV export. |
| `/clinician/reports/` | Programme metrics for this cohort and the 160-referral simulation, with equity breakdowns. |
| `/clinician/validation/` | Simulated validation against usual care, intake release gates and the speech result. |
| `/clinician/settings/` | Data mode, demo reset, the thresholds from `membrain/config.py`, and the audit log. |
| `/prototype/` | The earlier single-file prototype (check-in, enrolment), kept until those screens move over. |

All people and data are synthetic.

## Demo video

`public/demo/` holds the 96-second demo (`membrain-demo.mp4`, poster), the looping chat clip used on the landing
page (`membrain-chat-loop.mp4`) and a shareable GIF (`membrain-chat.gif`). All of it is one real run of the live
site against the API on the synthetic cohort, recorded by `scripts/record-demo.mjs` (it resets the server first, and
draws the captions and pointer into the page). To re-record, follow the usage note at the top of that script, then:

```bash
ffmpeg -ss 0.4 -i take.webm -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart -an public/demo/membrain-demo.mp4
```

## Brand

The logo files in `public/brand/` and the icons in `app/` (`icon.png`, `apple-icon.png`, `favicon.ico`,
`opengraph-image.png`) are all generated from the supplied MemBrain logo artwork. Set `NEXT_PUBLIC_SITE_URL` when
deploying so link previews point at the real address.

## How it uses the engine

`web/` stays the single source of truth. `scripts/sync-data.mjs` runs before `dev` and `build` and copies, into
`lib/generated/` (not committed):

- `web/engine.js`, `web/intake.js` and `web/navigator.js`, wrapped as ES modules but otherwise byte-identical, so
  `node web/parity_test.js` (Python against JavaScript) covers the code this site runs;
- slices of `web/data.js` (config, intake lexicons, personas, the navigator and programme data), so each page loads
  only what it needs.

It also copies the earlier prototype (`web/dist`) to `/prototype/`. Run `make web` first if `web/` changed.

## Deploying

`scripts/deploy_azure.sh` builds the site before `az webapp up`, and the `Dockerfile` builds it in a Node stage,
so the API always ships with the current front end.

## Still to do

- **Hero photo.** `public/images/hero-family.webp` and `hero-family-top.webp` are crops of the design mockup, which has the card baked into the photo; the live card is positioned to cover it. Replace both with the original photo (no card on it, at least 1700 px wide) and the card placement can be relaxed.
- **Doctor avatar.** `public/images/avatar-dr-demo.webp` is a 54 px crop of the dashboard mockup.
- Move the participant check-in and enrolment over from the prototype.
- Real sign-in (SMART on FHIR / OAuth2) and a persistent store (PostgreSQL) on the server.
- Native-speaker review of all Arabic text.
- The WhatsApp and Telegram previews on the landing page are of planned channels, and are labelled that way.
