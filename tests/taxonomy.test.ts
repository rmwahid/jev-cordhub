import { describe, expect, it } from 'vitest';
import {
	FORM_CRITERIA,
	USAGE_CRITERIA,
	USABILITY_CRITERIA,
	formMeaning,
	usageMeaning
} from '../src/lib/taxonomy';
// Separately, because the fingerprint needs node:crypto and $lib/taxonomy.ts
// must stay importable by the browser.
import { taxonomyVersion } from '../src/lib/server/taxonomy-version';
import catalog from '../catalog/catalog.json';
import type { Catalog } from '../src/lib/types';

const shipped = catalog as Catalog;

describe('criteria', () => {
	it('describes every usage category', () => {
		for (const [id, description] of Object.entries(USAGE_CRITERIA)) {
			// `other` is the one category that may be null, and it deliberately
			// is not any more: leaving it blank is what caused repositories to be
			// forced into wrong categories instead of landing there.
			expect(description, `usage "${id}" has no description`).toBeTruthy();
		}
	});

	it('describes every form', () => {
		for (const [id, description] of Object.entries(FORM_CRITERIA)) {
			expect(description, `form "${id}" has no description`).toBeTruthy();
		}
	});

	it('offers at least two usability levels, which the API requires', () => {
		expect(USABILITY_CRITERIA.length).toBeGreaterThanOrEqual(2);
	});

	it('carries the Indonesian phrasing people actually type', () => {
		// These categories exist to bridge vocabulary the repository text cannot
		// supply. If the plain-language phrases are dropped, a question like
		// "ada yang buat scraping?" stops matching anything.
		const all = Object.values(USAGE_CRITERIA).join(' ').toLowerCase();
		expect(all).toContain('buat');
		expect(all).toContain('mcp');
	});
});

describe('taxonomyVersion', () => {
	it('is a stable twelve character fingerprint', () => {
		expect(taxonomyVersion()).toMatch(/^[0-9a-f]{12}$/);
		expect(taxonomyVersion()).toBe(taxonomyVersion());
	});
});

describe('the shipped catalogue agrees with the shipped taxonomy', () => {
	// The failure this catches is a stale artefact: someone edits a category,
	// regenerates the labels, and forgets to rebuild the catalogue. The UI would
	// then show categories the code can no longer explain.
	it('was built with the taxonomy this code defines', () => {
		expect(shipped.taxonomyVersion).toBe(taxonomyVersion());
	});

	it('only uses categories the taxonomy still defines', () => {
		const known = new Set(Object.keys(USAGE_CRITERIA));
		const used = new Set(shipped.repos.map((repo) => repo.usage).filter(Boolean) as string[]);
		const unknown = [...used].filter((id) => !known.has(id));
		expect(unknown, `catalogue uses categories the taxonomy does not define: ${unknown.join(', ')}`).toEqual([]);
	});

	it('can explain every label it shows', () => {
		for (const repo of shipped.repos) {
			if (repo.usage) expect(usageMeaning(repo.usage), `no meaning for "${repo.usage}"`).toBeTruthy();
			if (repo.form) expect(formMeaning(repo.form), `no meaning for "${repo.form}"`).toBeTruthy();
		}
	});
});

describe('lookups', () => {
	it('returns the description for a known id', () => {
		expect(usageMeaning('mcp-server')).toContain('MCP server');
	});

	it('returns null for an unknown id rather than throwing', () => {
		expect(usageMeaning('not-a-category')).toBeNull();
		expect(formMeaning(undefined)).toBeNull();
	});
});
