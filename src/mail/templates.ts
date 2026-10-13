/**
 * templates.ts
 *
 * Plain-text subject/body builders for DOWN and UP notification emails.
 * Timestamps are rendered as "YYYY-MM-DD HH:mm:ss" in server local time;
 * durations via formatDuration(). No emoji, no HTML.
 */
import type { Watchdog } from '../db/watchdogs.repo.js';
import { formatDuration, toLocalTimestamp } from '../utils/time.js';

export interface MailContent {
  subject: string;
  text: string;
}

/** Test email sent on demand from the Settings page (POST /api/mail/test). */
export function buildTestMail(info: { version: string; publicBaseUrl: string }): MailContent {
  const subject = '[bdelko] Test email';
  const lines = [
    'This is a test email from bdelko.',
    '',
    `Sent at: ${toLocalTimestamp(Date.now())}`,
    `Version: ${info.version}`,
    `Public URL: ${info.publicBaseUrl}`,
    '',
    'If you can read this, email notifications are working.',
  ];
  return { subject, text: lines.join('\n') };
}

export interface DownMailInfo {
  /** Epoch ms of the first not-ok run of the current streak. */
  downSince: number;
  /** Configured threshold that had to be reached before mailing. */
  thresholdMinutes: number;
  /** Latest scanner note (human readable reason). */
  note: string;
}

export function buildDownMail(wd: Watchdog, info: DownMailInfo): MailContent {
  const subject = `[bdelko] "${wd.name}" is DOWN`;
  const lines = [
    `Watchdog: ${wd.name}`,
    `Mode: ${wd.mode}`,
    `Target: ${wd.mode === 'active' ? wd.url : 'passive heartbeat'}`,
    `Down since: ${toLocalTimestamp(info.downSince)}`,
    `Threshold: ${info.thresholdMinutes} minute${info.thresholdMinutes === 1 ? '' : 's'}`,
    `Last note: ${info.note}`,
  ];
  return { subject, text: lines.join('\n') };
}

export interface UpMailInfo {
  /** Epoch ms of the first not-ok run of the streak that just ended. */
  downSince: number;
  /** Epoch ms of the first ok run after the streak. */
  upAt: number;
  /** Latest scanner note. */
  note: string;
}

export function buildUpMail(wd: Watchdog, info: UpMailInfo): MailContent {
  const subject = `[bdelko] "${wd.name}" is back UP`;
  const lines = [
    `Watchdog: ${wd.name}`,
    `Mode: ${wd.mode}`,
    `Target: ${wd.mode === 'active' ? wd.url : 'passive heartbeat'}`,
    `Down since: ${toLocalTimestamp(info.downSince)}`,
    `Back up at: ${toLocalTimestamp(info.upAt)}`,
    `Total downtime: ${formatDuration(info.upAt - info.downSince)}`,
    `Last note: ${info.note}`,
  ];
  return { subject, text: lines.join('\n') };
}
