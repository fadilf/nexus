/**
 * Async write-lock utilities for serializing file writes.
 *
 * Two flavors:
 * - `createWriteLock()` — single global lock (e.g. one config file)
 * - `createKeyedWriteLock()` — per-key locks (e.g. per-thread files)
 */

/** A single async write lock that serializes calls to `fn`. */
export function createWriteLock(): <T>(fn: () => Promise<T>) => Promise<T> {
  let lock: Promise<void> = Promise.resolve();

  return function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = lock;
    const next = prev.then(fn, fn);
    lock = next.then(
      () => {},
      () => {}
    );
    return next;
  };
}

/** Per-key async write locks (e.g. one lock per thread ID). */
export function createKeyedWriteLock(): <T>(key: string, fn: () => Promise<T>) => Promise<T> {
  const locks = new Map<string, Promise<void>>();

  return function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = locks.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    locks.set(
      key,
      next.then(
        () => {},
        () => {}
      )
    );
    return next;
  };
}
