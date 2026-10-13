# bdelko

Self-hosted, single-admin server monitoring app. It watches your services
and sends you an email when they go down (and again when they come back up).
It consists of an Express + SQLite backend and a built-in web UI (React, in
`ui/`), both served from one origin by the backend. bdelko is the successor
of [JASMA](https://github.com/samo-sato/jasma-server-monitoring).

- **Active Watchdogs** — bdelko periodically sends an HTTP GET request to your
  URL and checks the response status code against an expected status spec
  (e.g. `2xx`, `200`, `200,301`, `200-299,304`).
- **Passive Watchdogs** — your service (a cron job, backup script, …) pings a
  unique heartbeat URL. If no ping arrives within the scan interval (plus a
  small grace margin), the Watchdog is considered down.

Everything runs off a single SQLite file and a small set of environment
variables. One API token protects the management API; the heartbeat and
health endpoints are public.

## Requirements

- Node.js **24+** (tested on v24.21.0)
- npm

## Quick start

```bash
git clone <repo> && cd bdelko
npm install
cp .env.example .env
npm run gen:token          # prints a random token; put it into BDELKO_API_TOKEN in .env
$EDITOR .env               # set at least BDELKO_PORT, BDELKO_DOMAIN, BDELKO_API_TOKEN
npm run db:init            # create the SQLite database + tables
npm run build:all          # backend TypeScript -> dist/, UI -> ui/dist/
npm start                  # boots, runs the first scan immediately
```

Then open `http://localhost:3001/` and log in with your `BDELKO_API_TOKEN`.

During development: `npm run dev` (tsx watch). `npm run typecheck` for a
no-emit type check. UI development: `npm run ui:dev` (see Web UI below).

The server fails fast on startup when required env vars are missing or
invalid, and prints exactly which ones.

## Configuration

All variables are prefixed with `BDELKO_` and documented in `.env.example`.

| Variable | Default | Description |
| --- | --- | --- |
| `BDELKO_HOST` | `127.0.0.1` | Bind address |
| `BDELKO_PORT` | — **Required** | Local listening port |
| `BDELKO_TRUST_PROXY` | `false` | `true` enables Express trust proxy (behind nginx etc.) |
| `BDELKO_SECURE` | `false` | `true` → public URLs use `https://` |
| `BDELKO_SUBDOMAIN` | — | e.g. `bdelko` → `https://bdelko.example.com` |
| `BDELKO_DOMAIN` | — **Required** | Domain used to build public (heartbeat) URLs |
| `BDELKO_PUBLIC_PORT` | — | Port in public URLs; empty = omit (80/443 behind a proxy) |
| `BDELKO_BASE_PATH` | — | e.g. `bdelko` → `https://example.com/bdelko`; no slashes |
| `BDELKO_API_TOKEN` | — **Required** | Long random string; `Authorization: Bearer <token>` |
| `BDELKO_RATE_LIMIT_MAX` | `300` | Per-client-IP API request limit per window; `0` disables rate limiting |
| `BDELKO_RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window length; over the limit → `429` + `Retry-After` |
| — scan interval — | `60000` | **Not configurable:** the 60 s scan interval is hardcoded in `src/config.ts` |
| `BDELKO_REQUEST_TIMEOUT_MS` | interval/2 | HTTP timeout for active checks |
| `BDELKO_GAP_MARGIN_MS` | `15000` | Tolerance before a missed run counts as a gap |
| `BDELKO_CONNECTIVITY_CHECK` | `true` | DNS check before each run; the run is skipped when this host is offline |
| `BDELKO_DEFAULT_THRESHOLD_MINUTES` | `3` | Default downtime threshold before a DOWN mail |
| `BDELKO_MIN_WD_NAME_LENGTH` | `1` | Watchdog name length limits |
| `BDELKO_MAX_WD_NAME_LENGTH` | `40` | |
| `BDELKO_MAX_WD_URL_LENGTH` | `2000` | |
| `BDELKO_USER_AGENT` | `bdelko-monitor/1.0` | User-Agent header of active checks |
| `BDELKO_DB_PATH` | `./data/bdelko.db` | SQLite database location |
| `BDELKO_LOG_DIR` | `./logs` | Directory of `system.log` |
| `BDELKO_LOG_LEVEL` | `info` | winston level |
| `BDELKO_LOG_MAX_SIZE_MB` | `10` | Size-based rotation of the system log |
| `BDELKO_LOG_MAX_FILES` | `5` | Rotated files to keep |
| `BDELKO_CONSOLE_RUNS` | `true` | Colored per-run console summary (like JASMA) |
| `BDELKO_SERVE_UI` | `true` | Serve the built web UI from this server |
| `BDELKO_UI_DIST_PATH` | `./ui/dist` | Folder containing the built UI |
| `BDELKO_NOTIFY_EMAIL` | — | Single recipient for all notifications |
| `BDELKO_MAIL_HOST` | — | SMTP host; **empty disables mailing** (startup warning) |
| `BDELKO_MAIL_PORT` | `587`/`465` | SMTP port (default depends on `MAIL_SECURE`) |
| `BDELKO_MAIL_SECURE` | `false` | SMTPS (TLS on connect) |
| `BDELKO_MAIL_USER` / `BDELKO_MAIL_PASS` | — | SMTP auth (auth is only sent when USER is set) |
| `BDELKO_MAIL_FROM_ADDRESS` | — | From address (falls back to MAIL_USER) |
| `BDELKO_MAIL_FROM_NAME` | `bdelko` | From display name |
| `BDELKO_MAIL_TLS_REJECT_UNAUTHORIZED` | `true` | Set `false` for self-signed SMTP certs |
| `BDELKO_MAIL_DKIM_DOMAIN` / `_SELECTOR` / `_PRIVKEY` | — | DKIM signing (all three required; `\n` in the key is converted to real newlines) |

The **public base URL** (used for heartbeat URLs in API responses) is built as:

```
{http|https}://[subdomain.]domain[:publicPort][/basePath]
```

All API routes are mounted under `[basePath]/api`.

## Web UI

bdelko ships a web UI (React + Vite, in `ui/`), served by the backend itself
from the same origin — no CORS, no separate hosting, nothing baked into the
build. It is a hash-routed single-page app, so it works unchanged at
`http://localhost:3001/`, on a public domain, and under a base path.

**Local use:**

```bash
npm run ui:install      # once
npm run build:all       # backend + UI
npm start               # UI at http://localhost:3001/
```

Log in with your `BDELKO_API_TOKEN`. The token is kept in `sessionStorage`
(or `localStorage` when you tick "Remember on this device") and is only ever
sent as an `Authorization` header — never in a URL.

Every page shows a live server-time clock in the footer, and the About page
summarizes basic runtime facts (version, scan interval, mail status, uptime).

**Development** (hot reload, two terminals):

```bash
npm run dev             # backend with auto-restart
npm run ui:dev          # Vite dev server on http://localhost:5173
```

The dev server proxies `/api` to the backend. Copy `ui/.env.example` to
`ui/.env` (gitignored) to point it at your backend:

```
VITE_BDELKO_BACKEND_URL=http://127.0.0.1:3001   # where the backend listens
VITE_BDELKO_BASE_PATH=                          # same value as BDELKO_BASE_PATH, no slashes
```

**Updating an existing install:** pull, `npm install`, `npm run ui:install`,
`npm run build:all`, restart the server.

Set `BDELKO_SERVE_UI=false` to run API-only (the UI routes then answer 404).

## Deployment

### Under a subdomain

```env
BDELKO_SECURE=true
BDELKO_SUBDOMAIN=bdelko
BDELKO_DOMAIN=example.com
BDELKO_PUBLIC_PORT=            # empty: 443 handled by the reverse proxy
BDELKO_TRUST_PROXY=true
```

Heartbeat URLs look like `https://bdelko.example.com/api/heartbeat/<id>/<secret>`.

### Under a base path

```env
BDELKO_SECURE=true
BDELKO_DOMAIN=example.com
BDELKO_PUBLIC_PORT=
BDELKO_BASE_PATH=bdelko
BDELKO_TRUST_PROXY=true
```

The API lives at `https://example.com/bdelko/api`, heartbeat URLs look like
`https://example.com/bdelko/api/heartbeat/<id>/<secret>`.

### Reverse proxy note

Run bdelko bound to `127.0.0.1` behind nginx/Apache/Caddy and terminate TLS
there. Set `BDELKO_TRUST_PROXY=true` so Express trusts `X-Forwarded-*`
headers, and make sure the proxy forwards the base path prefix unchanged.
Without `TRUST_PROXY=true` the rate limiter sees the proxy's IP for every
client, so they would share one budget.

### Rate limiting

All API endpoints (heartbeat and health included) share a basic per-client-IP
fixed-window limiter: `BDELKO_RATE_LIMIT_MAX` requests per
`BDELKO_RATE_LIMIT_WINDOW_MS` (defaults 300/min), answered with `429` and a
`Retry-After` header when exceeded. It is deliberately generous — normal UI
usage is a few requests per minute — and only exists to stop hammering and
brute-force loops. Set `BDELKO_RATE_LIMIT_MAX=0` to disable it.

### systemd

A template unit file is included as [`bdelko.service`](bdelko.service). Adjust
`User`, `WorkingDirectory` and the Node path in `ExecStart`, then:

```bash
sudo cp bdelko.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bdelko
journalctl -u bdelko -f
```

### VPS with nginx — full examples

**(a) Own subdomain, served at the root** (`https://bdelko.example.com/`):

```env
BDELKO_SECURE=true
BDELKO_SUBDOMAIN=bdelko
BDELKO_DOMAIN=example.com
BDELKO_PUBLIC_PORT=
BDELKO_BASE_PATH=
BDELKO_TRUST_PROXY=true
```

```nginx
server {
    server_name bdelko.example.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

**(b) Under a base path** (`https://example.com/bdelko/`). Note there is no
URI part in `proxy_pass`, so the path passes through unchanged:

```env
BDELKO_SECURE=true
BDELKO_SUBDOMAIN=
BDELKO_DOMAIN=example.com
BDELKO_PUBLIC_PORT=
BDELKO_BASE_PATH=bdelko
BDELKO_TRUST_PROXY=true
```

```nginx
location /bdelko/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
}
```

Keep `BDELKO_SECURE`, `BDELKO_DOMAIN`, `BDELKO_SUBDOMAIN`, `BDELKO_PUBLIC_PORT`
(empty behind the proxy) and `BDELKO_BASE_PATH` consistent with the public
URL — heartbeat URLs shown in the UI/API are built from them. The UI is a
hash-routed SPA: no `try_files`/SPA fallback is needed in nginx.

## Authentication

Every route except `/api/heartbeat/...` and `/api/health` requires:

```
Authorization: Bearer <BDELKO_API_TOKEN>
```

The comparison is timing-safe; failures get a uniform `401`. Generate a token
with `npm run gen:token`.

## API reference

Base URL below is `http://localhost:3001/api` (adjust for your deployment).
Errors always look like:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ { "path": "url", "message": "..." } ] } }
```

Codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `NOT_FOUND` (404),
`CONFLICT` (409), `RATE_LIMITED` (429, with a `Retry-After` header),
`INTERNAL` (500). Unknown routes return a JSON 404.

All timestamps in responses are ISO 8601 in the server's local time with
offset (e.g. `2026-10-11T13:54:00.000+02:00`). The database stores epoch
milliseconds.

### Public endpoints

#### `GET|POST|HEAD /api/heartbeat/:id/:secret`

Passive heartbeat ("snooze") endpoint. Records `last_heartbeat_at = now` for
the Watchdog. `200 text/plain "OK"` with `Cache-Control: no-store`. Unknown
id or wrong secret → `404 text/plain "Not found"` (timing-safe compare; valid
ids are not leaked). Disabled Watchdogs still record heartbeats and return 200.

Cron usage:

```cron
* * * * * curl -fsS https://bdelko.example.com/api/heartbeat/<id>/<secret> > /dev/null
```

#### `GET /api/health`

```json
{
  "status": "ok",
  "version": "1.0.0",
  "time": "2026-10-11T13:54:00.000+02:00",
  "uptimeSeconds": 3600,
  "scanner": { "running": false, "lastRunAt": "2026-10-11T13:53:00.000+02:00", "lastRunDurationMs": 145, "runCount": 60 },
  "mail": { "configured": true, "recipientSet": true }
}
```

`recipientSet` is `true` when `BDELKO_NOTIFY_EMAIL` is set (the address itself
is never exposed).

#### `GET /api/auth/check`

Side-effect-free token check used by the web UI's login screen. Protected by
the Bearer middleware: `200 { "ok": true }` with a valid token, `401`
otherwise.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/auth/check
```

