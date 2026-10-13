/**
 * version.ts
 *
 * The app version, read once from package.json. Works from both src/ and
 * dist/ because the relative depth to the project root is the same.
 */
import { createRequire } from 'node:module';

export const VERSION = (
  createRequire(import.meta.url)('../../package.json') as { version: string }
).version;
