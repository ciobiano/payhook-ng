import crypto from 'node:crypto';
import type { HttpHeaders } from './types.js';

/**
 * Convert any supported raw body type to a Node.js Buffer.
 *
 * Why Buffer specifically? Because `crypto.createHmac().update()` needs it,
 * and `.toString('utf8')` on Buffer is the most reliable way to get the
 * original string back without encoding surprises.
 */
export function toBuffer(rawBody: string | Buffer | Uint8Array): Buffer {
  if (typeof rawBody === 'string') return Buffer.from(rawBody, 'utf8');
  if (Buffer.isBuffer(rawBody)) return rawBody;
  return Buffer.from(rawBody);
}

/**
 * Case-insensitive header lookup.
 *
 * HTTP headers are case-insensitive per RFC 7230, but JavaScript objects
 * are case-sensitive. Express lowercases headers automatically, but the
 * Web Fetch API (used by Next.js App Router) preserves original casing.
 * We normalize to handle both.
 */
export function getHeader(headers: HttpHeaders, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== target) continue;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v[0];
    return undefined;
  }
  return undefined;
}

/**
 * Timing-safe comparison for hex-encoded strings (e.g., HMAC digests).
 *
 * Why not just `===`? Because === short-circuits on the first differing byte.
 * An attacker measuring response times can determine how many leading bytes
 * matched, then brute-force the rest one byte at a time.
 *
 * `crypto.timingSafeEqual` compares ALL bytes in constant time regardless
 * of where they differ. No information leaks through timing.
 */
export function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Timing-safe comparison for plain UTF-8 strings (e.g., Flutterwave secret hash).
 *
 * Same principle as timingSafeEqualHex, but for arbitrary strings rather than
 * hex-encoded digests. We pad the shorter buffer with zeros so both are the
 * same length — timingSafeEqual requires equal-length buffers.
 *
 * The length check before the constant-time comparison does leak whether the
 * lengths match, but that's unavoidable and far less useful to an attacker
 * than leaking character-by-character match positions.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}
