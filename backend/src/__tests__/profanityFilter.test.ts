/**
 * Tests for the profanity filter.
 *
 * Covers:
 *   - Clean nicknames that should pass
 *   - Direct profanity that should be blocked
 *   - Leet-speak substitutions that should be blocked
 *   - Space-padding tricks ("f u c k") that should be blocked
 *   - HTML/SQL-injectable characters that should be stripped
 *   - Edge cases: empty string, whitespace-only, too long
 */

import { filterNickname } from '../services/profanityFilter';

describe('filterNickname — clean inputs', () => {
  test('returns empty string for empty input', () => {
    expect(filterNickname('').clean).toBe('');
    expect(filterNickname('').isProfane).toBe(false);
  });

  test('trims whitespace', () => {
    const { clean, isProfane } = filterNickname('  Sparkles  ');
    expect(clean).toBe('Sparkles');
    expect(isProfane).toBe(false);
  });

  test('allows normal rock names', () => {
    const names = ['Rocky', 'Pebble', 'Granite Jr.', 'My Cool Rock', 'no. 42'];
    for (const name of names) {
      const { isProfane } = filterNickname(name);
      expect(isProfane).toBe(false);
    }
  });

  test('allows short and long (but ≤40 char) names', () => {
    expect(filterNickname('X').clean).toBe('X');
    const longName = 'A'.repeat(40);
    expect(filterNickname(longName).clean).toBe(longName);
  });

  test('truncates names longer than 40 chars', () => {
    const tooLong = 'A'.repeat(50);
    const { clean } = filterNickname(tooLong);
    expect(clean.length).toBeLessThanOrEqual(40);
  });
});

describe('filterNickname — HTML/injection characters', () => {
  test('strips angle brackets', () => {
    const { clean } = filterNickname('<script>alert(1)</script>');
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('>');
  });

  test('strips double quotes', () => {
    const { clean } = filterNickname('say "hello"');
    expect(clean).not.toContain('"');
  });

  test('strips backticks', () => {
    const { clean } = filterNickname('rock`s');
    expect(clean).not.toContain('`');
  });

  test('strips single quotes', () => {
    const { clean } = filterNickname("rock's");
    expect(clean).not.toContain("'");
  });

  test('strips semicolons', () => {
    const { clean } = filterNickname('x; DROP TABLE rocks');
    expect(clean).not.toContain(';');
  });
});

describe('filterNickname — profanity detection', () => {
  // We test the *behavior* (is filtering happening?) not specific blocked words,
  // because word lists evolve and embedding slurs in test files is bad practice.
  // Instead we verify that the filter works on a known word from the bad-words list.

  const knownBadWord = 'ass'; // mild, widely used in word lists, safe to name in test

  test('blocks direct profanity', () => {
    const { isProfane } = filterNickname(knownBadWord);
    expect(isProfane).toBe(true);
  });

  test('blocks profanity with padding spaces', () => {
    const spaced = 'a s s';
    const { isProfane } = filterNickname(spaced);
    expect(isProfane).toBe(true);
  });

  test('blocks leet-speak substitutions', () => {
    const leet = '4ss'; // a→4
    const { isProfane } = filterNickname(leet);
    expect(isProfane).toBe(true);
  });

  test('returns empty clean string when profane', () => {
    const { clean, isProfane } = filterNickname(knownBadWord);
    expect(isProfane).toBe(true);
    expect(clean).toBe('');
  });
});

describe('filterNickname — null / undefined guard', () => {
  test('handles undefined gracefully', () => {
    // TypeScript protects callers, but test the runtime behaviour
    // in case this is called from JS context.
    const result = filterNickname(undefined as unknown as string);
    expect(result.isProfane).toBe(false);
    expect(result.clean).toBe('');
  });

  test('handles null gracefully', () => {
    const result = filterNickname(null as unknown as string);
    expect(result.isProfane).toBe(false);
    expect(result.clean).toBe('');
  });

  test('handles whitespace-only string', () => {
    const result = filterNickname('   ');
    expect(result.clean).toBe('');
    expect(result.isProfane).toBe(false);
  });
});
