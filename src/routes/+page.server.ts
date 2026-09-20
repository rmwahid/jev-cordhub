import { loadCatalog } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';

/**
 * Only counts and dates reach the page. The catalogue itself stays on the
 * server; see the note in $lib/server/catalog.ts.
 */
export const load: PageServerLoad = async () => {
	try {
		const catalog = await loadCatalog();
		return {
			stats: {
				repos: catalog.repos.length,
				taxonomyVersion: catalog.taxonomyVersion,
				generatedAt: catalog.generatedAt
			}
		};
	} catch {
		return { stats: null };
	}
};
