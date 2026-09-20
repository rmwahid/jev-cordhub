import { describe, expect, it } from 'vitest';
import { DailyCounter, positiveInt, SlidingWindowLimiter } from '../src/lib/server/rate-limit';

describe('SlidingWindowLimiter', () => {
	it('allows calls up to the limit', () => {
		const limiter = new SlidingWindowLimiter(3, 1000);
		expect(limiter.check('a', 0).allowed).toBe(true);
		expect(limiter.check('a', 100).allowed).toBe(true);
		expect(limiter.check('a', 200).allowed).toBe(true);
	});

	it('refuses the one after the limit', () => {
		const limiter = new SlidingWindowLimiter(3, 1000);
		limiter.check('a', 0);
		limiter.check('a', 100);
		limiter.check('a', 200);
		const refused = limiter.check('a', 300);
		expect(refused.allowed).toBe(false);
		expect(refused.remaining).toBe(0);
	});

	it('says how long to wait, measured from the oldest call in the window', () => {
		const limiter = new SlidingWindowLimiter(1, 1000);
		limiter.check('a', 0);
		expect(limiter.check('a', 300).retryAfterMs).toBe(700);
	});

	it('frees a slot once the oldest call leaves the window', () => {
		const limiter = new SlidingWindowLimiter(3, 1000);
		limiter.check('a', 0);
		limiter.check('a', 100);
		limiter.check('a', 200);
		expect(limiter.check('a', 400).allowed).toBe(false);
		// At 1001 the call at 0 has aged out, so one slot is back.
		expect(limiter.check('a', 1001).allowed).toBe(true);
	});

	it('counts each caller separately', () => {
		const limiter = new SlidingWindowLimiter(1, 1000);
		expect(limiter.check('a', 0).allowed).toBe(true);
		expect(limiter.check('b', 0).allowed).toBe(true);
	});

	it('reports the remaining allowance', () => {
		const limiter = new SlidingWindowLimiter(3, 1000);
		expect(limiter.check('a', 0).remaining).toBe(2);
		expect(limiter.check('a', 1).remaining).toBe(1);
		expect(limiter.check('a', 2).remaining).toBe(0);
	});

	it('switches off at a limit of zero or less', () => {
		const limiter = new SlidingWindowLimiter(0, 1000);
		for (let i = 0; i < 50; i++) expect(limiter.check('a', i).allowed).toBe(true);
	});

	it('forgets callers whose window has emptied, so the map cannot grow forever', () => {
		const limiter = new SlidingWindowLimiter(5, 1000);
		for (let i = 0; i < 5002; i++) limiter.check(`caller-${i}`, 0);
		expect(limiter.trackedCallers).toBeGreaterThan(5000);

		// Past the sweep threshold and past every window, so the next check
		// clears the stale entries.
		limiter.check('late', 2000);
		expect(limiter.trackedCallers).toBe(1);
	});
});

describe('DailyCounter', () => {
	const noon = Date.UTC(2026, 8, 20, 12, 0, 0);

	it('allows calls up to the cap', () => {
		const counter = new DailyCounter(2);
		expect(counter.check(noon).allowed).toBe(true);
		expect(counter.check(noon).allowed).toBe(true);
	});

	it('refuses past the cap and reports the cap', () => {
		const counter = new DailyCounter(2);
		counter.check(noon);
		counter.check(noon);
		const refused = counter.check(noon);
		expect(refused.allowed).toBe(false);
		expect(refused.cap).toBe(2);
	});

	it('starts again on a new day', () => {
		const counter = new DailyCounter(1);
		expect(counter.check(noon).allowed).toBe(true);
		expect(counter.check(noon).allowed).toBe(false);
		expect(counter.check(Date.UTC(2026, 8, 21, 0, 0, 1)).allowed).toBe(true);
	});

	it('switches off at a cap of zero or less', () => {
		const counter = new DailyCounter(0);
		for (let i = 0; i < 20; i++) expect(counter.check(noon).allowed).toBe(true);
	});
});

describe('positiveInt', () => {
	it('parses a number', () => {
		expect(positiveInt('25', 10)).toBe(25);
	});

	it('falls back when the setting is missing', () => {
		expect(positiveInt(undefined, 10)).toBe(10);
	});

	it('falls back on nonsense rather than disabling the guard', () => {
		expect(positiveInt('lots', 10)).toBe(10);
		expect(positiveInt('-5', 10)).toBe(10);
	});

	it('accepts zero, which means switched off on purpose', () => {
		expect(positiveInt('0', 10)).toBe(0);
	});
});
