import catalogData from '../../../catalog/catalog.json';
import type { Catalog } from '$lib/types';

/**
 * The catalogue, imported rather than read from disk.
 *
 * This is what makes the app portable across adapters. Reading it through the
 * filesystem module would tie the server to Node, and an edge runtime has no
 * filesystem at all. Importing it means the bundler inlines the data, so the
 * same source runs under adapter-node, adapter-cloudflare, or anything else
 * with no branch and no shim.
 *
 * The trade is that the catalogue is fixed at build time: regenerate it with
 * `bun run catalog` and rebuild for the change to appear. That is acceptable
 * because it is a generated artefact, not something edited at runtime.
 *
 * It is deliberately never served to the browser. The catalogue is the whole
 * corpus, and publishing it as a static asset would let anyone enumerate every
 * link in the channel without asking a question. Search goes through the
 * server so the corpus stays behind it.
 */
const catalog = catalogData as Catalog;

export async function loadCatalog(): Promise<Catalog> {
	return catalog;
}
