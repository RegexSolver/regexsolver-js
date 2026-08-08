import { RateLimiter } from "../src/RateLimiter";

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  test("wait should resolve immediately if not blocked", async () => {
    const start = Date.now();
    await rateLimiter.wait();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(50);
  });

  test("trigger should block wait", async () => {
    const retryAfter = 0.1; // 100ms
    rateLimiter.trigger(retryAfter);

    const start = Date.now();
    await rateLimiter.wait();
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(100);
    expect(duration).toBeLessThan(150);
  });

  test("a shorter retry-after never shrinks the pending deadline", async () => {
    rateLimiter.trigger(0.2);
    rateLimiter.trigger(0.1); // must not shorten the 200ms deadline

    const start = Date.now();
    await rateLimiter.wait();
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(190);
    expect(duration).toBeLessThan(250);
  });

  test("a longer retry-after arriving while blocked extends the deadline", async () => {
    rateLimiter.trigger(0.1);
    rateLimiter.trigger(0.2); // the later deadline wins

    const start = Date.now();
    await rateLimiter.wait();
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(190);
  });

  test("a deadline extended while waiting is honored", async () => {
    rateLimiter.trigger(0.1);

    const start = Date.now();
    const waiter = rateLimiter.wait();
    setTimeout(() => rateLimiter.trigger(0.2), 50);
    await waiter;
    const duration = Date.now() - start;

    // The waiter woke at the original deadline, re-checked, and slept again.
    expect(duration).toBeGreaterThanOrEqual(240);
  });

  test("concurrent waits should all resolve after block is lifted", async () => {
    const retryAfter = 0.1; // 100ms
    rateLimiter.trigger(retryAfter);

    const start = Date.now();
    const p1 = rateLimiter.wait();
    const p2 = rateLimiter.wait();
    const p3 = rateLimiter.wait();

    await Promise.all([p1, p2, p3]);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(100);
  });
});
