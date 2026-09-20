import type { SearchHit } from './types';

/**
 * Below this, a judgement is not safe to present as an answer. The brief
 * requires low-confidence hits to be separated rather than mixed in, and the
 * measurements back that up: the dangerous case is a high relevance figure
 * with a low confidence, which reads as a match while meaning the model could
 * not really tell.
 */
export const CONFIDENCE_THRESHOLD = 0.5;

/**
 * Ordering is exactly what the list shows. Relevance first, then how many
 * separate people bothered to post the link, then stars.
 *
 * The middle key is not decoration. With no commentary in the channel, a link
 * posted twice months apart by two different people is the only human signal
 * of quality available, and it survived the data: when relevance ties, the
 * repeatedly posted repositories are the better answer.
 */
export function rankHits(hits: SearchHit[]): SearchHit[] {
	return [...hits].sort((a, b) => {
		const ra = a.relevance ?? -1;
		const rb = b.relevance ?? -1;
		if (rb !== ra) return rb - ra;

		const pa = a.postCount ?? 1;
		const pb = b.postCount ?? 1;
		if (pb !== pa) return pb - pa;

		return (b.stars ?? 0) - (a.stars ?? 0);
	});
}

/**
 * The relevance a hit needs before it is worth calling an answer.
 *
 * A half is not arbitrary: with a five level rubric, 0.5 is the third level,
 * "related to the request but only partly answers it". The level below it is
 * "shares words or topics but is about something else", which is explicitly
 * not an answer to what was asked. Measured on a real query, the useful hits
 * sat at 0.89 and above and everything else fell to 0.47, so this floor is
 * what separates three answers from three hundred and sixty-eight rows.
 */
export const RELEVANCE_FLOOR = 0.5;

/**
 * Split ranked hits into answers and everything else.
 *
 * Both gates matter, and for different reasons. Confidence alone is not
 * enough: in a live search, 325 of 371 candidates cleared it while most of
 * them were plainly irrelevant, because a model can be quite sure that a
 * repository has nothing to do with the question. Relevance alone is not
 * enough either, because a high relevance with a low confidence is the one
 * combination that reads as a match while meaning the model could not tell.
 *
 * Nothing is discarded. The second group is returned ranked and complete, and
 * the interface decides how far to fold it away.
 */
export function partitionHits(
	hits: SearchHit[],
	options: { relevanceFloor?: number; confidenceFloor?: number } = {}
): { answers: SearchHit[]; rest: SearchHit[] } {
	const relevanceFloor = options.relevanceFloor ?? RELEVANCE_FLOOR;
	const confidenceFloor = options.confidenceFloor ?? CONFIDENCE_THRESHOLD;

	const answers: SearchHit[] = [];
	const rest: SearchHit[] = [];

	for (const hit of rankHits(hits)) {
		const scoresWellEnough = (hit.relevance ?? -1) >= relevanceFloor;
		const isTrustworthy = (hit.relevanceConfidence ?? 0) >= confidenceFloor;
		if (scoresWellEnough && isTrustworthy) answers.push(hit);
		else rest.push(hit);
	}

	return { answers, rest };
}

/** True when nothing reached the bar to be called an answer. */
export function looksEmpty(answers: SearchHit[]): boolean {
	return answers.length === 0;
}
