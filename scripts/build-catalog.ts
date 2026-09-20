#!/usr/bin/env bun
/**
 * Build the catalogue the app searches, from the harvested data.
 *
 * Run with `bun run catalog`. It lives in TypeScript rather than plain JS so
 * the transformation can be unit tested; the app's scripts are bun scripts,
 * matching the project's verify command.
 *
 * The input is the pipeline's output one level above this repository:
 *   ../data/raw/github/repos.jsonl      public GitHub metadata
 *   ../data/derived/labels/labels-*.jsonl   Jev's judgements
 *
 * The output is committed. That is a deliberate trade: it makes the repository
 * self-contained, so anyone who clones it can run the app without also having
 * the private Discord archive, which never leaves the project folder. The cost
 * is that the channel's list of bookmarked repositories becomes public, which
 * is acceptable because every entry is a public GitHub repository, and the
 * alternative is shipping nothing runnable.
 *
 * What is NOT acceptable is anything tied to the people or the channel: no
 * message ids, no usernames, no guild or channel ids. Fields are copied by
 * allowlist rather than filtered by denylist, and then checked again before
 * writing, because a leak here is unrecoverable once pushed.
 */

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Catalog, CatalogEntry } from '../src/lib/types';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const projectRoot = path.resolve(repoRoot, '..');

/**
 * Anything matching these names must not appear in the output. Deliberately a
 * second, independent check: the allowlist above decides what goes in, and
 * this catches the case where someone later adds a field without thinking.
 */
export const FORBIDDEN_KEY_PATTERN = /message|author|user|guild|channel|thread|discord|token|secret|key/i;

/** Walk a value and throw if any key looks like it belongs to the Discord side. */
export function assertNoPrivateFields(value: unknown, where = 'catalog'): void {
	if (Array.isArray(value)) {
		value.forEach((item, index) => assertNoPrivateFields(item, `${where}[${index}]`));
		return;
	}
	if (value && typeof value === 'object') {
		for (const [key, child] of Object.entries(value)) {
			if (FORBIDDEN_KEY_PATTERN.test(key)) {
				throw new Error(`Refusing to write ${where}.${key}: that looks like channel data, not public repository metadata.`);
			}
			assertNoPrivateFields(child, `${where}.${key}`);
		}
	}
}

interface GithubRecord {
	status: number;
	repo?: {
		full_name?: string;
		description?: string | null;
		topics?: string[] | null;
		language?: string | null;
		stargazers_count?: number;
		archived?: boolean;
	};
}

interface LabelRecord {
	fullName: string;
	postCount?: number;
	usage?: { choice?: string; confidence?: number; probabilities?: Record<string, number> | null } | null;
	form?: { choice?: string; confidence?: number; probabilities?: Record<string, number> | null } | null;
	usability?: { score?: number; scale?: { max?: number } | null; confidence?: number } | null;
}

/**
 * Categories that scored close to the winner, meaning the repository honestly
 * serves both.
 *
 * The chosen category alone throws away a real signal. Measured on the corpus,
 * 85 of 371 repositories have a runner-up at or above 0.25, and they are not
 * noise: a security skill for a coding agent is genuinely both, and a request
 * library is genuinely both dev tooling and frontend. Keeping only the winner
 * makes the catalogue claim a precision the model never had.
 *
 * The threshold is a display decision, not a truth: at 0.25, one result in four
 * carries a second category, which is enough to be informative without turning
 * every row into a list.
 */
export function alternativesFor(
	probabilities: Record<string, number> | null | undefined,
	chosen: string | null | undefined,
	threshold = 0.25,
	limit = 2
): { id: string; probability: number }[] {
	if (!probabilities || !chosen) return [];
	return Object.entries(probabilities)
		.filter(([id, probability]) => id !== chosen && probability >= threshold)
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([id, probability]) => ({ id, probability: Number(probability.toFixed(3)) }));
}

/**
 * Join the two halves into flat entries, one per repository.
 *
 * Two different links can resolve to the same project once renames are
 * followed, so records are collapsed by full name and their post counts are
 * added together. That merges the count rather than dropping one, because a
 * project posted under both its old and new name is still two separate times
 * somebody thought it worth sharing.
 */
