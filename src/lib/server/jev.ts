import { env } from '$env/dynamic/private';

export const TYPESAFE_API = 'https://api.typesafe.ai/v1/systemone';
export const TYPESAFE_MODEL = 'jev-latest';

/**
 * The key comes from the environment, and only from the environment.
 *
 * There is deliberately no fallback that reads a file. Reaching for a .env at
 * runtime would tie the server to a platform with a filesystem and to a
 * working directory, which is exactly the coupling that makes a build
 * undeployable somewhere else, and an edge runtime has neither.
 *
 * Development does not need one. Vite's `envDir` points at the project root
 * above this repository, so the single shared .env is already loaded into the
 * environment before any of this runs. See vite.config.ts.
 *
 * The key is only ever read on the server. Nothing under src/routes or src/lib
 * sends it to the browser.
 */
export function resolveApiKey(): string | null {
	const value = env.TYPESAFE_API_KEY?.trim();
	return value || null;
}

export interface JevAnswer {
	type?: string;
	score?: number;
	confidence?: number;
	legend?: Record<string, string>;
	probabilities?: Record<string, number>;
}

export interface JevResponse {
	model: string;
	answers: Record<string, JevAnswer>;
	usage: { input_tokens: number; output_tokens: number };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One call to Jev, with backoff on throttling and server errors.
 *
 * A 401 or a 422 is raised straight away rather than retried: neither fixes
 * itself, and retrying only buries the message that says what is wrong.
 */
export async function callJev(
	apiKey: string,
	state: unknown,
	questions: Record<string, unknown>,
	signal?: AbortSignal
): Promise<JevResponse> {
	for (let attempt = 0; ; attempt++) {
		const response = await fetch(TYPESAFE_API, {
			method: 'POST',
			headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ state, model: TYPESAFE_MODEL, questions }),
			signal
		});

		if (response.status === 429 || response.status === 529) {
			if (attempt >= 5) throw new Error(`Jev is throttling (HTTP ${response.status}). Try again shortly.`);
			const retryAfter = Number(response.headers.get('retry-after'));
			const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * 2 ** attempt;
			await sleep(waitMs);
			continue;
		}

		if (response.status >= 500) {
			if (attempt >= 4) throw new Error(`Jev is unavailable (HTTP ${response.status}). Try again shortly.`);
			await sleep(1000 * (attempt + 1));
			continue;
		}

		if (response.status === 401) {
			throw new Error('The TypeSafe key was rejected. Check TYPESAFE_API_KEY.');
		}

		if (!response.ok) {
			const body = await response.text().catch(() => '');
			throw new Error(`Jev refused the request (HTTP ${response.status}): ${body.slice(0, 300)}`);
		}

		const body = (await response.json()) as Partial<JevResponse>;
		return {
			model: body.model ?? TYPESAFE_MODEL,
			answers: body.answers ?? {},
			usage: {
				input_tokens: body.usage?.input_tokens ?? 0,
				output_tokens: body.usage?.output_tokens ?? 0
			}
		};
	}
}
