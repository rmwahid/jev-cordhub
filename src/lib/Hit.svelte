<script lang="ts">
	import type { SearchHit } from './types';
	import { formatScore, formatStars, humaniseLabel, repostLabel } from './format';
	import { formMeaning, usageMeaning } from './taxonomy';

	let { hit, dim = false }: { hit: SearchHit; dim?: boolean } = $props();

	const usage = $derived(humaniseLabel(hit.usage));
	// The categories ship with the repository, so a label can explain itself
	// instead of being a word the reader has to guess at.
	const usageAbout = $derived(usageMeaning(hit.usage) ?? undefined);
	const detailAbout = $derived(formMeaning(hit.form) ?? undefined);
	const form = $derived(humaniseLabel(hit.form));
	const reposts = $derived(repostLabel(hit.postCount));
	const weak = $derived((hit.relevanceConfidence ?? 0) < 0.5);

	// One muted line carries the detail; chips were doing this job and were
	// most of what made a result row feel crowded.
	// A repository that serves two purposes should say so. Only the near-misses
	// are kept, so most rows carry nothing here.
	const also = $derived(hit.usageAlternatives.map((alt) => humaniseLabel(alt.id)).join(', '));
	const alsoAbout = $derived(
		hit.usageAlternatives
			.map((alt) => usageMeaning(alt.id))
			.filter(Boolean)
			.join(' | ') || undefined
	);

	const detail = $derived(
		[form, hit.language, hit.stars ? `${formatStars(hit.stars)} ★` : null, reposts, hit.archived ? 'archived' : null]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<article class="hit" class:dim>
	<a
		class="hit-name"
		href="https://github.com/{hit.fullName}"
		target="_blank"
		rel="noreferrer noopener">{hit.fullName}</a
	>

	<div class="hit-scores">
		<span class="rel" class:low={(hit.relevance ?? 0) < 0.5}>{formatScore(hit.relevance)}</span>
		<span class="conf" class:warn={weak} title="Confidence: how safe this judgement is to act on"
			>{formatScore(hit.relevanceConfidence)}</span
		>
	</div>

	<p class="hit-desc">{hit.description ?? 'No description on GitHub.'}</p>

	{#if usage || detail}
		<p class="hit-detail">
			{#if usage}<span class="tag" title={usageAbout}>{usage}</span>{/if}
			{#if also}<span class="also" title={alsoAbout}>also {also}</span>{/if}
			{#if detail}<span title={detailAbout}>{detail}</span>{/if}
		</p>
	{/if}
</article>
