import type { CatalogEntry, SearchHit } from './types';

/**
 * Candidates per call. Ten, not forty.
 *
 * Measured, not guessed. The same repository against the same question scored
 * 0.05 with confidence 0.95 when judged among three candidates, and 0.50 with
 * confidence 0.00 when judged among forty. Across a full search, batches of
 * forty left 160 to 209 of 371 candidates below 0.5 confidence with no
 * meaningful ordering, while batches of ten cut that to 7 to 45. The forty in
 * jev-search ranks search-engine results, which are all at least plausibly on
 * topic; asking about an arbitrary catalogue is a different job.
 */
export const DEFAULT_BATCH = 10;

/**
 * A rubric, so the answer is graded rather than a single probability. Rubric
 * levels are written with numbers in the text for a human reader, but the API
 * indexes them from zero, so a five level rubric returns a score in 0..4.
 */
export const RELEVANCE_CRITERIA = [
	'1 - unrelated to what was asked',
	'2 - shares words or topics with the request but is about something else',
	'3 - related to the request but only partly answers it',
	'4 - answers the request well and could be used for it',
	'5 - exactly the kind of thing the request is looking for'
];

/**
 * The judgement payload for one repository. Only fields the question needs.
 *
 * The near-miss categories ride along, because a judgement that nearly split
 * is real information: a security skill for a coding agent is both, and sending
 * only the winner hides half of what it is from the search. The field is left
 * out entirely when there is nothing to say, so most candidates stay as small
 * as they were.
 */
export function candidateFrom(entry: CatalogEntry) {
	const also = (entry.usageAlternatives ?? []).map((alternative) => alternative.id);

	return {
		id: entry.fullName,
		name: entry.fullName,
		description: entry.description ?? null,
		topics: entry.topics ?? [],
		language: entry.language ?? null,
		labelled_usage: entry.usage ?? null,
		...(also.length ? { labelled_usage_also: also } : {}),
		labelled_form: entry.form ?? null
	};
}

/**
 * One question per repository. Each names its subject by index, because the
 * questions in a call are evaluated independently against the same state and
 * nothing else ties a question to the repository it is about.
 */
export function buildQuestions(count: number): Record<string, unknown> {
	const questions: Record<string, unknown> = {};
	for (let i = 0; i < count; i++) {
		questions[`rel_c${i}`] = {
			type: 'score',
			instructions:
				`How well does the repository at \`candidates[${i}]\` answer what the user asked for in \`request\`? ` +
				'Judge what the user wants to do with it, not whether the repository is good. ' +
				'A repository that is merely popular, or that shares a word with the request while being about something else, is not relevant.',
			criteria: RELEVANCE_CRITERIA
		};
	}
	return questions;
}

/** Fold one batch of answers into hits, keeping the raw score alongside the normalised one. */
export function answersToHits(
	batch: CatalogEntry[],
	answers: Record<string, { type?: string; score?: number; confidence?: number }> | undefined
): SearchHit[] {
	const max = RELEVANCE_CRITERIA.length - 1;
	return batch.map((entry, index) => {
		const answer = answers?.[`rel_c${index}`];
		const score = typeof answer?.score === 'number' ? answer.score : null;
		return {
			...entry,
			relevanceScore: score,
			relevance: score === null ? null : score / max,
			relevanceConfidence: typeof answer?.confidence === 'number' ? answer.confidence : null
		};
	});
}
