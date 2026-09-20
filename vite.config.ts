import { sveltekit } from '@sveltejs/kit/vite';
// Imported from vitest/config rather than vite so the `test` block is typed.
import { defineConfig } from 'vitest/config';

// Environment files are configured in svelte.config.js under kit.env.dir, not
// here. Vite's own `envDir` was tried first and did not work: SvelteKit loads
// .env files through its own plugin, so Vite's setting had no effect on
// $env/dynamic/private and development silently lost the key.
export default defineConfig({
	plugins: [sveltekit()],
	// One config, not two. Sharing it with the SvelteKit plugin is what makes
	// $lib and the other SvelteKit aliases resolve in tests. A separate config
	// without the plugin ran a little faster and needed a hand-written copy of
	// the alias, which is the kind of duplicate that drifts.
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node'
	}
});
