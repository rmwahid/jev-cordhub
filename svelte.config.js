import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: vitePreprocess(),
	kit: {
		// A Worker with a script, not static assets only. The TypeSafe key must
		// stay on the server: search runs by calling Jev, and anything fully
		// static would ship the key to the browser. The sibling projects that
		// deploy a bare assets directory cannot do that, because they have
		// nothing running server-side at all.
		adapter: adapter(),
		env: {
			// The project keeps one .env one level above this repository,
			// deliberately outside git. This is the knob that makes SvelteKit
			// load it, so development needs no runtime file access anywhere in
			// the app while sharing the same secret file as everything else.
			//
			// Vite's own `envDir` does not do this: SvelteKit loads .env files
			// itself and ignores that setting, which was verified by removing
			// the old runtime fallback and watching development lose the key.
			dir: '..'
		}
	}
};
