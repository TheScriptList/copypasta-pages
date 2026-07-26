<script lang="ts">
	import type { Snippet } from '$lib/stores/db.svelte';
	import SnippetCard from './SnippetCard.svelte';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	let {
		snippets,
		categoryId,
		isReorderMode,
		newlyCreatedSnippetId,
		onFinalize
	}: {
		snippets: Snippet[];
		categoryId: string;
		isReorderMode: boolean;
		newlyCreatedSnippetId: string | null;
		onFinalize: (categoryId: string, items: Snippet[]) => void;
	} = $props();

	let items = $state(snippets);

	$effect(() => {
		// Sync from props only when not dragging, but since svelte-dnd-action handles internal dragging,
		// we just update it whenever the external snippets array changes.
		// (Actually, if we update it during drag, it might break dnd. We only update if they differ in length or ids).
		const currentIds = items.map((i) => i.id).join(',');
		const propIds = snippets.map((i) => i.id).join(',');
		if (currentIds !== propIds) {
			items = snippets;
		}
	});

	function handleConsider(e: CustomEvent<DndEvent<Snippet>>) {
		items = e.detail.items;
	}

	function handleFinalize(e: CustomEvent<DndEvent<Snippet>>) {
		items = e.detail.items;
		onFinalize(categoryId, items);
	}
</script>

<div
	class={`grid min-h-16 grid-cols-1 gap-4 lg:grid-cols-2 ${isReorderMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
	use:dndzone={{ items, dragDisabled: !isReorderMode, flipDurationMs: 300, dropTargetStyle: {} }}
	onconsider={handleConsider}
	onfinalize={handleFinalize}
>
	{#each items as snippet (snippet.id)}
		<div animate:flip={{ duration: 300 }}>
			<SnippetCard
				{snippet}
				startInEditMode={snippet.id === newlyCreatedSnippetId}
				{isReorderMode}
				onEditComplete={() => {
					// We can ignore newlyCreatedSnippetId unset here or handle it externally
				}}
			/>
		</div>
	{/each}
</div>
