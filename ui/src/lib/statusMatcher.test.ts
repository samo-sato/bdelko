import { describe, expect, it } from 'vitest';
import {
  isValidExpectedStatus,
  matchesExpectedStatus,
  normalizeExpectedStatus,
} from './statusMatcher';

describe('statusMatcher validation', () => {
  it('accepts exact codes, wildcards and ranges', () => {
    expect(isValidExpectedStatus('200')).toBe(true);
    expect(isValidExpectedStatus('2xx')).toBe(true);
    expect(isValidExpectedStatus('30x')).toBe(true);
    expect(isValidExpectedStatus('200-299')).toBe(true);
    expect(isValidExpectedStatus('200,301')).toBe(true);
    expect(isValidExpectedStatus('200-299,304')).toBe(true);
  });

  it('rejects out-of-range codes and garbage', () => {
    expect(isValidExpectedStatus('99')).toBe(false); // only 3-digit items
    expect(isValidExpectedStatus('099')).toBe(false); // below 100
    expect(isValidExpectedStatus('600')).toBe(false); // above 599
    expect(isValidExpectedStatus('999')).toBe(false);
    expect(isValidExpectedStatus('300-200')).toBe(false); // inverted range
    expect(isValidExpectedStatus('abc')).toBe(false);
    expect(isValidExpectedStatus('')).toBe(false);
    expect(isValidExpectedStatus('2xx,')).toBe(false); // empty item
    expect(isValidExpectedStatus('xxx')).toBe(false); // first char must be a digit 1-5
  });
});

describe('statusMatcher matching', () => {
  it('matches exact codes', () => {
    expect(matchesExpectedStatus('200', 200)).toBe(true);
    expect(matchesExpectedStatus('200', 201)).toBe(false);
  });

  it('matches wildcards digit-wise', () => {
    expect(matchesExpectedStatus('2xx', 200)).toBe(true);
    expect(matchesExpectedStatus('2xx', 299)).toBe(true);
    expect(matchesExpectedStatus('2xx', 301)).toBe(false);
    expect(matchesExpectedStatus('30x', 301)).toBe(true);
    expect(matchesExpectedStatus('30x', 310)).toBe(false);
  });

  it('matches ranges and combined specs', () => {
    expect(matchesExpectedStatus('200-299,304', 250)).toBe(true);
    expect(matchesExpectedStatus('200-299,304', 304)).toBe(true);
    expect(matchesExpectedStatus('200-299,304', 301)).toBe(false);
  });
});

describe('statusMatcher normalization', () => {
  it('strips spaces and lowercases X', () => {
    expect(normalizeExpectedStatus(' 2XX , 304 ')).toBe('2xx,304');
    expect(normalizeExpectedStatus('200-299 , 301')).toBe('200-299,301');
    // internal spaces inside an item are rejected (same as the backend)
    expect(isValidExpectedStatus('200 - 299')).toBe(false);
  });
});
