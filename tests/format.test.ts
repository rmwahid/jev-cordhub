import { describe, expect, it } from 'vitest';
import { formatScore, formatStars, humaniseLabel, relevancePercent, repostLabel } from '../src/lib/format';

describe('formatScore', () => {
	it('shows two decimals', () => {
		expect(formatScore(0.9312)).toBe('0.93');
	});

	it('shows a dash when the judgement is missing', () => {
		expect(formatScore(null)).toBe('-');
		expect(formatScore(undefined)).toBe('-');
	});

	it('keeps a real zero as a zero', () => {
		expect(formatScore(0)).toBe('0.00');
	});
});

describe('formatStars', () => {
	it('leaves small counts alone', () => {
		expect(formatStars(999)).toBe('999');
	});

	it('shortens thousands to one decimal', () => {
		expect(formatStars(1500)).toBe('1.5k');
	});

	it('drops the decimal in the tens of thousands', () => {
		expect(formatStars(45000)).toBe('45k');
	});

	it('shows a dash for a missing count', () => {
		expect(formatStars(null)).toBe('-');
	});
});

describe('relevancePercent', () => {
	it('turns a normalised value into a percentage', () => {
		expect(relevancePercent(0.93)).toBeCloseTo(93);
	});

	it('clamps above one, so a bad scale cannot overflow the bar', () => {
		expect(relevancePercent(1.5)).toBe(100);
	});

	it('clamps below zero', () => {
		expect(relevancePercent(-0.4)).toBe(0);
	});

	it('treats a missing value as an empty bar', () => {
		expect(relevancePercent(null)).toBe(0);
	});
});

describe('repostLabel', () => {
	it('says nothing for a link posted once', () => {
		expect(repostLabel(1)).toBeNull();
	});

	it('labels a link posted more than once', () => {
		expect(repostLabel(2)).toBe('posted 2x');
	});

	it('says nothing when the count is missing', () => {
		expect(repostLabel(null)).toBeNull();
	});
});

describe('humaniseLabel', () => {
	it('turns a slug into words', () => {
		expect(humaniseLabel('agent-context-memory')).toBe('agent context memory');
	});

	it('passes a missing label through', () => {
		expect(humaniseLabel(null)).toBeNull();
		expect(humaniseLabel(undefined)).toBeNull();
	});
});
