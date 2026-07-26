<script lang="ts">
	import { dbStore } from '$lib/stores/db.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { base } from '$app/paths';
	import SnippetCard from '$lib/components/SnippetCard.svelte';
	import {
		Loader2,
		Plus,
		AlertTriangle,
		ArrowUpDown,
		Edit2,
		Trash2,
		Save,
		X,
		Search
	} from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { draggable, droppable, type DragDropState } from '@thisux/sveltednd';

	let selectedCategoryId = $state<string | null>(null);
	let newlyCreatedSnippetId = $state<string | null>(null);
	let isReorderMode = $state(false);
	let searchQuery = $state('');
	let massDeleteModal: HTMLDialogElement;

	function confirmMassDelete() {
		dbStore.data.snippets = dbStore.data.snippets.filter(
			(s) => !dbStore.editingSnippetIds.includes(s.id)
		);
		dbStore.editingSnippetIds = [];
		dbStore.save();
	}

	let groupedSnippets = $derived(
		(() => {
			const groups: { categoryId: string; category: any; snippets: any[] }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
			const categoryIds = selectedCategoryId
				? [selectedCategoryId]
				: dbStore.data.categories.map((c) => c.id);

			for (const catId of categoryIds) {
				const cat = dbStore.data.categories.find((c) => c.id === catId);
				let snips = dbStore.data.snippets.filter((s) => s.categoryId === catId);

				if (searchQuery.trim()) {
					const query = searchQuery.toLowerCase();
					snips = snips.filter((s) =>
						Object.values(s.content).some((val) => val.toLowerCase().includes(query))
					);
				}

				if (
					snips.length > 0 ||
					(!searchQuery.trim() && selectedCategoryId === catId && dbStore.data.snippets.length > 0)
				) {
					// We only show empty groups if it's the currently selected category and there are NO snippets at all, which is handled in the template.
					groups.push({ categoryId: catId, category: cat, snippets: snips });
				}
			}

			if (!selectedCategoryId) {
				let uncategorizedSnippets = dbStore.data.snippets.filter(
					(s) => !dbStore.data.categories.find((c) => c.id === s.categoryId)
				);

				if (searchQuery.trim()) {
					const query = searchQuery.toLowerCase();
					uncategorizedSnippets = uncategorizedSnippets.filter((s) =>
						Object.values(s.content).some((val) => val.toLowerCase().includes(query))
					);
				}

				if (uncategorizedSnippets.length > 0) {
					groups.push({
						categoryId: '',
						category: { name: 'Uncategorized', icon: '❓' },
						snippets: uncategorizedSnippets
					});
				}
			}

			return groups;
		})()
	);

	function addSnippet() {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();
		const newSnippet = {
			id,
			categoryId: selectedCategoryId || dbStore.data.categories[0]?.id || '',
			content: {},
			createdAt: now,
			updatedAt: now
		};
		dbStore.data.snippets.unshift(newSnippet);
		newlyCreatedSnippetId = id;
		dbStore.save();
	}

	function handleDrop(state: DragDropState<(typeof dbStore.data.snippets)[0]>) {
		const { draggedItem, targetContainer, dropPosition } = state;
		if (!targetContainer) return;

		const splitIndex = targetContainer.lastIndexOf(':');
		let targetCategoryId = targetContainer;
		let dropIndex = -1;

		if (splitIndex !== -1) {
			targetCategoryId = targetContainer.substring(0, splitIndex);
			dropIndex = parseInt(targetContainer.substring(splitIndex + 1));
		}

		if (dropPosition === 'after') dropIndex++;

		const snippet = draggedItem;
		const dbOldIndex = dbStore.data.snippets.findIndex((s) => s.id === snippet.id);
		if (dbOldIndex === -1) return;

		const items = [...dbStore.data.snippets];
		const [moved] = items.splice(dbOldIndex, 1);
		moved.categoryId = targetCategoryId;
		moved.updatedAt = new Date().toISOString();

		if (dropIndex !== -1) {
			const snipsInGroup = items.filter((s) => (s.categoryId || '') === targetCategoryId);
			const targetItem = snipsInGroup[dropIndex];

			if (targetItem) {
				const dbTargetIndex = items.findIndex((s) => s.id === targetItem.id);
				items.splice(dbTargetIndex, 0, moved);
			} else {
				if (snipsInGroup.length > 0) {
					const lastItem = snipsInGroup[snipsInGroup.length - 1];
					const dbLastIndex = items.findIndex((s) => s.id === lastItem.id);
					items.splice(dbLastIndex + 1, 0, moved);
				} else {
					items.push(moved);
				}
			}
		} else {
			items.push(moved);
		}

		dbStore.data.snippets = items;
		dbStore.save();
	}