#### `POST /api/mail/test`

Sends a test email to `BDELKO_NOTIFY_EMAIL` (the Settings page has a button
for this). `200 { "ok": true }` on success; `409` when mailing or the
recipient is not configured; `500` with the SMTP error message when the send
fails. Test mails are not recorded in the notification log.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/mail/test
```

### Watchdogs

Watchdog JSON shape (returned by all watchdog endpoints):

```json
{
  "id": "YF7u1EESZ_9",
  "name": "example",
  "mode": "active",
  "url": "https://example.com",
  "expected_status": "2xx",
  "enabled": true,
  "notify": true,
  "threshold_minutes": 3,
  "heartbeat_secret": null,
  "heartbeat_url": null,
  "last_heartbeat_at": null,
  "created_at": "2026-10-11T13:54:00.000+02:00",
  "updated_at": "2026-10-11T13:54:00.000+02:00"
}
```

Fields that do not apply to the mode are `null` (active: `heartbeat_*`;
passive: `url`, `expected_status`).

#### `GET /api/watchdogs` — list all

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/watchdogs
```

#### `POST /api/watchdogs` — create (201)

```bash
# active
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"example","mode":"active","url":"https://example.com","expected_status":"2xx"}' \
  http://localhost:3001/api/watchdogs

# passive (response includes heartbeat_secret and heartbeat_url)
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"nightly-backup","mode":"passive","threshold_minutes":5}' \
  http://localhost:3001/api/watchdogs
```

