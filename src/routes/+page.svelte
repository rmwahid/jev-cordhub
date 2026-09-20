<script lang="ts">
	import Hit from '$lib/Hit.svelte';
	import { looksEmpty } from '$lib/rank';
	import type { SearchResult } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let query = $state('');
	let result = $state<SearchResult | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const examples = [
		'skill buat claude code supaya hemat token',
		'mcp server for memory',
		'self hosted alternative to notion',
		'terminal dashboard for cron jobs'
	];

	const nothingFound = $derived(result !== null && looksEmpty(result.answers));

	async function search(event: SubmitEvent) {
		event.preventDefault();
		const asked = query.trim();
		if (!asked || loading) return;

		loading = true;
		error = null;

		try {
			const response = await fetch('/api/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: asked })
			});
			const body = await response.json();

			if (!response.ok) {
				error = body?.error ?? `Search failed (HTTP ${response.status}).`;
				result = null;
			} else {
				result = body as SearchResult;
			}
		} catch {
			error = 'Could not reach the search endpoint.';
			result = null;
		} finally {
			loading = false;
		}
	}
</script>

<div class="shell" class:landing={!result && !loading && !error}>
	<header class="topbar">
		<span class="brand">jev-cordhub</span>
		{#if data.stats}
			<span class="stats">
				<span>{data.stats.repos} repositories</span>
				<span>taxonomy {data.stats.taxonomyVersion}</span>
				<span>catalogued {data.stats.generatedAt.slice(0, 10)}</span>
			</span>
		{/if}
	</header>

	<section class="ask">
		<form onsubmit={search}>
			<input
				type="text"
				bind:value={query}
				placeholder="i want a tool for…"
				aria-label="Ask about the bookmarked repositories"
				autocomplete="off"
			/>
			<button type="submit" disabled={loading || !query.trim()}>{loading ? 'Asking…' : 'Ask'}</button>
		</form>

		{#if !result && !loading && !error}
			<div class="examples">
				{#each examples as example (example)}
					<button type="button" onclick={() => (query = example)}>{example}</button>
				{/each}
			</div>
		{/if}
	</section>

	{#if loading}
		<div class="status">
			Asking Jev about all {data.stats?.repos ?? 'the'} repositories, in batches.
			<div class="meter"><span></span></div>
		</div>
	{:else if error}
		<div class="status error">{error}</div>
	{:else if result}
		{#if nothingFound}
			<div class="status note">
				Nothing here answers this. This channel collects coding-agent and self-hosted tooling, so
				a question from outside that has nothing to find.
			</div>
		{/if}

		{#if result.answers.length}
			<div class="group-head"><span>Answers</span><span>{result.answers.length}</span></div>
			{#each result.answers as hit (hit.fullName)}
				<Hit {hit} />
			{/each}
		{/if}

		{#if result.rest.length}
			<details class="more">
				<summary>Everything else ({result.rest.length})</summary>
				<p>Scored low, or judged too uncertainly to rely on. Kept, but out of the way.</p>
				{#each result.rest.slice(0, 12) as hit (hit.fullName)}
					<Hit {hit} dim />
				{/each}
				{#if result.rest.length > 12}
					<p>Showing the first 12 of {result.rest.length}.</p>
				{/if}
			</details>
		{/if}

		<footer>
			<span>{result.judged} judged</span>
			<span>{(result.tookMs / 1000).toFixed(1)}s</span>
			<span>{result.inputTokens.toLocaleString('en-US')} tokens</span>
			<span>${result.estimatedUsd.toFixed(4)}</span>
		</footer>
	{/if}

	<details class="more">
		<summary>About</summary>
		<p>
			A private Discord channel used as a bookmark pile, with nothing written next to any of the
			links. Ask for what you want to do; this returns the repositories that fit, judged on what
			you would want them for, how you use them, and how ready they are.
		</p>
		<p>
			Every answer carries a relevance figure and a separate confidence figure. Weak judgements are
			folded away instead of mixed in, so a poor match never reads as a recommendation.
		</p>
		<p>Relevance is a model judgement, not verified accuracy. Some questions have no answer here.</p>
	</details>
</div>
