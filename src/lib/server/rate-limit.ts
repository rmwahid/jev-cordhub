/**
 * Guards on the search endpoint.
 *
 * Every search costs real money at the model vendor, which changes what abuse
 * means here. On an ordinary API the worst case is wasted bandwidth; here a
 * stranger who finds the URL can spend somebody else's balance. Two limits
 * cover the two shapes of that: one caller hammering, and many callers slowly.
 *
 * Both live in process memory, and that is a deliberate trade rather than an
 * oversight. A shared store would mean a dependency and a network hop on every
 * search, to defend a tool used by four people against a threat a per-process
 * limit already makes pointless. The cost is that state resets on restart and
 * does not coordinate across instances. Moving to more than one instance is the
 * moment to move this to a shared store, not before.
 */

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	/** Milliseconds until the caller may retry. Zero when allowed. */
	retryAfterMs: number;
}

/** Above this many tracked callers, drop the ones whose window has emptied. */
const SWEEP_THRESHOLD = 5000;

/** Sliding window over the timestamps of recent calls, per caller. */
export class SlidingWindowLimiter {
	private readonly hits = new Map<string, number[]>();

	constructor(
		private readonly limit: number,
		private readonly windowMs: number
	) {}

	check(key: string, now: number = Date.now()): RateLimitResult {
		// A limit of zero or less means the guard is switched off on purpose.
		if (this.limit <= 0) return { allowed: true, remaining: Number.POSITIVE_INFINITY, retryAfterMs: 0 };

		if (this.hits.size > SWEEP_THRESHOLD) this.sweep(now);

		const cutoff = now - this.windowMs;
		const recent = (this.hits.get(key) ?? []).filter((at) => at > cutoff);

		if (recent.length >= this.limit) {
			this.hits.set(key, recent);
			const oldest = recent[0];
			return { allowed: false, remaining: 0, retryAfterMs: Math.max(1, oldest + this.windowMs - now) };
		}

		recent.push(now);
		this.hits.set(key, recent);
		return { allowed: true, remaining: this.limit - recent.length, retryAfterMs: 0 };
	}

	/** Forget callers whose window no longer holds anything, so the map cannot grow forever. */
	private sweep(now: number): void {
		const cutoff = now - this.windowMs;
		for (const [key, times] of this.hits) {
			if (!times.some((at) => at > cutoff)) this.hits.delete(key);
		}
	}

	/** For tests, and for asserting that the sweep actually runs. */
	get trackedCallers(): number {
		return this.hits.size;
	}
}

/**
 * A ceiling on the whole day, across every caller.
 *
 * The per-caller limit bounds what one abuser can spend; this bounds what the
 * deployment can spend in total, which is the number that matters when the
 * account has a balance. Resets at UTC midnight. A refused day is loud on
 * purpose: quietly serving worse answers to stay under budget would be worse
 * than saying no.
 */
export class DailyCounter {
	private dayKey = '';
	private used = 0;

	constructor(private readonly cap: number) {}

	check(now: number = Date.now()): { allowed: boolean; used: number; cap: number } {
		const key = new Date(now).toISOString().slice(0, 10);
		if (key !== this.dayKey) {
			this.dayKey = key;
			this.used = 0;
		}

		if (this.cap <= 0) return { allowed: true, used: this.used, cap: this.cap };
		if (this.used >= this.cap) return { allowed: false, used: this.used, cap: this.cap };

		this.used++;
		return { allowed: true, used: this.used, cap: this.cap };
	}
}

/** Parse a positive integer setting, falling back when it is missing or nonsense. */
export function positiveInt(value: string | undefined, fallback: number): number {
	if (value === undefined) return fallback;
	const parsed = Number(value.trim());
	if (!Number.isFinite(parsed) || parsed < 0) return fallback;
	return Math.floor(parsed);
}