Body fields: `name` (required, unique case-insensitive), `mode` (required,
`active`|`passive`), `url` (required for active), `expected_status` (active
only, default `2xx`), `enabled` (default `true`), `notify` (default `true`),
`threshold_minutes` (0–1440, default from `BDELKO_DEFAULT_THRESHOLD_MINUTES`).

Validation: name length within the configured bounds (409 on duplicate),
`url` must be a valid http(s) URL within the length limit, `expected_status`
is a comma-separated list of `200` / `2xx` / `30x` / `200-299` items with
codes 100–599 (normalized on storage: spaces stripped, `X` → `x`).

#### `GET /api/watchdogs/:id` — one Watchdog

#### `PATCH /api/watchdogs/:id` — partial update

Updatable: `name`, `url`, `expected_status`, `enabled`, `notify`,
`threshold_minutes`. `mode` is immutable (changing it → 400). Setting
`expected_status` to `null` resets it to `2xx`. Disabling a Watchdog or
turning `notify` off clears its notification state.

```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"threshold_minutes":10}' http://localhost:3001/api/watchdogs/YF7u1EESZ_9
```

#### `DELETE /api/watchdogs/:id` — 204, cascades to logs and notifications

#### `POST /api/watchdogs/:id/regenerate-secret` — passive only

