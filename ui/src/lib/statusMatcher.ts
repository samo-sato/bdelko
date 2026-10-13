/**
 * statusMatcher.ts
 *
 * COPY of the backend's src/utils/statusMatcher.ts (keep in sync!). Used for
 * live client-side validation of the expected_status field; the server remains
 * the authority and re-validates on save.
 *
 * Item syntax (comma-separated): exact "200", wildcard "2xx" / "30x"
 * (digit-wise match, x = any digit), range "200-299". Codes 100-599.
 */

export type StatusItem =
  | { kind: 'exact'; code: number }
  | { kind: 'pattern'; pattern: string }
  | { kind: 'range'; low: number; high: number };

const CODE_MIN = 100;
const CODE_MAX = 599;

function isValidCode(n: number): boolean {
  return Number.isInteger(n) && n >= CODE_MIN && n <= CODE_MAX;
}

function parseItem(raw: string): StatusItem {
  const item = raw.trim().toLowerCase();
  if (item === '') throw new Error('Empty item in expected_status');

  const rangeMatch = /^(\d{3})-(\d{3})$/.exec(item);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    if (!isValidCode(low) || !isValidCode(high)) {
      throw new Error(`Range "${item}": codes must be between ${CODE_MIN} and ${CODE_MAX}`);
    }
    if (low > high) throw new Error(`Range "${item}": lower bound must be <= upper bound`);
    return { kind: 'range', low, high };
  }

  if (/^[1-5][0-9x]{2}$/.test(item) && item.includes('x')) {
    return { kind: 'pattern', pattern: item };
  }

  if (/^\d{3}$/.test(item)) {
    const code = parseInt(item, 10);
    if (!isValidCode(code)) {
      throw new Error(`Code "${item}": must be between ${CODE_MIN} and ${CODE_MAX}`);
    }
    return { kind: 'exact', code };
  }

  throw new Error(
    `Invalid item "${raw.trim()}": use an exact code ("200"), a wildcard ("2xx") or a range ("200-299")`,
  );
}

export function parseExpectedStatus(spec: string): StatusItem[] {
  const items = spec.split(',').map(parseItem);
  if (items.length === 0) throw new Error('expected_status must contain at least one item');
  return items;
}

export function isValidExpectedStatus(spec: string): boolean {
  try {
    parseExpectedStatus(spec);
    return true;
  } catch {
    return false;
  }
}

/** Normalize for storage: strip spaces, lowercase X -> x, join with ",". */
export function normalizeExpectedStatus(spec: string): string {
  parseExpectedStatus(spec);
  return spec
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .join(',');
}

export function matchesExpectedStatus(spec: string, code: number): boolean {
  let items: StatusItem[];
  try {
    items = parseExpectedStatus(spec);
  } catch {
    return false;
  }
  const codeStr = String(code);
  return items.some((item) => {
    switch (item.kind) {
      case 'exact':
        return item.code === code;
      case 'range':
        return code >= item.low && code <= item.high;
      case 'pattern':
        if (codeStr.length !== 3) return false;
        for (let i = 0; i < 3; i++) {
          if (item.pattern[i] !== 'x' && item.pattern[i] !== codeStr[i]) return false;
        }
        return true;
    }
  });
}
