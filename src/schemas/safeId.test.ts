import { describe, expect, it } from 'vitest';
import { SafeIdSchema } from './safeId';

const valid = ['level_01', 'fighter-alpha', 'A1', 'asset_123'];
const invalid = [
  '',
  '.',
  '..',
  '../escape',
  '..\\escape',
  '/absolute',
  'C:\\absolute',
  'has space',
  'line\nbreak',
  'semi:semicolon',
  '%2e%2e%2fescape',
  'slash%2Fescape',
  '_leading',
  '-leading',
];

describe('SafeIdSchema', () => {
  it.each(valid)('accepts %s', (value) => {
    expect(SafeIdSchema.parse(value)).toBe(value);
  });

  it.each(invalid)('rejects %s', (value) => {
    expect(SafeIdSchema.safeParse(value).success).toBe(false);
  });
});