Returns the full Watchdog with a new `heartbeat_secret` / `heartbeat_url`.
Old secrets stop working immediately.

#### `GET /api/watchdogs/:id/logs`

Same as `/api/logs` (below) filtered to one Watchdog.

#### `GET /api/watchdogs/:id/stats`

Uptime statistics over fixed windows:

```json
{
  "windows": {
    "24h": { "uptimePercent": 99.9, "okMs": 86000000, "notOkMs": 90000, "monitoredMs": 86090000, "windowMs": 86400000, "incidents": 1 },
    "7d":  { "...": "..." },
    "30d": { "...": "..." }
  }
}
```

Each log row covers `[started_at, ended_at + scanInterval)` clipped to the
window. `incidents` counts not-ok periods that started inside the window.
`uptimePercent = okMs / monitoredMs * 100` (`null` when nothing was
monitored).

### Status (dashboard)

#### `GET /api/status`

```json
{
  "watchdogs": [
    {
      "id": "YF7u1EESZ_9", "name": "example", "mode": "active",
      "enabled": true, "notify": true, "threshold_minutes": 3,
      "url": "https://example.com", "heartbeat_url": null,
      "status": 1, "since": "2026-10-11T13:40:00.000+02:00",
      "note": "Ok. Endpoint \"https://example.com\" responded with status code: 200",
      "last_checked_at": "2026-10-11T13:54:00.000+02:00",
      "last_heartbeat_at": null,
      "down_since": null, "down_notified": false
    }
  ],
  "scanner": { "lastRunAt": "2026-10-11T13:54:00.000+02:00", "nextRunAt": "2026-10-11T13:55:00.000+02:00" }
}
```

`status` is `1` (ok), `0` (not ok) or `null` (never checked).

### Logs (monitoring log)

#### `GET /api/logs`

