import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryIdempotencyStore } from '../../security/memory-store.js';

describe('InMemoryIdempotencyStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return false for unknown key', () => {
    const store = new InMemoryIdempotencyStore();
    expect(store.exists('unknown-key')).toBe(false);
  });

  it('should return true after recording a key', () => {
    const store = new InMemoryIdempotencyStore();
    store.record('event-1', 600);
    expect(store.exists('event-1')).toBe(true);
  });

  it('should return false after TTL expires', () => {
    const store = new InMemoryIdempotencyStore();
    store.record('event-2', 60); // 60 second TTL

    // Advance time by 61 seconds
    vi.advanceTimersByTime(61_000);

    expect(store.exists('event-2')).toBe(false);
  });

  it('should return true before TTL expires', () => {
    const store = new InMemoryIdempotencyStore();
    store.record('event-3', 60);

    // Advance time by 30 seconds (still within TTL)
    vi.advanceTimersByTime(30_000);

    expect(store.exists('event-3')).toBe(true);
  });

  it('should handle multiple keys independently', () => {
    const store = new InMemoryIdempotencyStore();
    store.record('event-a', 30);
    store.record('event-b', 120);

    // After 31 seconds, event-a should expire but event-b should remain
    vi.advanceTimersByTime(31_000);

    expect(store.exists('event-a')).toBe(false);
    expect(store.exists('event-b')).toBe(true);
  });

  it('should cleanup expired entries via garbage collection', () => {
    // GC runs every 10 seconds in this test
    const store = new InMemoryIdempotencyStore(10);
    store.record('gc-test', 5); // 5 second TTL

    // Advance past TTL + GC interval to trigger cleanup
    vi.advanceTimersByTime(15_000);

    expect(store.exists('gc-test')).toBe(false);
  });
});
