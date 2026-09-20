import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { DailyCounter, positiveInt, SlidingWindowLimiter } from '$lib/server/rate-limit';
import { loadCatalog } from '$lib/server/catalog';
import { callJev, resolveApiKey } from '$lib/server/jev';
import { answersToHits, buildQuestions, candidateFrom, DEFAULT_BATCH } from '$lib/prompt';
import { partitionHits } from '$lib/rank';
import type { SearchHit, SearchResult } from '$lib/types';

/**
 * Tokens to dollars. Vendor list price, and only for input tokens: output is a
 * rounding error next to it. Presented as an estimate, never as a bill.
 */
const USD_PER_BILLION_INPUT_TOKENS = 42;

const MAX_QUERY_LENGTH = 300;

/**
 * Guards are on by default, because the cost of a search is real money and the
 * default deployment has no other protection. Tune with SEARCH_RATE_LIMIT,
 * SEARCH_RATE_WINDOW_MS and SEARCH_DAILY_CAP; set any of them to 0 to switch
 * that guard off.
 */
const DEFAULT_RATE_LIMIT = 30;
const DEFAULT_RATE_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_DAILY_CAP = 500;

// Built on first use rather than at import, because the environment is not
// populated until a request arrives.
let perCaller: SlidingWindowLimiter | null = null;
let perDay: DailyCounter | null = null;

function guards() {
	if (!perCaller || !perDay) {
		perCaller = new SlidingWindowLimiter(
			positiveInt(env.SEARCH_RATE_LIMIT, DEFAULT_RATE_LIMIT),
			positiveInt(env.SEARCH_RATE_WINDOW_MS, DEFAULT_RATE_WINDOW_MS)
		);
		perDay = new DailyCounter(positiveInt(env.SEARCH_DAILY_CAP, DEFAULT_DAILY_CAP));
	}
	return { perCaller, perDay };
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// Checked before the body is parsed, so malformed spam costs nothing and
	// cannot be used to slip past the limit.
	const { perCaller, perDay } = guards();

	let caller: string;
	try {
		caller = getClientAddress();
	} catch {
		// An adapter that cannot supply an address puts every such request into
		// one shared bucket. That over-restricts rather than under-restricts,
		// which is the right direction to fail in.
		caller = 'unknown-caller';
	}

	const callerState = perCaller.check(caller);
	if (!callerState.allowed) {
		return json(
			{ error: 'Too many searches from here. Wait a moment and try again.' },
			{
				status: 429,
				headers: { 'Retry-After': String(Math.max(1, Math.ceil(callerState.retryAfterMs / 1000))) }
			}
		);
	}

	// Counted after the per-caller check, so somebody being throttled cannot
	// spend the shared budget while they wait.
	const dayState = perDay.check();
	if (!dayState.allowed) {
		return json(
			{
				error: `This deployment has spent its daily search budget (${dayState.cap}). It resets at UTC midnight.`
			},
			{ status: 429 }
		);
	}

	let body: { query?: unknown; batch?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Expected a JSON body.' }, { status: 400 });
	}

	const query = typeof body.query === 'string' ? body.query.trim() : '';
	if (!query) return json({ error: 'Ask something first.' }, { status: 400 });
	if (query.length > MAX_QUERY_LENGTH) {
		return json({ error: `Keep the question under ${MAX_QUERY_LENGTH} characters.` }, { status: 400 });
	}

	const batchSize =
		typeof body.batch === 'number' && body.batch >= 1 && body.batch <= 40 ? Math.floor(body.batch) : DEFAULT_BATCH;

	const apiKey = resolveApiKey();
	if (!apiKey) {
		// Same variable either way, different places to put it, and pointing a
		// deployment at a file it cannot read would send the reader the wrong way.
		const hint = import.meta.env.DEV
			? ' Set TYPESAFE_API_KEY in the environment, or in the .env file one level above this repository.'
			: ' Set the TYPESAFE_API_KEY secret for this deployment.';
		return json({ error: `No TypeSafe key configured.${hint}` }, { status: 503 });
	}

	let repos;
	try {
		({ repos } = await loadCatalog());
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : 'Catalogue unavailable.' }, { status: 503 });
	}

	const batches: typeof repos[] = [];
	for (let i = 0; i < repos.length; i += batchSize) batches.push(repos.slice(i, i + batchSize));

	const started = Date.now();

	// Batches run concurrently. Each one is a self-contained judgement about its
	// own candidates, so the order they finish in does not matter.
	let responses;
	try {
		responses = await Promise.all(
			batches.map((batch) =>
				callJev(
					apiKey,
					{ request: query, candidates: batch.map(candidateFrom) },
					buildQuestions(batch.length)
				)
			)
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'The search failed.';
		return json({ error: message }, { status: 502 });
	}

	let inputTokens = 0;
	const hits: SearchHit[] = [];
	batches.forEach((batch, index) => {
		const response = responses![index];
		inputTokens += response.usage.input_tokens;
		hits.push(...answersToHits(batch, response.answers));
	});

	const { answers, rest } = partitionHits(hits);

	const result: SearchResult = {
		query,
		tookMs: Date.now() - started,
		judged: hits.length,
		inputTokens,
		estimatedUsd: (inputTokens / 1e9) * USD_PER_BILLION_INPUT_TOKENS,
		answers,
		rest
	};

	return json(result);
};
