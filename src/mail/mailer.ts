/**
 * mailer.ts
 *
 * Thin wrapper around nodemailer. The transport is built from config once at
 * startup; when BDELKO_MAIL_HOST is empty the Mailer stays unconfigured and
 * every send is skipped (the scanner's notifier checks isConfigured first).
 * Supports SMTP auth, TLS options and DKIM signing (all three DKIM vars set).
 * sendMail() never throws - it returns { success, error? } so the notifier
 * can record failures in notification_log without breaking the scan loop.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import type { Config } from '../config.js';

export interface SendResult {
  success: boolean;
  error?: string;
}

export class Mailer {
  private readonly transporter: Transporter | null = null;
  private readonly from: string = '';
  private readonly to: string = '';

  constructor(private readonly cfg: Config) {
    if (!cfg.mail.enabled) return;

    this.transporter = nodemailer.createTransport({
      host: cfg.mail.host!,
      port: cfg.mail.port,
      secure: cfg.mail.secure,
      auth: cfg.mail.user ? { user: cfg.mail.user, pass: cfg.mail.pass ?? '' } : undefined,
      tls: { rejectUnauthorized: cfg.mail.tlsRejectUnauthorized },
      dkim: cfg.mail.dkim
        ? {
            domainName: cfg.mail.dkim.domain,
            keySelector: cfg.mail.dkim.selector,
            privateKey: cfg.mail.dkim.privateKey,
          }
        : undefined,
    });

    // "Name <address>" when a display name is configured, bare address otherwise.
    const addr = cfg.mail.fromAddress ?? cfg.mail.user ?? cfg.mail.notifyEmail ?? '';
    this.from = cfg.mail.fromName ? `"${cfg.mail.fromName}" <${addr}>` : addr;
    this.to = cfg.mail.notifyEmail ?? '';
  }

  /** true when a transport exists (BDELKO_MAIL_HOST was configured). */
  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  /** Send a plain-text mail. Resolves even on failure - never throws. */
  async sendMail(subject: string, text: string): Promise<SendResult> {
    if (!this.transporter) {
      return { success: false, error: 'Mail is not configured' };
    }
    try {
      await this.transporter.sendMail({ from: this.from, to: this.to, subject, text });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
