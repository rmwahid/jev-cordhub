import { describe, expect, it } from 'vitest';
import { alternativesFor, assertNoPrivateFields, buildCatalog } from '../scripts/build-catalog';

const github = [
	{
		status: 200,
		repo: {
			full_name: 'alpha/one',
			description: 'does a thing',
			topics: ['cli'],
			language: 'Go',
			stargazers_count: 120,
			archived: false
		}
	},
	{ status: 404 },
	{
		status: 200,
		repo: {
			full_name: 'beta/two',
			description: '   ',
			topics: null,
			language: null,
			stargazers_count: 0,
			archived: true
		}
	},
	// The same project reached through a second link, under its former name.
	{ status: 200, repo: { full_name: 'alpha/one', description: 'does a thing', topics: ['cli'] } },
	// No label at all, which should still produce an entry.
	{ status: 200, repo: { full_name: 'gamma/three', description: 'unlabelled' } }
];

const labels = [
	{
		fullName: 'alpha/one',
		postCount: 2,
		usage: {
			choice: 'coding-agent',
			confidence: 0.91,
			probabilities: { 'coding-agent': 0.55, 'security-privacy': 0.26, 'dev-tooling': 0.05 }
		},
		form: { choice: 'cli', confidence: 0.82, probabilities: { cli: 0.6, library: 0.4 } },
		usability: { score: 3.2, scale: { max: 4 }, confidence: 0.51 }
	},
	{ fullName: 'beta/two', postCount: 1 }
];

describe('buildCatalog', () => {
	const repos = buildCatalog(github, labels);

	it('skips repositories whose link is dead', () => {
		expect(repos).toHaveLength(3);
	});

	it('collapses two links to the same project into one entry', () => {
		expect(repos.filter((r) => r.fullName === 'alpha/one')).toHaveLength(1);
	});

	it('does not double the post count when a project was posted under two names', () => {
		// The label already counted both messages, so the value must replace,
		// not accumulate.
		expect(repos.find((r) => r.fullName === 'alpha/one')?.postCount).toBe(2);
	});

	it('carries the labels through', () => {
		const entry = repos.find((r) => r.fullName === 'alpha/one');
		expect(entry?.usage).toBe('coding-agent');
		expect(entry?.form).toBe('cli');
		expect(entry?.usabilityScore).toBe(3.2);
		expect(entry?.usabilityMax).toBe(4);
		expect(entry?.usageConfidence).toBe(0.91);
	});

	it('turns a whitespace description into null', () => {
		expect(repos.find((r) => r.fullName === 'beta/two')?.description).toBeNull();
	});

	it('turns missing topics into an empty list, never null', () => {
		expect(repos.find((r) => r.fullName === 'beta/two')?.topics).toEqual([]);
	});

	it('keeps archived repositories, flagged', () => {
		expect(repos.find((r) => r.fullName === 'beta/two')?.archived).toBe(true);
	});

	it('gives an unlabelled repository an entry with null labels', () => {
		const entry = repos.find((r) => r.fullName === 'gamma/three');
		expect(entry?.usage).toBeNull();
		expect(entry?.form).toBeNull();
		expect(entry?.postCount).toBe(1);
	});

	it('sorts by name so the file is stable across runs', () => {
		expect(repos.map((r) => r.fullName)).toEqual(['alpha/one', 'beta/two', 'gamma/three']);
	});

	it('keeps the near-miss categories, not only the winner', () => {
		expect(repos.find((r) => r.fullName === 'alpha/one')?.usageAlternatives).toEqual([
			{ id: 'security-privacy', probability: 0.26 }
		]);
	});

	it('keeps near-misses for form too', () => {
		expect(repos.find((r) => r.fullName === 'alpha/one')?.formAlternatives).toEqual([
			{ id: 'library', probability: 0.4 }
		]);
	});

	it('gives an unlabelled repository empty lists, never undefined', () => {
		const entry = repos.find((r) => r.fullName === 'gamma/three');
		expect(entry?.usageAlternatives).toEqual([]);
		expect(entry?.formAlternatives).toEqual([]);
	});
});

describe('alternativesFor', () => {
	const probabilities = { 'mcp-server': 0.55, 'agent-skills': 0.3, 'dev-tooling': 0.1, other: 0.05 };

	it('drops the winner itself', () => {
		expect(alternativesFor(probabilities, 'mcp-server').map((a) => a.id)).toEqual(['agent-skills']);
	});

	it('ignores anything below the threshold', () => {
		expect(alternativesFor(probabilities, 'mcp-server')).toHaveLength(1);
	});

	it('keeps at most two, so a row never turns into a list', () => {
		expect(alternativesFor({ a: 0.2, b: 0.3, c: 0.4, d: 0.5, winner: 0.6 }, 'winner')).toHaveLength(2);
	});

	it('orders them by probability', () => {
		expect(alternativesFor(probabilities, 'mcp-server', 0.05).map((a) => a.id)).toEqual([
			'agent-skills',
			'dev-tooling'
		]);
	});

	it('honours a custom threshold', () => {
		expect(alternativesFor(probabilities, 'mcp-server', 0.5)).toEqual([]);
	});

	it('returns nothing when there is no distribution', () => {
		expect(alternativesFor(null, 'mcp-server')).toEqual([]);
		expect(alternativesFor(probabilities, null)).toEqual([]);
	});
});

describe('assertNoPrivateFields', () => {
	const clean = {
		generatedAt: '2026-09-20',
		taxonomyVersion: 'abc123',
		repos: [{ fullName: 'a/b', description: 'x', topics: [], language: 'Go', stars: 1, archived: false, postCount: 1 }]
	};

	it('accepts a catalogue of public repository metadata', () => {
		expect(() => assertNoPrivateFields(clean)).not.toThrow();
	});

	it('refuses message ids, which belong to the channel', () => {
		expect(() => assertNoPrivateFields({ repos: [{ messageIds: ['123'] }] })).toThrow(/messageIds/);
	});

	it('refuses anything under a user or author key', () => {
		expect(() => assertNoPrivateFields({ repos: [{ author: 'someone' }] })).toThrow();
		expect(() => assertNoPrivateFields({ username: 'someone' })).toThrow();
	});

	it('refuses guild and channel identifiers', () => {
		expect(() => assertNoPrivateFields({ guildId: '1' })).toThrow();
		expect(() => assertNoPrivateFields({ nested: { channelId: '1' } })).toThrow();
	});

	it('looks inside arrays', () => {
		expect(() => assertNoPrivateFields([{ ok: true }, { threadId: '9' }])).toThrow(/threadId/);
	});

	it('refuses anything that looks like a credential', () => {
		expect(() => assertNoPrivateFields({ apiKey: 'x' })).toThrow();
		expect(() => assertNoPrivateFields({ apiToken: 'x' })).toThrow();
		expect(() => assertNoPrivateFields({ clientSecret: 'x' })).toThrow();
	});
});
