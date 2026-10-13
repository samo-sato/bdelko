/**
 * statusMatcher.ts
 *
 * Parses, validates, normalizes and matches the `expected_status` spec of an
 * active Watchdog. Supported item syntax (comma-separated):
 *   - exact code:   "200"
 *   - wildcard:     "2xx" (any 200-299), "30x" (any 300-309), digit-wise match
 *   - range:        "200-299"
 * Codes must be within 100-599. Example combined spec: "200-299,304".
 */

export type StatusItem =
  | { kind: 'exact'; code: number }
  | { kind: 'pattern'; pattern: string } // 3 chars, each a digit or 'x'
  | { kind: 'range'; low: number; high: number };

const CODE_MIN = 100;
const CODE_MAX = 599;

function isValidCode(n: number): boolean {
  return Number.isInteger(n) && n >= CODE_MIN && n <= CODE_MAX;
}

/** Parse a single comma-separated item into a StatusItem. Throws Error with a readable message. */
function parseItem(raw: string): StatusItem {
  const item = raw.trim().toLowerCase();
  if (item === '') {
    throw new Error('Empty item in expected_status');
  }

  // Range: "200-299"
  const rangeMatch = /^(\d{3})-(\d{3})$/.exec(item);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    if (!isValidCode(low) || !isValidCode(high)) {
      throw new Error(`Range "${item}": codes must be between ${CODE_MIN} and ${CODE_MAX}`);
    }
    if (low > high) {
      throw new Error(`Range "${item}": lower bound must be <= upper bound`);
    }
    return { kind: 'range', low, high };
  }

  // Wildcard pattern: "2xx", "30x", possibly "2x3" - 3 chars, first a digit 1-5, at least one x.
  if (/^[1-5][0-9x]{2}$/.test(item) && item.includes('x')) {
    return { kind: 'pattern', pattern: item };
  }

  // Exact: "200"
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

/** Parse a full expected_status spec into items. Throws on invalid input. */
export function parseExpectedStatus(spec: string): StatusItem[] {
  const items = spec.split(',').map(parseItem);
  if (items.length === 0) {
    throw new Error('expected_status must contain at least one item');
  }
  return items;
}

/** Returns true when the spec is syntactically valid. */
export function isValidExpectedStatus(spec: string): boolean {
  try {
    parseExpectedStatus(spec);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a spec for storage: strip whitespace, lowercase "X" -> "x",
 * join items with ",". Throws when invalid (message is user-presentable).
 */
export function normalizeExpectedStatus(spec: string): string {
  parseExpectedStatus(spec); // validation pass (throws with details)
  return spec
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .join(',');
}

/** True when the HTTP status code matches any item of the spec. */
export function matchesExpectedStatus(spec: string, code: number): boolean {
  let items: StatusItem[];
  try {
    items = parseExpectedStatus(spec);
  } catch {
    return false; // a broken spec matches nothing; validated at the API layer
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
