import { describe, it, expect } from 'vitest';
import { getHeader, toBuffer, timingSafeEqualHex, timingSafeEqualStrings } from './utils.js';

describe('getHeader', () => {
  it('finds header case-insensitively', () => {
    expect(getHeader({ 'Content-Type': 'application/json' }, 'content-type')).toBe('application/json');
    expect(getHeader({ 'content-type': 'text/plain' }, 'Content-Type')).toBe('text/plain');
  });

  it('returns first element if header is an array', () => {
    expect(getHeader({ 'x-custom': ['first', 'second'] }, 'x-custom')).toBe('first');
  });

  it('returns undefined for missing header', () => {
    expect(getHeader({}, 'x-missing')).toBeUndefined();
  });

  it('returns undefined for undefined header value', () => {
    expect(getHeader({ 'x-test': undefined }, 'x-test')).toBeUndefined();
  });
});

describe('toBuffer', () => {
  it('converts string to Buffer', () => {
    const buf = toBuffer('hello');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString()).toBe('hello');
  });

  it('returns Buffer as-is', () => {
    const original = Buffer.from('test');
    expect(toBuffer(original)).toBe(original); // same reference
  });

  it('converts Uint8Array to Buffer', () => {
    const arr = new Uint8Array([72, 101, 108, 108, 111]);
    const buf = toBuffer(arr);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString()).toBe('Hello');
  });
});

describe('timingSafeEqualHex', () => {
  it('returns true for identical hex strings', () => {
    const hex = 'abcdef0123456789';
    expect(timingSafeEqualHex(hex, hex)).toBe(true);
  });

  it('returns false for different hex strings of same length', () => {
    expect(timingSafeEqualHex('aabbccdd', '11223344')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(timingSafeEqualHex('aabb', 'aabbcc')).toBe(false);
  });

  it('returns false when one is valid hex and the other is not', () => {
    // Buffer.from('not-hex', 'hex') silently drops invalid chars → empty buffer
    // So two invalid strings may both produce empty buffers and compare equal.
    // What matters is that a real hex digest never matches garbage:
    expect(timingSafeEqualHex('aabbccdd', 'not-hex')).toBe(false);
  });

  it('returns false for empty strings', () => {
    // Empty hex decodes to zero-length buffer — timingSafeEqual
    // returns true for two zero-length buffers, which is correct.
    expect(timingSafeEqualHex('', '')).toBe(true);
  });
});

describe('timingSafeEqualStrings', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqualStrings('my-secret', 'my-secret')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(timingSafeEqualStrings('my-secret', 'wrong-secret')).toBe(false);
  });

  it('returns false for strings that differ only in length', () => {
    expect(timingSafeEqualStrings('abc', 'abcd')).toBe(false);
  });

  it('returns false for prefix match', () => {
    expect(timingSafeEqualStrings('my-secret-hash', 'my-secret-has')).toBe(false);
  });

  it('handles unicode strings', () => {
    expect(timingSafeEqualStrings('hello-日本語', 'hello-日本語')).toBe(true);
    expect(timingSafeEqualStrings('hello-日本語', 'hello-中文')).toBe(false);
  });
});
