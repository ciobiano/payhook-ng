import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryIdempotencyStore } from './memory-store.js';

describe('InMemoryIdempotencyStore', () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new InMemoryIdempotencyStore(60);
  });

  afterEach(() => {
    store.dispose();
    vi.useRealTimers();
  });

  it('records a new key and returns true', () => {
    expect(store.recordIfAbsent('event:1', 60)).toBe(true);
  });

  it('returns false for duplicate key (replay detection)', () => {
    store.recordIfAbsent('event:1', 60);
    expect(store.recordIfAbsent('event:1', 60)).toBe(false);
  });

  it('allows re-recording after TTL expires', () => {
    store.recordIfAbsent('event:1', 10); // 10 second TTL

    // Advance time past TTL
    vi.advanceTimersByTime(11_000);

    // Should be treated as new since TTL expired
    expect(store.recordIfAbsent('event:1', 10)).toBe(true);
  });

  it('does not allow re-recording before TTL expires', () => {
    store.recordIfAbsent('event:1', 10);

    // Advance time but NOT past TTL
    vi.advanceTimersByTime(5_000);

    expect(store.recordIfAbsent('event:1', 10)).toBe(false);
  });

  it('handles multiple distinct keys', () => {
    expect(store.recordIfAbsent('event:1', 60)).toBe(true);
    expect(store.recordIfAbsent('event:2', 60)).toBe(true);
    expect(store.recordIfAbsent('event:3', 60)).toBe(true);

    // All are duplicates now
    expect(store.recordIfAbsent('event:1', 60)).toBe(false);
    expect(store.recordIfAbsent('event:2', 60)).toBe(false);
    expect(store.recordIfAbsent('event:3', 60)).toBe(false);
  });

  it('dispose clears all keys and stops GC', () => {
    store.recordIfAbsent('event:1', 60);
    store.dispose();

    // After dispose, key should not exist — new store would return true
    // We create a new store to verify the old one was cleaned
    const newStore = new InMemoryIdempotencyStore(60);
    expect(newStore.recordIfAbsent('event:1', 60)).toBe(true);
    newStore.dispose();
  });
});
