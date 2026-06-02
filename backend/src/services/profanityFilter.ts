/**
 * Profanity filter for user-supplied rock nicknames.
 *
 * Three-layer defense:
 *   1. Structural sanitization — strip dangerous chars, enforce length.
 *   2. Leet-speak normalization — convert 1→i, 3→e, etc. before checking.
 *   3. bad-words library check — run against both the original and normalized text,
 *      and again with spaces removed (catches "f u c k" style spacing tricks).
 *
 * Returns a { clean, isProfane } object. If isProfane is true, the API
 * should reject the name with a 400 and a user-friendly message.
 *
 * SQL injection is NOT handled here — use parameterized queries everywhere
 * (better-sqlite3 does this automatically when you use ? placeholders).
 */

// bad-words ships no type declarations; require() with an inline cast is the
// idiomatic CJS TypeScript pattern for untyped packages.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BadWordsFilter = require('bad-words') as new () => {
  isProfane(text: string): boolean;
  addWords(...words: string[]): void;
};

const filter = new BadWordsFilter();

/**
 * Common leet-speak substitutions to check.
 * We normalize before running through the word list so "4ss" → "ass" is caught.
 */
const LEET_MAP: [RegExp, string][] = [
  [/1/g, 'i'],
  [/3/g, 'e'],
  [/4/g, 'a'],
  [/5/g, 's'],
  [/6/g, 'b'],   // "6itch"
  [/0/g, 'o'],
  [/@/g, 'a'],
  [/\$/g, 's'],
  [/!/g, 'i'],
  [/7/g, 't'],
  [/\|/g, 'l'],
  [/\+/g, 't'],
  [/\(/g, 'c'],  // "(ock"
];

/** Maximum characters allowed in a nickname. */
const MAX_LENGTH = 40;

/** Characters that could be used in HTML or template injection — strip these. */
const DANGEROUS_CHARS = /[<>"'`\\;]/g;

function normalizeLeetSpeak(text: string): string {
  let normalized = text.toLowerCase();
  for (const [pattern, replacement] of LEET_MAP) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

export interface FilterResult {
  /** The sanitized, safe nickname (empty string if isProfane). */
  clean: string;
  isProfane: boolean;
}

/**
 * Validates and sanitizes a user-supplied rock nickname.
 *
 * @param raw - The raw string as typed by the user.
 * @returns { clean, isProfane }
 */
export function filterNickname(raw: string): FilterResult {
  if (!raw || typeof raw !== 'string') {
    return { clean: '', isProfane: false };
  }

  // Step 1: Structural sanitization.
  const sanitized = raw
    .trim()
    .substring(0, MAX_LENGTH)           // cap length
    .replace(DANGEROUS_CHARS, '');      // remove injection-risky chars

  if (sanitized.length === 0) {
    return { clean: '', isProfane: false };
  }

  // Step 2: Build normalized variants to check.
  const lower = sanitized.toLowerCase();
  const noSpaces = lower.replace(/\s+/g, '');         // "f u c k" → "fuck"
  const leet = normalizeLeetSpeak(lower);              // "4ss" → "ass"
  const leetNoSpaces = leet.replace(/\s+/g, '');

  // Step 3: Check all variants.
  const variants = [sanitized, lower, noSpaces, leet, leetNoSpaces];
  for (const v of variants) {
    if (v.length > 0 && filter.isProfane(v)) {
      return { clean: '', isProfane: true };
    }
  }

  return { clean: sanitized, isProfane: false };
}
