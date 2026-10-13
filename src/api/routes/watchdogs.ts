/**
 * routes/watchdogs.ts  (protected)
 *
 * CRUD for Watchdogs plus:
 *   POST /:id/regenerate-secret  (passive only)
 *   GET  /:id/logs               (monitoring log of one Watchdog)
 *   GET  /:id/stats              (uptime windows 24h/7d/30d)
 *
 * Mode is immutable: a PATCH whose mode differs from the stored one -> 400.
 * Disabling a Watchdog (or turning notify off) clears its notification_state.
 */
import { Router } from 'express';
import type { Context } from '../context.js';
import { ApiError } from '../errors.js';
import { serializeLogItem, serializeWatchdog } from '../serialize.js';
import { parseQueryTime } from '../validation.js';
import type { Watchdog, UpdateWatchdogData } from '../../db/watchdogs.repo.js';
import { generateHeartbeatSecret } from '../../utils/ids.js';

/** Uptime windows exposed by /:id/stats. */
const STATS_WINDOWS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
} as const;

export function watchdogsRoutes(ctx: Context): Router {
  const router = Router();
  const { cfg } = ctx;

  // --- List all -------------------------------------------------------------
  router.get('/', async (_req, res) => {
    const all = await ctx.watchdogs.listAll();
    res.json(all.map((wd) => serializeWatchdog(cfg, wd)));
  });

  // --- Create ---------------------------------------------------------------
  router.post('/', async (req, res) => {
    const body = ctx.schemas.createWatchdogBody.parse(req.body);

    // Name must be unique case-insensitively (DB column is COLLATE NOCASE).
    const existing = await ctx.watchdogs.findByName(body.name);
    if (existing) {
      throw ApiError.conflict(`A watchdog named "${body.name}" already exists`);
    }

    const created = await ctx.watchdogs.create({
      name: body.name,
      mode: body.mode,
      // Active: url required (schema), expected_status defaults to "2xx".
      // Passive: url/expected_status stay null, a heartbeat secret is generated.
      url: body.mode === 'active' ? body.url! : null,
      expectedStatus: body.mode === 'active' ? (body.expected_status ?? '2xx') : null,
      heartbeatSecret: body.mode === 'passive' ? generateHeartbeatSecret() : null,
      enabled: body.enabled,
      notify: body.notify,
      thresholdMinutes: body.threshold_minutes,
    });

    res.status(201).json(serializeWatchdog(cfg, created));
  });

  // --- Get one ----------------------------------------------------------------
  router.get('/:id', async (req, res) => {
    const wd = await mustFind(ctx, req.params.id);
    res.json(serializeWatchdog(cfg, wd));
  });

  // --- Partial update ---------------------------------------------------------
  router.patch('/:id', async (req, res) => {
    const wd = await mustFind(ctx, req.params.id);
    const body = ctx.schemas.updateWatchdogBody.parse(req.body);

    // Mode is immutable after creation.
    if (body.mode !== undefined && body.mode !== wd.mode) {
      throw ApiError.validation('mode is immutable and cannot be changed after creation');
    }

    // url / expected_status only apply to active Watchdogs.
    if (wd.mode === 'passive' && (body.url !== undefined || body.expected_status !== undefined)) {
      throw ApiError.validation('url and expected_status only apply to active watchdogs');
    }
    // An active Watchdog must always keep a url.
    if (wd.mode === 'active' && body.url === null) {
      throw ApiError.validation('url cannot be removed from an active watchdog');
    }

    if (body.name !== undefined && body.name !== wd.name) {
      const existing = await ctx.watchdogs.findByName(body.name);
      if (existing && existing.id !== wd.id) {
        throw ApiError.conflict(`A watchdog named "${body.name}" already exists`);
      }
    }

    const update: UpdateWatchdogData = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.url !== undefined) update.url = body.url;
    // null means "reset to the default spec".
    if (body.expected_status !== undefined) update.expectedStatus = body.expected_status ?? '2xx';
    if (body.enabled !== undefined) update.enabled = body.enabled;
    if (body.notify !== undefined) update.notify = body.notify;
    if (body.threshold_minutes !== undefined) update.thresholdMinutes = body.threshold_minutes;

    const updated = (await ctx.watchdogs.update(wd.id, update))!;

    // Disabling the Watchdog or turning notifications off clears its streak
    // state, so a stale down_since cannot fire a mail after re-enabling.
    if (body.enabled === false || body.notify === false) {
      await ctx.notifications.deleteState(wd.id);
    }

    res.json(serializeWatchdog(cfg, updated));
  });

  // --- Delete -----------------------------------------------------------------
  router.delete('/:id', async (req, res) => {
    const removed = await ctx.watchdogs.remove(req.params.id);
    if (!removed) throw ApiError.notFound(`Watchdog "${req.params.id}" not found`);
    // Logs and notification rows are removed by ON DELETE CASCADE; belt and
    // braces for the state row in case foreign keys are ever off.
    await ctx.notifications.deleteState(req.params.id);
    res.status(204).end();
  });

  // --- Regenerate heartbeat secret (passive only) ------------------------------
  router.post('/:id/regenerate-secret', async (req, res) => {
    const wd = await mustFind(ctx, req.params.id);
    if (wd.mode !== 'passive') {
      throw ApiError.validation('Only passive watchdogs have a heartbeat secret');
    }
    await ctx.watchdogs.setHeartbeatSecret(wd.id, generateHeartbeatSecret());
    const updated = (await ctx.watchdogs.findById(wd.id))!;
    res.json(serializeWatchdog(cfg, updated));
  });

  // --- Logs of one Watchdog -----------------------------------------------------
  router.get('/:id/logs', async (req, res) => {
    const wd = await mustFind(ctx, req.params.id);
    const q = ctx.schemas.logsQuery.parse({ ...req.query, watchdog: wd.id });
    const result = await ctx.logs.query({
      watchdogId: wd.id,
      status: q.status,
      fromMs: parseQueryTime(q.from, 'from'),
      toMs: parseQueryTime(q.to, 'to'),
      page: q.page,
      limit: q.limit,
      order: q.order,
    });
    res.json({
      items: result.items.map(serializeLogItem),
      page: q.page,
      limit: q.limit,
      total: result.total,
    });
  });

  // --- Uptime statistics --------------------------------------------------------
  router.get('/:id/stats', async (req, res) => {
    const wd = await mustFind(ctx, req.params.id);
    const now = Date.now();
    const windows: Record<string, unknown> = {};

    for (const [label, windowMs] of Object.entries(STATS_WINDOWS)) {
      const windowStart = now - windowMs;
      const rows = await ctx.logs.listOverlapping(wd.id, windowStart, now, cfg.scanIntervalMs);

      let okMs = 0;
      let notOkMs = 0;
      let incidents = 0;

      for (const row of rows) {
        // Each row covers [started_at, ended_at + interval) - i.e. up to when
        // the next run was expected - clipped to the requested window.
        const coverStart = Math.max(row.started_at, windowStart);
        const coverEnd = Math.min(row.ended_at + cfg.scanIntervalMs, now);
        const covered = Math.max(0, coverEnd - coverStart);
        if (row.status === 1) okMs += covered;
        else notOkMs += covered;
        // Incidents: not-ok periods that started inside the window.
        if (row.status === 0 && row.started_at >= windowStart && row.started_at < now) {
          incidents++;
        }
      }

      const monitoredMs = okMs + notOkMs;
      windows[label] = {
        uptimePercent: monitoredMs > 0 ? Math.round((okMs / monitoredMs) * 10000) / 100 : null,
        okMs,
        notOkMs,
        monitoredMs,
        windowMs,
        incidents,
      };
    }

    res.json({ windows });
  });

  return router;
}

/** Shared 404 guard for /:id routes. */
async function mustFind(ctx: Context, id: string): Promise<Watchdog> {
  const wd = await ctx.watchdogs.findById(id);
  if (!wd) throw ApiError.notFound(`Watchdog "${id}" not found`);
  return wd;
}
