#!/usr/bin/env node
// Prints a random 48-character URL-safe token suitable for BDELKO_API_TOKEN.
// Usage: npm run gen:token
import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

export function generateToken(length = 48) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

console.log(generateToken(48));