</script>

<svelte:head>
	<title>Copypasta - Home</title>
</svelte:head>

{#if !authStore.isValid && !dbStore.data.settings.dismissedSyncWarning}
	<div class="mb-6 alert alert-warning">
		<AlertTriangle class="h-5 w-5" />
		<div>
			<h3 class="font-bold">Sync Not Configured</h3>
			<div class="text-xs">
				Your snippets are only saved locally. To sync across devices, please configure GitHub Gist
				settings.
			</div>
		</div>
		<div class="flex items-center gap-2">
			<a href="{base}/settings" class="btn btn-sm">Configure Sync</a>
			<button
				class="btn btn-square btn-sm"
				onclick={() => {
					dbStore.data.settings.dismissedSyncWarning = true;
					dbStore.save();
				}}
				aria-label="Dismiss"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	</div>
{/if}

{#if dbStore.isLoading && dbStore.data.snippets.length === 0}
	<div class="flex justify-center py-20">
		<Loader2 class="h-12 w-12 animate-spin text-primary" />
	</div>
{:else}
	<div class="flex flex-col gap-6 md:flex-row md:items-start">
		<!-- Sidebar Categories -->
		<div class="w-full flex-shrink-0 md:w-64">
			<div class="sticky top-24 rounded-box border border-base-200 bg-base-100 p-4 shadow-sm">
				<h2 class="mb-4 px-2 text-lg font-bold">Categories</h2>
				<ul class="menu w-full p-0">
					<li
						use:droppable={{
							container: '',
							disabled: !isReorderMode,
							callbacks: { onDrop: handleDrop },
							attributes: {
								dragOverClass:
									'bg-primary/20 outline-2 outline-offset-[-2px] outline-primary/50 outline-dashed rounded-box'
							}
						}}
					>
						<button
							class={!selectedCategoryId ? 'menu-active text-left' : 'text-left'}
							onclick={() => (selectedCategoryId = null)}
						>
							All Snippets
						</button>
					</li>
					{#each dbStore.data.categories as category (category.id)}
						<li
							use:droppable={{
								container: category.id,
								disabled: !isReorderMode,
								callbacks: { onDrop: handleDrop },
								attributes: {
									dragOverClass:
										'bg-primary/20 outline-2 outline-offset-[-2px] outline-primary/50 outline-dashed rounded-box'
								}
							}}
						>
							<button
								class={`text-left transition-colors ${selectedCategoryId === category.id ? 'menu-active' : ''}`}
								onclick={() => (selectedCategoryId = category.id)}
							>
								<span class="mr-1">{category.icon || '📁'}</span>
								{category.name}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<!-- Snippets Grid -->
		<div class="flex-1">
			<div class="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
				<h1 class="flex items-center text-2xl font-bold">
					{#if selectedCategoryId}
						{@const category = dbStore.data.categories.find((c) => c.id === selectedCategoryId)}
						<span class="mr-2">{category?.icon || '📁'}</span>
						{category?.name}
					{:else}
						All Snippets
					{/if}
				</h1>
				<div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
					<label class="input-bordered input flex w-full items-center gap-2 input-sm sm:w-48">
						<Search class="h-4 w-4 opacity-50" />
						<input
							type="text"
							class="grow"
							placeholder="Search snippets..."
							bind:value={searchQuery}
						/>
					</label>
					<div class="flex w-full items-center gap-2 sm:w-auto">
						<select
							class="select-bordered select font-bold select-sm"
							value={dbStore.globalLanguageId}
							onchange={(e) => dbStore.setGlobalLanguageId(e.currentTarget.value)}
						>
							<option value="multiple">Multiple</option>
							{#each dbStore.data.settings.languages as lang (lang.id)}
								<option value={lang.id}>{lang.name}</option>
							{/each}
						</select>
						<button
							class={`btn btn-sm ${isReorderMode ? 'btn-secondary' : 'border border-base-300 btn-ghost'}`}
							onclick={() => (isReorderMode = !isReorderMode)}
						>
							<ArrowUpDown class="h-4 w-4" /> Reorder
						</button>
						<button class="btn btn-primary btn-sm" onclick={addSnippet}>
							<Plus class="h-4 w-4" /> Add
						</button>
					</div>
				</div>
			</div>

			{#if dbStore.editingSnippetIds.length > 1}
				<div
					class="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
					transition:slide={{ duration: 300 }}
				>
					<div class="flex items-center gap-2 text-sm font-bold text-base-content/70">
						<Edit2 class="h-4 w-4" />
						Editing {dbStore.editingSnippetIds.length} snippets
					</div>
					<div class="flex w-full gap-2 overflow-x-auto pb-1 sm:w-auto sm:pb-0">
						<button
							class="btn flex-1 btn-ghost btn-error btn-sm sm:flex-none"
							onclick={() => massDeleteModal.showModal()}
						>
							<Trash2 class="h-4 w-4" /> Delete All
						</button>
						<button
							class="btn flex-1 btn-ghost btn-sm sm:flex-none"
							onclick={() => window.dispatchEvent(new CustomEvent('cancel-all'))}
						>
							<X class="h-4 w-4" /> Cancel All
						</button>
						<button
							class="btn flex-1 btn-sm btn-success sm:flex-none"
							onclick={() => window.dispatchEvent(new CustomEvent('save-all'))}
						>
							<Save class="h-4 w-4" /> Save All
						</button>
					</div>
				</div>
			{/if}

			{#if groupedSnippets.length === 0}
				<div
					class="rounded-box border border-dashed border-base-200 bg-base-100 py-12 text-center"
					transition:slide={{ duration: 300 }}
					use:droppable={{
						container: selectedCategoryId || '',
						disabled: !isReorderMode,
						callbacks: { onDrop: handleDrop }
					}}
				>
					{#if searchQuery.trim()}
						<p class="text-base-content/60">No snippets found matching "{searchQuery}".</p>
					{:else}
						<p class="mb-4 text-base-content/60">No snippets found in this category.</p>
						<button class="btn btn-outline btn-sm" onclick={addSnippet}>
							Create First Snippet
						</button>
					{/if}
				</div>
			{:else}
				<div class="flex flex-col gap-6">
					{#each groupedSnippets as group (group.categoryId)}
						<div>
							{#if !selectedCategoryId}
								<div class="divider text-sm font-bold text-base-content/50">
									{group.category?.icon || '📁'}
									{group.category?.name || 'Unknown'}
								</div>
							{/if}

							<div
								class={`grid gap-4 ${dbStore.columnCount === '1' ? 'grid-cols-1' : dbStore.columnCount === '3' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : dbStore.columnCount === '4' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : dbStore.columnCount === 'auto' ? '' : 'grid-cols-1 lg:grid-cols-2'}`}
								style={dbStore.columnCount === 'auto'
									? 'grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));'
									: ''}
							>
								{#each group.snippets as snippet, index (snippet.id)}
									<div
										animate:flip={{ duration: 300 }}
										class={isReorderMode ? 'cursor-grab active:cursor-grabbing' : ''}
										use:draggable={{
											container: group.categoryId + ':' + index,
											dragData: snippet,
											disabled: !isReorderMode,
											attributes: {
												draggingClass: 'opacity-50 scale-105 transition-transform duration-200 z-50'
											}
										}}
										use:droppable={{
											container: group.categoryId + ':' + index,
											direction: 'grid',
											disabled: !isReorderMode,
											callbacks: { onDrop: handleDrop }
										}}
									>
										<SnippetCard
											{snippet}
											startInEditMode={snippet.id === newlyCreatedSnippetId}
											{isReorderMode}
											onEditComplete={() => {
												if (snippet.id === newlyCreatedSnippetId) newlyCreatedSnippetId = null;
											}}
										/>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<dialog bind:this={massDeleteModal} class="modal">
	<div class="modal-box">
		<h3 class="flex items-center gap-2 text-lg font-bold text-error">
			<Trash2 class="h-5 w-5" /> Delete {dbStore.editingSnippetIds.length} Snippets?
		</h3>
		<p class="py-4">
			Are you sure you want to delete all currently editing snippets? This action cannot be undone.
		</p>
		<div class="modal-action">
			<form method="dialog">
				<button class="btn">Cancel</button>
				<button class="btn btn-error" onclick={confirmMassDelete}>Delete All</button>
			</form>
		</div>
	</div>
</dialog>

<style>
	/* Hide sveltednd blue drop indicator lines in the categories menu */
	.menu :global(.drop-before::before),
	.menu :global(.drop-after::after) {
		display: none !important;
	}
</style>