Query params: `watchdog` (id), `status` (`0`|`1`), `from`, `to` (ISO 8601 or
epoch ms; matched by overlap with `[started_at, ended_at]`), `page` (default
1), `limit` (default 50, max 500), `order` (`desc` default, by start time).

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/logs?status=0&from=2026-10-11T00:00:00%2B02:00&limit=100"
```

```json
{
  "items": [
    {
      "id": 42, "watchdog_id": "YF7u1EESZ_9", "watchdog_name": "example",
      "status": 0,
      "note": "Error. Failed to request \"https://example.com\": Request timed out",
      "started_at": "2026-10-11T13:56:00.000+02:00",
      "ended_at": "2026-10-11T13:57:00.000+02:00",
      "counter": 2, "duration_ms": 60000
    }
  ],
  "page": 1, "limit": 50, "total": 1
}
```

### Notifications (email history)

#### `GET /api/notifications`

History of attempted DOWN/UP emails (sent and failed). Query params:
`watchdog` (id), `type` (`down`|`up`), `success` (`0`|`1`), `from`, `to`
(ISO 8601 or epoch ms; range filter on `sent_at`), `page` (default 1),
`limit` (default 50, max 500), `order` (`desc` default).

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/notifications?type=down&success=0&limit=100"
```

```json
{
  "items": [
    {
      "id": 1, "watchdog_id": "YF7u1EESZ_9", "watchdog_name": "example",
      "type": "down", "sent_at": "2026-10-11T13:56:00.000+02:00",
      "success": true, "error": null
    }
  ],
  "page": 1, "limit": 50, "total": 1
}
```

## How the monitoring log works (log merging)

The scanner runs every 60 seconds (hardcoded). Instead of writing one row
per run, bdelko keeps **one row per continuous period of identical state**
and extends it while nothing changes. A new row is appended only when:

- there is no previous row, or
- the status or the note changed, or
- there is a gap (`now - last.ended_at > interval + gapMargin`) — e.g. the
  app was stopped; the break stays visible instead of stretching the old row.

```
NOT this:
2026-10-11 13:54 Ok. Endpoint "https://www.example.com/" responded with status code: 200
2026-10-11 13:55 Ok. Endpoint "https://www.example.com/" responded with status code: 200
2026-10-11 13:56 Error. Failed to request "https://www.example.com/": Request timed out
2026-10-11 13:57 Error. Failed to request "https://www.example.com/": Request timed out

But this:
2026-10-11 13:54 - 2026-10-11 13:55 (2 runs) Ok. Endpoint "https://www.example.com/" responded with status code: 200
2026-10-11 13:56 - 2026-10-11 13:57 (2 runs) Error. Failed to request "https://www.example.com/": Request timed out
```

This is why the exact note wording is fixed and reused — any wording change
would start a new row.

