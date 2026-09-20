import { describe, expect, it } from 'vitest';
import {
	answersToHits,
	buildQuestions,
	candidateFrom,
	DEFAULT_BATCH,
	RELEVANCE_CRITERIA
} from '../src/lib/prompt';
import type { CatalogEntry } from '../src/lib/types';

function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
	return {
		fullName: 'owner/repo',
		description: 'a thing',
		topics: ['one'],
		language: 'Go',
		stars: 10,
		archived: false,
		postCount: 1,
		usage: 'cli-tool',
		usageAlternatives: [{ id: 'dev-tooling', probability: 0.3 }],
		form: 'cli',
		formAlternatives: [],
		usabilityScore: 3,
		usabilityMax: 4,
		usabilityConfidence: 0.7,
		usageConfidence: 0.8,
		formConfidence: 0.6,
		...overrides
	};
}

describe('DEFAULT_BATCH', () => {
	// Guards a measured decision. Batches of forty left 160 to 209 of 371
	// candidates below 0.5 confidence with no meaningful ordering, while
	// batches of ten cut that to 7 to 45. Anyone raising this should re-measure
	// rather than assume the bigger batch is cheaper and therefore better.
	it('stays at the measured value', () => {
		expect(DEFAULT_BATCH).toBe(10);
	});
});

describe('candidateFrom', () => {
	it('carries the labels, which are the bridge between question and description', () => {
		const candidate = candidateFrom(entry());
		expect(candidate.labelled_usage).toBe('cli-tool');
		expect(candidate.labelled_form).toBe('cli');
	});

	it('turns an absent description into null rather than undefined', () => {
		expect(candidateFrom(entry({ description: null })).description).toBeNull();
	});

	it('sends only what the question needs', () => {
		const keys = Object.keys(candidateFrom(entry({ usageAlternatives: [] })));
		expect(keys.sort()).toEqual(['description', 'id', 'labelled_form', 'labelled_usage', 'language', 'name', 'topics']);
	});

	it('carries the near-miss categories when there are any', () => {
		const candidate = candidateFrom(entry()) as { labelled_usage_also?: string[] };
		expect(candidate.labelled_usage_also).toEqual(['dev-tooling']);
	});

	it('leaves the field out entirely when there is nothing to say', () => {
		// Keeping it as an empty array would add tokens to three quarters of the
		// candidates for no information at all.
		const candidate = candidateFrom(entry({ usageAlternatives: [] }));
		expect('labelled_usage_also' in candidate).toBe(false);
	});
});

describe('buildQuestions', () => {
	it('asks one question per candidate', () => {
		expect(Object.keys(buildQuestions(3))).toHaveLength(3);
	});

	it('uses a score question, so relevance and confidence both come back', () => {
		expect(buildQuestions(1).rel_c0).toMatchObject({ type: 'score' });
	});

	it('names its own repository by index and no other', () => {
		const questions = buildQuestions(2) as Record<string, { instructions: string }>;
		expect(questions.rel_c0.instructions).toContain('candidates[0]');
		expect(questions.rel_c0.instructions).not.toContain('candidates[1]');
		expect(questions.rel_c1.instructions).toContain('candidates[1]');
	});

	it('attaches the rubric to every question', () => {
		const questions = buildQuestions(2) as Record<string, { criteria: string[] }>;
		expect(questions.rel_c0.criteria).toEqual(RELEVANCE_CRITERIA);
		expect(questions.rel_c1.criteria).toEqual(RELEVANCE_CRITERIA);
	});

	it('builds nothing for an empty batch', () => {
		expect(buildQuestions(0)).toEqual({});
	});
});

describe('answersToHits', () => {
	it('normalises the graded score onto 0..1', () => {
		const hits = answersToHits([entry()], { rel_c0: { type: 'score', score: 4, confidence: 0.9 } });
		expect(hits[0].relevance).toBe(1);
		expect(hits[0].relevanceScore).toBe(4);
		expect(hits[0].relevanceConfidence).toBe(0.9);
	});

	it('keeps the raw score, because the API scale is zero-based', () => {
		const hits = answersToHits([entry()], { rel_c0: { type: 'score', score: 2, confidence: 0.5 } });
		expect(hits[0].relevanceScore).toBe(2);
		expect(hits[0].relevance).toBeCloseTo(0.5);
	});

	it('survives a missing answer without dropping the repository', () => {
		const hits = answersToHits([entry({ fullName: 'a/b' }), entry({ fullName: 'c/d' })], {
			rel_c0: { type: 'score', score: 3, confidence: 0.8 }
		});
		expect(hits).toHaveLength(2);
		expect(hits[1].relevance).toBeNull();
		expect(hits[1].relevanceConfidence).toBeNull();
	});

	it('survives a missing answer on the whole batch', () => {
		const hits = answersToHits([entry()], undefined);
		expect(hits).toHaveLength(1);
		expect(hits[0].relevance).toBeNull();
	});

	it('carries the catalogue fields through untouched', () => {
		const hits = answersToHits([entry({ postCount: 2, archived: true })], {
			rel_c0: { type: 'score', score: 1, confidence: 0.4 }
		});
		expect(hits[0].postCount).toBe(2);
		expect(hits[0].archived).toBe(true);
	});
});
