/**
 * ids.ts
 *
 * Generates YouTube-style URL-safe IDs ([A-Za-z0-9_-]) from crypto-random bytes.
 * - Watchdog IDs: 11 chars (like YouTube video IDs)
 * - Heartbeat secrets: 32 chars
 */
import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

/** Random string of `length` chars from the URL-safe alphabet. */
export function generateId(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** 11-char YouTube-style Watchdog ID. */
export const generateWatchdogId = (): string => generateId(11);

/** 32-char URL-safe heartbeat secret for passive Watchdogs. */
export const generateHeartbeatSecret = (): string => generateId(32);
