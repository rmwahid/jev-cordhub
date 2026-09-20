import { createHash } from 'node:crypto';
import { FORM_CRITERIA, USAGE_CRITERIA, USABILITY_CRITERIA } from '$lib/taxonomy';

/**
 * Short fingerprint of the criteria text, so labels can be traced to the
 * taxonomy that produced them.
 *
 * Labels only mean something against a particular set of categories. Change a
 * description and every existing label becomes ambiguous: was it made by the
 * old wording or the new one? The label files are named after this value and
 * the catalogue records it, so an old set is never mistaken for a current one.
 *
 * Computed rather than written down on purpose. A hand-kept version number is
 * something a person can forget to bump, and then two different taxonomies
 * claim the same name. This cannot be forgotten.
 *
 * It lives in `server/` because it needs `node:crypto`, and `$lib/taxonomy.ts`
 * must stay importable by components. The browser never needs this value; it
 * reads the fingerprint out of the catalogue instead.
 */
export function taxonomyVersion(): string {
	const text = JSON.stringify([USAGE_CRITERIA, FORM_CRITERIA, USABILITY_CRITERIA]);
	return createHash('sha256').update(text).digest('hex').slice(0, 12);
}
