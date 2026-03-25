import { describe, it, expect } from "vitest";
import { createWriteLock, createKeyedWriteLock } from "../write-lock";

describe("createWriteLock", () => {
  it("serializes concurrent operations", async () => {
    const withLock = createWriteLock();
    const order: number[] = [];

    const p1 = withLock(async () => {
      await delay(30);
      order.push(1);
      return "a";
    });
    const p2 = withLock(async () => {
      order.push(2);
      return "b";
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe("a");
    expect(r2).toBe("b");
    expect(order).toEqual([1, 2]); // p1 completes before p2 starts
  });

  it("continues after a failed operation", async () => {
    const withLock = createWriteLock();

    const p1 = withLock(async () => {
      throw new Error("fail");
    });

    await expect(p1).rejects.toThrow("fail");

    // Subsequent lock acquisition should still work
    const result = await withLock(async () => "ok");
    expect(result).toBe("ok");
  });
});

describe("createKeyedWriteLock", () => {
  it("serializes operations on the same key", async () => {
    const withLock = createKeyedWriteLock();
    const order: string[] = [];

    const p1 = withLock("k1", async () => {
      await delay(30);
      order.push("k1-first");
    });
    const p2 = withLock("k1", async () => {
      order.push("k1-second");
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual(["k1-first", "k1-second"]);
  });

  it("allows concurrent operations on different keys", async () => {
    const withLock = createKeyedWriteLock();
    const order: string[] = [];

    const p1 = withLock("k1", async () => {
      await delay(30);
      order.push("k1");
    });
    const p2 = withLock("k2", async () => {
      order.push("k2");
    });

    await Promise.all([p1, p2]);
    // k2 should complete before k1 since they're independent
    expect(order).toEqual(["k2", "k1"]);
  });

  it("continues after a failed operation on a key", async () => {
    const withLock = createKeyedWriteLock();

    const p1 = withLock("k1", async () => {
      throw new Error("fail");
    });

    await expect(p1).rejects.toThrow("fail");

    const result = await withLock("k1", async () => "recovered");
    expect(result).toBe("recovered");
  });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
