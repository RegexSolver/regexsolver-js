/**
 * Shared across all client instances with the same API token.
 *
 * Holds a single deadline timestamp. `trigger` keeps the later of the current
 * and the new deadline, so a longer `Retry-After` arriving while the limiter
 * is already engaged is never dropped. `wait` sleeps until the deadline and
 * re-checks it after every wake, so a deadline extended by a concurrent 429
 * is honored too.
 */
export class RateLimiter {
  private deadline = 0;

  async wait(): Promise<void> {
    while (Date.now() < this.deadline) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.deadline - Date.now()),
      );
    }
  }

  trigger(retryAfterSeconds: number): void {
    this.deadline = Math.max(
      this.deadline,
      Date.now() + retryAfterSeconds * 1000,
    );
  }
}

const rateLimiters = new Map<string, RateLimiter>();

export function getRateLimiter(apiToken: string): RateLimiter {
  let limiter = rateLimiters.get(apiToken);
  if (!limiter) {
    limiter = new RateLimiter();
    rateLimiters.set(apiToken, limiter);
  }
  return limiter;
}
