import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards a failure that is invisible from the server and obvious to every user.
 *
 * A component importing a module that imports a Node builtin puts that builtin
 * in the browser bundle. The page then arrives from the server looking perfect,
 * passes every server-side test, answers every curl with 200, and logs nothing,
 * because the server can load the module fine. The browser cannot. Hydration
 * fails and SvelteKit replaces the page with an error.
 *
 * That is exactly what happened when the taxonomy moved into this repository
 * with `node:crypto` at the top: the site broke for every visitor while the
 * server reported perfect health. A Node import belongs in `$lib/server/`.
 */

const LIB = path.resolve('src/lib');

function walk(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...walk(full));
		else if (/\.(ts|js|mjs|svelte)$/.test(entry.name)) found.push(full);
	}
	return found;
}

describe('modules a component may import', () => {
	const files = walk(LIB).filter((file) => !file.includes(path.join('lib', 'server')));

	it('finds something to check', () => {
		expect(files.length).toBeGreaterThan(3);
	});

	it('never import a Node builtin', () => {
		const offenders = files.filter((file) => /\bfrom\s+['"]node:/.test(readFileSync(file, 'utf8')));
		expect(
			offenders.map((file) => path.relative(process.cwd(), file)),
			'a Node builtin here reaches the browser and breaks hydration'
		).toEqual([]);
	});

	it('never reach for process or a bare builtin specifier', () => {
		const offenders = files.filter((file) => {
			const source = readFileSync(file, 'utf8');
			return /\bprocess\.(env|cwd)/.test(source) || /\bfrom\s+['"](fs|path|crypto)['"]/.test(source);
		});
		expect(offenders.map((file) => path.relative(process.cwd(), file))).toEqual([]);
	});

	it('keeps the server-only modules out of the shared directory', () => {
		// The converse guard: a module that needs Node must be under server/,
		// and this asserts the two directories are genuinely separate.
		const serverFiles = walk(LIB).filter((file) => file.includes(path.join('lib', 'server')));
		expect(serverFiles.length).toBeGreaterThan(0);
		for (const file of serverFiles) {
			expect(statSync(file).isFile()).toBe(true);
		}
	});
});
