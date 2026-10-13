# AGENTS.md — bdelko

Self-hosted, single-admin server monitoring app (successor of JASMA): Express + SQLite backend plus a built-in web UI (React) in `ui/`, both served from one origin by the backend. This file is the orientation guide for coding agents; keep it updated when structure, commands or conventions change.

## Stack

- Node.js 24+, TypeScript strict, ESM (`"type": "module"`, `NodeNext` — relative imports need `.js` extensions).
- Backend: Express 5, `sqlite3` (promisified wrapper, no ORM, all SQL parameterized), `zod`, `winston`, `nodemailer`, `dotenv`.
- UI (`ui/`): React 19, Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`, class dark mode), `react-router` (hash router), `@tanstack/react-query`, vitest. No other runtime deps without written justification (no component/chart/date/form/icon libraries; system font stack only; must work offline).
- Node native `fetch` + `AbortController` for HTTP checks. No JWT/sessions/multi-user. Basic per-IP rate limiting (hand-rolled, no dependency).

## Commands

- `npm run dev` — backend with auto-restart (tsx watch)
- `npm run build` / `npm start` — tsc → `dist/`; `node dist/index.js`
- `npm run typecheck` — backend no-emit check; must stay at zero errors
- `npm run db:init` — create DB + tables without starting the server
- `npm run gen:token` — print a token for `BDELKO_API_TOKEN`
- `npm run ui:install` / `ui:dev` / `ui:build` / `build:all` — UI install / Vite dev (proxy to backend, see `ui/.env.example`) / UI build / both builds
- `npm --prefix ui test` — UI unit tests (vitest)

Backend has no automated test suite: verify by booting the server and exercising the API with curl (see README); for mail, point `BDELKO_MAIL_*` at a local SMTP sink. UI has vitest unit tests for `lib/` + theme logic; verify screens in a browser after changes.

## Structure

- `src/config.ts` — env parsing/validation (zod), `publicBaseUrl`, masked summary
- `src/db/` — `connection.ts` (Db wrapper), `schema.ts`, repos, `init.ts` (db:init entry)
- `src/api/` — `app.ts` (factory; also serves the built UI when `BDELKO_SERVE_UI=true`), `auth.ts`, `ratelimit.ts`, `errors.ts`, `validation.ts`, `context.ts`, `serialize.ts`, `routes/*`
- `src/scanner/` — run loop, connectivity, active/passive checks, states, log merge, notifier
- `src/mail/` — `mailer.ts` (transport incl. DKIM; sendMail never throws), `templates.ts` (DOWN/UP + test mail)
- `src/utils/` — ids, time, statusMatcher, logger
- `ui/src/api/` — apiFetch (relative `./api` base), types, React Query hooks
- `ui/src/auth/` — token storage (session/local), AuthContext (login/logout, global 401)
- `ui/src/settings/` — SettingsContext + theme.ts (auto theme by browser clock)
- `ui/src/pages/`, `ui/src/components/`, `ui/src/lib/` (time/format/statusMatcher + tests)

## Conventions (breaking these breaks behavior)

- **Timestamps**: epoch ms INTEGER in DB; ISO 8601 local time with offset in all API output and logs (`utils/time.ts` `toLocalIso`); emails use `YYYY-MM-DD HH:mm:ss` (`toLocalTimestamp`). The UI parses defensively (`parseTs`) and can display browser or server wall time.
- **Scan interval is hardcoded** at 60 s (`SCAN_INTERVAL_MS` in `config.ts`) — deliberately not an env var.
- **Env vars**: all prefixed `BDELKO_`, validated in `config.ts`; startup must fail fast listing invalid vars. Keep `.env.example`, `config.ts` and the README table in sync when adding/changing vars.
- **Log-note wording is a merge key**: `watchdog_log` merges consecutive rows only when status AND note are identical. Never reword the check-note strings in `scanner/active.ts` / `passive.ts`.
- **Watchdog mode is immutable** after creation; active ⇒ `url` required + `expected_status` default `2xx`; passive ⇒ generated `heartbeat_secret`, url/status null.
- **Secrets** (API token, heartbeat secret) compared with `crypto.timingSafeEqual`; never log them unmasked. UI: token only in the `Authorization` header, never in a URL, console or log.
- **Rate limiting**: in-memory fixed window per client IP over the whole `[basePath]/api` mount (`api/ratelimit.ts`); `BDELKO_RATE_LIMIT_MAX=0` disables; over-limit → 429 envelope code `RATE_LIMITED` + `Retry-After`. Per-IP correctness depends on `BDELKO_TRUST_PROXY` behind a proxy.
- **systemd**: `bdelko.service` in the repo root is a deployment template (README links it) — keep paths/comments generic.
- Errors use the envelope `{ error: { code, message, details? } }` via `ApiError` + the central handler.
- Routes mount under `[basePath]/api`; heartbeat + health are public, everything else needs the Bearer token. UI hosting: `GET [basePath]` 301 → `[basePath]/`, static assets under `assets/` get immutable caching, `index.html` `no-cache`; unknown API paths → JSON 404, other unknown paths → plain 404.
- **UI hosting model**: Vite `base: './'`, hash router (no SPA fallback needed anywhere), all API calls relative (`./api/...`). Never bake host or base path into the UI build.
- **Theme**: class-based dark mode via `.dark` on `<html>`; Auto follows the *browser clock* (OS preference ignored); `index.html` has a pre-paint inline script mirroring `ui/src/settings/theme.ts` — keep them in sync.
- No emoji in code, UI text, logs or emails. Comment modules and non-obvious logic generously.
- Scanner must never crash: catch + winston-log + continue; overlap guard skips ticks while a run is in progress.
- Mail failures: record in `notification_log`, log via winston, retry next run — never throw.
- Express 5.3 gotcha: `app.listen(cb)` invokes `cb` also on bind errors. `index.ts` logs from the real `'listening'` event and exits(1) on bind error — keep it that way.

## Runtime artifacts (gitignored)

- `data/*.db*` — SQLite (WAL). `logs/*.log*` — winston system log (size-rotated). `.env`, `ui/.env`, `ui/node_modules/`, `ui/dist/` — never commit.
