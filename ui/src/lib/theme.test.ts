import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, parseHHmm, resolveTheme, type ThemeSettings } from '../settings/theme';

const at = (h: number, min = 0) => new Date(2026, 9, 12, h, min); // local time
const settings = (over: Partial<ThemeSettings> = {}): ThemeSettings => ({
  ...DEFAULT_THEME,
  ...over,
});

describe('parseHHmm', () => {
  it('parses valid times, rejects invalid ones', () => {
    expect(parseHHmm('19:00')).toBe(19 * 60);
    expect(parseHHmm('07:30')).toBe(7 * 60 + 30);
    expect(parseHHmm('24:00')).toBeNull();
    expect(parseHHmm('19:60')).toBeNull();
    expect(parseHHmm('7:00')).toBeNull(); // must be HH:mm
    expect(parseHHmm('junk')).toBeNull();
  });
});

describe('resolveTheme', () => {
  it('manual modes always win', () => {
    expect(resolveTheme(at(3), settings({ mode: 'dark' }))).toBe('dark');
    expect(resolveTheme(at(22), settings({ mode: 'light' }))).toBe('light');
  });

  it('auto with a window wrapping past midnight (19:00 - 07:00)', () => {
    const s = settings({ mode: 'auto' }); // defaults 19:00 / 07:00
    expect(resolveTheme(at(18, 59), s)).toBe('light');
    expect(resolveTheme(at(19, 0), s)).toBe('dark'); // inclusive start
    expect(resolveTheme(at(23, 59), s)).toBe('dark');
    expect(resolveTheme(at(0, 0), s)).toBe('dark');
    expect(resolveTheme(at(6, 59), s)).toBe('dark');
    expect(resolveTheme(at(7, 0), s)).toBe('light'); // exclusive end
    expect(resolveTheme(at(12), s)).toBe('light');
  });

  it('auto with a same-day dark window (08:00 - 17:00)', () => {
    const s = settings({ mode: 'auto', autoDarkFrom: '08:00', autoLightFrom: '17:00' });
    expect(resolveTheme(at(7, 59), s)).toBe('light');
    expect(resolveTheme(at(8), s)).toBe('dark');
    expect(resolveTheme(at(16, 59), s)).toBe('dark');
    expect(resolveTheme(at(17), s)).toBe('light');
  });

  it('equal times resolve to light', () => {
    const s = settings({ mode: 'auto', autoDarkFrom: '19:00', autoLightFrom: '19:00' });
    expect(resolveTheme(at(19), s)).toBe('light');
    expect(resolveTheme(at(3), s)).toBe('light');
  });

  it('invalid stored times fall back to the defaults', () => {
    const s = settings({ mode: 'auto', autoDarkFrom: 'bad', autoLightFrom: 'also bad' });
    expect(resolveTheme(at(22), s)).toBe('dark'); // default 19:00-07:00
    expect(resolveTheme(at(12), s)).toBe('light');
  });
});
