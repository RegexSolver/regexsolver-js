export class RateLimiter {
    private isBlocked = false;
    private blockPromise: Promise<void> | null = null;
    private blockTimeout: NodeJS.Timeout | null = null;

    async wait(): Promise<void> {
        if (this.isBlocked && this.blockPromise) {
            await this.blockPromise;
        }
    }

    trigger(retryAfterSeconds: number): void {
        if (this.isBlocked) {
            return;
        }

        this.isBlocked = true;
        const waitTime = retryAfterSeconds * 1000;

        let resolveBlock: () => void;
        this.blockPromise = new Promise((resolve) => {
            resolveBlock = resolve;
        });

        if (this.blockTimeout) {
            clearTimeout(this.blockTimeout);
        }

        this.blockTimeout = setTimeout(() => {
            this.isBlocked = false;
            this.blockPromise = null;
            this.blockTimeout = null;
            resolveBlock();
        }, waitTime);
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