export function buildCatalog(github: GithubRecord[], labels: LabelRecord[]): CatalogEntry[] {
	const labelsByName = new Map(labels.map((label) => [label.fullName.toLowerCase(), label]));
	const byName = new Map<string, CatalogEntry>();

	for (const record of github) {
		if (record.status !== 200 || !record.repo?.full_name) continue;
		const name = record.repo.full_name;
		const key = name.toLowerCase();
		const label = labelsByName.get(key);

		const existing = byName.get(key);
		if (existing) {
			// The label already counts every message that pointed here, under
			// either name, so its value replaces rather than adds. Adding would
			// double a repository that was posted once under each of two names.
			if (label) existing.postCount = label.postCount ?? existing.postCount;
			else existing.postCount += 1;
			continue;
		}

		byName.set(key, {
			fullName: name,
			description: record.repo.description?.trim() || null,
			topics: record.repo.topics ?? [],
			language: record.repo.language ?? null,
			stars: record.repo.stargazers_count ?? 0,
			archived: Boolean(record.repo.archived),
			postCount: label?.postCount ?? 1,
			usage: label?.usage?.choice ?? null,
			usageAlternatives: alternativesFor(label?.usage?.probabilities, label?.usage?.choice),
			form: label?.form?.choice ?? null,
			formAlternatives: alternativesFor(label?.form?.probabilities, label?.form?.choice),
			usabilityScore: label?.usability?.score ?? null,
			usabilityMax: label?.usability?.scale?.max ?? null,
			usabilityConfidence: label?.usability?.confidence ?? null,
			usageConfidence: label?.usage?.confidence ?? null,
			formConfidence: label?.form?.confidence ?? null
		});
	}

	return [...byName.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

async function newestLabelsFile(labelsDir: string): Promise<string> {
	const files = (await readdir(labelsDir)).filter((f) => f.startsWith('labels-') && f.endsWith('.jsonl'));
	if (!files.length) throw new Error(`No label files in ${labelsDir}. Run the labelling step first.`);
	const withTime = await Promise.all(
		files.map(async (file) => ({ file, mtimeMs: (await stat(path.join(labelsDir, file))).mtimeMs }))
	);
	withTime.sort((a, b) => b.mtimeMs - a.mtimeMs);
	return withTime[0].file;
}

async function readJsonl<T>(file: string): Promise<T[]> {
	const text = await readFile(file, 'utf8');
	return text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
}

async function main() {
	const githubFile = path.join(projectRoot, 'data', 'raw', 'github', 'repos.jsonl');
	const labelsDir = path.join(projectRoot, 'data', 'derived', 'labels');
	const outputDir = path.join(repoRoot, 'catalog');

	const labelFile = await newestLabelsFile(labelsDir);
	const github = await readJsonl<GithubRecord>(githubFile);
	const labels = await readJsonl<LabelRecord>(path.join(labelsDir, labelFile));

	const repos = buildCatalog(github, labels);

	const unreachable = github.filter((record) => record.status === 404).length;
	const catalog: Catalog = {
		generatedAt: new Date().toISOString().slice(0, 10),
		taxonomyVersion: labelFile.replace(/^labels-/, '').replace(/\.jsonl$/, ''),
		repos
	};

	assertNoPrivateFields(catalog);

	await mkdir(outputDir, { recursive: true });
	const outputFile = path.join(outputDir, 'catalog.json');
	await writeFile(outputFile, `${JSON.stringify(catalog)}\n`, 'utf8');

	console.log(`Labels      : ${labelFile}`);
	console.log(`Repositories: ${repos.length}`);
	console.log(`Dead links  : ${unreachable} (excluded, no metadata to judge)`);
	console.log(`Written to  : ${outputFile}`);
}

// Portable entry-point guard: `import.meta.main` is bun-only, and this file is
// also imported by the tests.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(`\nFailed: ${error instanceof Error ? error.message : error}`);
		process.exit(1);
	});
}
