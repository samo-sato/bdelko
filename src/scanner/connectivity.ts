/**
 * connectivity.ts
 *
 * Pre-run internet connectivity check (BDELKO_CONNECTIVITY_CHECK). When the
 * host itself is offline we skip the whole scan run, so our own outage does
 * not pollute the monitoring log with bogus "not ok" rows for every Watchdog.
 *
 * Method: DNS resolve of google.com, falling back to cloudflare.com.
 */
import { resolve } from 'node:dns/promises';
import { logger } from '../utils/logger.js';

const PROBE_HOSTS = ['google.com', 'cloudflare.com'];

/** True when at least one probe host resolves. */
export async function hasConnectivity(): Promise<boolean> {
  for (const host of PROBE_HOSTS) {
    try {
      await resolve(host);
      return true;
    } catch (err) {
      logger.debug(`Connectivity probe failed for ${host}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return false;
}
