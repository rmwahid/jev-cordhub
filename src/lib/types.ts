/** One repository in the catalogue, already flattened for storage. */
export interface CatalogEntry {
	fullName: string;
	description: string | null;
	topics: string[];
	language: string | null;
	stars: number;
	archived: boolean;
	/** How many separate messages in the channel posted this link. */
	postCount: number;
	usage: string | null;
	/** Categories the judgement nearly chose instead, meaning the repository serves both. */
	usageAlternatives: { id: string; probability: number }[];
	form: string | null;
	/** Same idea for form. Stored, not shown, until it earns its place on screen. */
	formAlternatives: { id: string; probability: number }[];
	/** Where this repository sits on the usability rubric, and how sure the model was. */
	usabilityScore: number | null;
	usabilityMax: number | null;
	usabilityConfidence: number | null;
	usageConfidence: number | null;
	formConfidence: number | null;
}

export interface Catalog {
	generatedAt: string;
	taxonomyVersion: string;
	repos: CatalogEntry[];
}

/** A catalogue entry plus the judgement made about it for one specific question. */
export interface SearchHit extends CatalogEntry {
	/** Relevance on a 0..1 scale, derived from the graded score. */
	relevance: number | null;
	/** The raw graded score the model returned, on a zero-based scale. */
	relevanceScore: number | null;
	/** How safe this judgement is to act on. Not the same thing as relevance. */
	relevanceConfidence: number | null;
}

export interface SearchResult {
	query: string;
	tookMs: number;
	judged: number;
	inputTokens: number;
	estimatedUsd: number;
	/** Hits that cleared both the relevance floor and the confidence threshold. */
	answers: SearchHit[];
	/** Everything else, ranked, kept so nothing is hidden silently. */
	rest: SearchHit[];
}
