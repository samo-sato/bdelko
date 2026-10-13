/**
 * routes/mail.ts
 *
 * POST /api/mail/test - sends a test email to BDELKO_NOTIFY_EMAIL so the
 * admin can verify SMTP delivery on demand (button on the Settings page).
 * 409 when mailing or the recipient is not configured. When the send itself
 * fails, the SMTP error message is returned to the caller: the single admin
 * is the only possible caller and the reason is essential for debugging the
 * mail setup. Test mails are not recorded in notification_log (they are not
 * DOWN/UP events), only winston-logged.
 */
import { Router } from 'express';
import type { Context } from '../context.js';
import { ApiError } from '../errors.js';
import { buildTestMail } from '../../mail/templates.js';
import { logger } from '../../utils/logger.js';
import { VERSION } from '../../utils/version.js';

export function mailRoutes(ctx: Context): Router {
  const router = Router();

  router.post('/mail/test', async (_req, res, next) => {
    try {
      if (!ctx.mailer.isConfigured) {
        throw ApiError.conflict('Email notifications are not configured (BDELKO_MAIL_HOST is empty).');
      }
      if (!ctx.cfg.mail.notifyEmail) {
        throw ApiError.conflict('No notification recipient configured (BDELKO_NOTIFY_EMAIL is empty).');
      }
      const mail = buildTestMail({ version: VERSION, publicBaseUrl: ctx.cfg.publicBaseUrl });
      const result = await ctx.mailer.sendMail(mail.subject, mail.text);
      if (!result.success) {
        logger.warn(`Test email failed: ${result.error}`);
        throw ApiError.internal(`Failed to send test email: ${result.error}`);
      }
      logger.info('Test email sent to the configured notification address.');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
