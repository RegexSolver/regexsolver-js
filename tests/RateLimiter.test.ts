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

  test("multiple triggers should be ignored while blocked", async () => {
    const retryAfter1 = 0.2; // 200ms
    const retryAfter2 = 0.1; // 100ms

    rateLimiter.trigger(retryAfter1);
    rateLimiter.trigger(retryAfter2); // Should be ignored

    const start = Date.now();
    await rateLimiter.wait();
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(200);
    expect(duration).toBeLessThan(250);
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
