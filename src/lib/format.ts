/** Two decimals, or a dash when the judgement is missing. */
export function formatScore(value: number | null | undefined): string {
	if (typeof value !== 'number' || Number.isNaN(value)) return '-';
	return value.toFixed(2);
}

/** Star counts, shortened so the row does not jump around. */
export function formatStars(stars: number | null | undefined): string {
	if (typeof stars !== 'number') return '-';
	if (stars >= 1000) return `${(stars / 1000).toFixed(stars >= 10000 ? 0 : 1)}k`;
	return String(stars);
}

/** A percentage for the relevance bar width. */
export function relevancePercent(value: number | null | undefined): number {
	if (typeof value !== 'number' || Number.isNaN(value)) return 0;
	return Math.max(0, Math.min(1, value)) * 100;
}

/** "3x" only when a link was posted more than once, otherwise nothing. */
export function repostLabel(postCount: number | null | undefined): string | null {
	if (typeof postCount !== 'number' || postCount < 2) return null;
	return `posted ${postCount}x`;
}

/** Turn a label id like `agent-context-memory` into something readable. */
export function humaniseLabel(id: string | null | undefined): string | null {
	if (!id) return null;
	return id.replace(/-/g, ' ');
}
