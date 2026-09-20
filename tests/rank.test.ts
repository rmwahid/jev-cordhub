import { describe, expect, it } from 'vitest';
import { CONFIDENCE_THRESHOLD, looksEmpty, partitionHits, rankHits, RELEVANCE_FLOOR } from '../src/lib/rank';
import type { SearchHit } from '../src/lib/types';

function hit(overrides: Partial<SearchHit> = {}): SearchHit {
	return {
		fullName: 'owner/repo',
		description: null,
		topics: [],
		language: null,
		stars: 0,
		archived: false,
		postCount: 1,
		usage: null,
		usageAlternatives: [],
		form: null,
		formAlternatives: [],
		usabilityScore: null,
		usabilityMax: null,
		usabilityConfidence: null,
		usageConfidence: null,
		formConfidence: null,
		relevance: null,
		relevanceScore: null,
		relevanceConfidence: null,
		...overrides
	};
}

describe('rankHits', () => {
	it('orders by relevance first', () => {
		const ranked = rankHits([
			hit({ fullName: 'a/one', relevance: 0.2, stars: 9999 }),
			hit({ fullName: 'b/two', relevance: 0.9 })
		]);
		expect(ranked.map((r) => r.fullName)).toEqual(['b/two', 'a/one']);
	});

	it('breaks a relevance tie toward the repository posted more than once', () => {
		const ranked = rankHits([
			hit({ fullName: 'popular/one', relevance: 0.7, stars: 50000, postCount: 1 }),
			hit({ fullName: 'reposted/two', relevance: 0.7, stars: 12, postCount: 2 })
		]);
		expect(ranked[0].fullName).toBe('reposted/two');
	});

	it('falls back to stars when relevance and post count tie', () => {
		const ranked = rankHits([
			hit({ fullName: 'small/one', relevance: 0.5, stars: 10 }),
			hit({ fullName: 'big/two', relevance: 0.5, stars: 4200 })
		]);
		expect(ranked[0].fullName).toBe('big/two');
	});

	it('sorts a missing relevance last instead of treating it as zero-ish', () => {
		const ranked = rankHits([
			hit({ fullName: 'unjudged/one', relevance: null }),
			hit({ fullName: 'weak/two', relevance: 0.01 })
		]);
		expect(ranked[0].fullName).toBe('weak/two');
	});

	it('does not mutate the input', () => {
		const original = [hit({ fullName: 'a/one', relevance: 0.1 }), hit({ fullName: 'b/two', relevance: 0.8 })];
		rankHits(original);
		expect(original[0].fullName).toBe('a/one');
	});
});

describe('partitionHits', () => {
	it('keeps a hit that is both relevant enough and confident enough', () => {
		const { answers } = partitionHits([hit({ fullName: 'sure/one', relevance: 0.9, relevanceConfidence: 0.8 })]);
		expect(answers.map((h) => h.fullName)).toEqual(['sure/one']);
	});

	it('demotes a strong match the model was unsure about', () => {
		// This is the combination that reads as a match while meaning the model
		// could not tell, which is the one thing the split exists to prevent.
		const { answers, rest } = partitionHits([
			hit({ fullName: 'unsure/two', relevance: 0.95, relevanceConfidence: 0.1 })
		]);
		expect(answers).toHaveLength(0);
		expect(rest.map((h) => h.fullName)).toEqual(['unsure/two']);
	});

	it('demotes a confident judgement that the hit is off topic', () => {
		// Confidence is not quality: being sure something is irrelevant is still
		// not an answer.
		const { answers, rest } = partitionHits([
			hit({ fullName: 'ontopic/no', relevance: 0.2, relevanceConfidence: 0.95 })
		]);
		expect(answers).toHaveLength(0);
		expect(rest).toHaveLength(1);
	});

	it('keeps both boundary values on the answer side', () => {
		const { answers } = partitionHits([
			hit({ relevance: RELEVANCE_FLOOR, relevanceConfidence: CONFIDENCE_THRESHOLD })
		]);
		expect(answers).toHaveLength(1);
	});

	it('treats a missing confidence as not trustworthy', () => {
		const { answers } = partitionHits([hit({ relevance: 0.9, relevanceConfidence: null })]);
		expect(answers).toHaveLength(0);
	});

	it('treats a missing relevance as not an answer', () => {
		const { answers } = partitionHits([hit({ relevance: null, relevanceConfidence: 0.9 })]);
		expect(answers).toHaveLength(0);
	});

	it('keeps every hit, discarding nothing', () => {
		const hits = [
			hit({ fullName: 'a/one', relevance: 0.9, relevanceConfidence: 0.9 }),
			hit({ fullName: 'b/two', relevance: 0.3, relevanceConfidence: 0.05 })
		];
		const { answers, rest } = partitionHits(hits);
		expect(answers.length + rest.length).toBe(hits.length);
	});

	it('returns both groups already ranked', () => {
		const { rest } = partitionHits([
			hit({ fullName: 'low/one', relevance: 0.2, relevanceConfidence: 0.1 }),
			hit({ fullName: 'high/two', relevance: 0.4, relevanceConfidence: 0.1 })
		]);
		expect(rest.map((h) => h.fullName)).toEqual(['high/two', 'low/one']);
	});

	it('accepts stricter gates when a caller wants them', () => {
		const { answers } = partitionHits([hit({ relevance: 0.6, relevanceConfidence: 0.9 })], {
			relevanceFloor: 0.8
		});
		expect(answers).toHaveLength(0);
	});
});

describe('looksEmpty', () => {
	it('is true with no answers at all', () => {
		expect(looksEmpty([])).toBe(true);
	});

	it('is false as soon as one hit reached the bar', () => {
		expect(looksEmpty([hit({ relevance: 0.8, relevanceConfidence: 0.9 })])).toBe(false);
	});
});