In the web UI, an additional synthetic orange **N/A** row ("Unknown status.
Scanner possibly down.") is inserted between two rows whenever the gap between
them exceeds the interval + gap margin (i.e. the scanner was not running).
These rows are computed client-side from the rows on the current page only,
so a gap spanning a page boundary is not annotated.

## Notifications (DOWN/UP emails)

Notification state is persisted (`notification_state` table), so thresholds
survive restarts. Per Watchdog with `notify = 1`:

- First not-ok run → the streak's `down_since` is recorded.
- A **DOWN** mail is sent once the Watchdog has been **continuously** down
  for at least `threshold_minutes` (`0` = immediately on the first failure).
- When the Watchdog is ok again after a DOWN mail was sent, an **UP** mail
  (including the total downtime) is sent and the streak is reset.
- If it recovers **before** the threshold was reached (a blip), the streak is
  reset silently — no mails.
- Every send attempt (success or failure) is recorded in the
  `notification_log` table. Failures are logged and retried on the next run;
  they never break the scan loop.
- Disabling a Watchdog (or deleting it) removes its streak state.

DOWN mail:

```
Subject: [bdelko] "example" is DOWN

Watchdog: example
Mode: active
Target: https://example.com
Down since: 2026-10-11T13:56:00.000+02:00
Threshold: 3 minutes
Last note: Error. Failed to request "https://example.com": Request timed out
```

UP mail:

```
Subject: [bdelko] "example" is back UP

Watchdog: example
Mode: active
Target: https://example.com
Down since: 2026-10-11T13:56:00.000+02:00
Back up at: 2026-10-11T14:12:00.000+02:00
Total downtime: 16 minutes
Last note: Ok. Endpoint "https://example.com" responded with status code: 200
```

If `BDELKO_MAIL_HOST` is empty, mailing is disabled (startup warning) and the
notification step is skipped entirely.

## The scanner

- Runs every 60 seconds, hardcoded (first run immediately on startup).
- An overlap guard skips ticks that fire while the previous run is still in
  progress; any failure inside a run is caught and logged — the loop never
  dies.
- Optional connectivity check (DNS resolve of `google.com`, fallback
  `cloudflare.com`): when this host is offline the run is skipped, so your
  own outage doesn't flood the log with bogus "not ok" rows.
- Active checks run in parallel (`Promise.allSettled`) with per-request
  timeouts and a configurable User-Agent; redirects are followed.
- All log writes of a run happen in a single transaction.
- With `BDELKO_CONSOLE_RUNS=true` each run prints a colored summary
  (run number, counts, logs appended/updated, mails sent, duration).

## Where things live

- **Database**: `BDELKO_DB_PATH` (default `./data/bdelko.db`) — SQLite in WAL
  mode. Tables: `watchdog`, `watchdog_log`, `notification_state`,
  `notification_log`. Deleting a Watchdog cascades to all of its rows.
- **System log**: `${BDELKO_LOG_DIR}/system.log` — JSON lines, rotated by
  size (`BDELKO_LOG_MAX_SIZE_MB` / `BDELKO_LOG_MAX_FILES`). Contains the
  startup config summary (secrets masked), scanner warnings/errors, mail
  results and API 5xx. HTTP requests are logged one line each at `debug`
  level only.
- **Monitoring log**: the `watchdog_log` table (see above) — query it via
  `GET /api/logs`.

## npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Backend with auto-restart (tsx watch) |
| `npm run build` | Backend TypeScript → `dist/` |
| `npm start` | Run the built backend (`node dist/index.js`) |
| `npm run typecheck` | Backend no-emit type check |
| `npm run db:init` | Create the DB + tables without starting the server |
| `npm run gen:token` | Print a random `BDELKO_API_TOKEN` |
| `npm run ui:install` | Install UI dependencies (`npm --prefix ui install`) |
| `npm run ui:dev` | Vite dev server with hot reload + API proxy |
| `npm run ui:build` | Build the UI (`ui/dist/`, includes its type check) |
| `npm run build:all` | `build` + `ui:build` |
| `npm --prefix ui test` | UI unit tests (vitest) |

## Security notes

- The single admin token (`BDELKO_API_TOKEN`) gates the whole management API;
  comparisons are timing-safe. The web UI stores it in `sessionStorage`
  (cleared when the tab closes), or in `localStorage` when you tick "Remember
  on this device", and only sends it as an `Authorization` header.
- Use HTTPS when exposing bdelko on the public internet — the token and
  heartbeat secrets are otherwise visible in transit.
- Heartbeat secrets are URL-safe random 32-char strings, compared
  timing-safe; unknown ids and wrong secrets are indistinguishable (both 404).

## .gitignore notes

`node_modules/`, `dist/` and `.env` are ignored, as are `data/*.db*` and
`logs/*.log*` — the database and logs are runtime artifacts. The same applies
to the UI: `ui/node_modules/`, `ui/dist/` (built output) and `ui/.env`.
The empty `data/.gitkeep` and `logs/.gitkeep` files keep those directories
in git.

## Project layout

```
src/                  # backend
  index.ts            entry: config -> db -> scanner -> http, graceful shutdown
  config.ts           env parsing/validation (zod), publicBaseUrl
  db/                 sqlite connection (promisified), schema, repos, db:init
  api/                express app, bearer auth, error/validation helpers, routes
  scanner/            run loop, connectivity, active/passive checks, log merge, notifier
  mail/               nodemailer transport (incl. DKIM), DOWN/UP templates
  utils/              ids, time, expected_status matcher, winston logger
ui/                   # web UI (React + Vite + Tailwind, own package.json)
  src/api/            apiFetch client (relative ./api), types, React Query hooks
  src/auth/           token storage, AuthContext (login/logout, global 401)
  src/settings/       theme (auto by time of day), time zone, refresh interval
  src/pages/          Login, Dashboard, WatchdogForm, WatchdogDetail, Logs, Notifications, Settings
  src/components/     tables, cards, dialogs, toasts, timeline, icons (inline SVG)
  src/lib/            time/format/statusMatcher helpers (+ vitest tests)
```
