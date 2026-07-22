<script lang="ts">
	import { dbStore } from '$lib/stores/db.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import SnippetCard from '$lib/components/SnippetCard.svelte';
	import { Loader2, Plus, ArrowRight, AlertTriangle, ArrowUpDown } from 'lucide-svelte';
	import Sortable from 'sortablejs';

	let selectedCategoryId = $state<string | null>(null);
	let newlyCreatedSnippetId = $state<string | null>(null);
	let isReorderMode = $state(false);
	let draggedSnippetId = $state<string | null>(null);
	let dragOverCategoryId = $state<string | null>(null);

	let groupedSnippets = $derived(
		(() => {
			const groups: { categoryId: string, category: any, snippets: any[] }[] = [];
			const categoryIds = selectedCategoryId ? [selectedCategoryId] : dbStore.data.categories.map(c => c.id);
			
			for (const catId of categoryIds) {
				const cat = dbStore.data.categories.find(c => c.id === catId);
				const snips = dbStore.data.snippets.filter(s => s.categoryId === catId);
				if (snips.length > 0 || (selectedCategoryId === catId && dbStore.data.snippets.length > 0)) {
					// We only show empty groups if it's the currently selected category and there are NO snippets at all, which is handled in the template.
					groups.push({ categoryId: catId, category: cat, snippets: snips });
				}
			}
			
			if (!selectedCategoryId) {
				const uncategorizedSnippets = dbStore.data.snippets.filter(s => !dbStore.data.categories.find(c => c.id === s.categoryId));
				if (uncategorizedSnippets.length > 0) {
					groups.push({ categoryId: '', category: { name: 'Uncategorized', icon: '❓' }, snippets: uncategorizedSnippets });
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

	function sortableGroup(node: HTMLElement, categoryId: string) {
		let sortableInstance: Sortable | null = null;
		
		$effect(() => {
			if (isReorderMode) {
				sortableInstance = new Sortable(node, {
					animation: 150,
					delay: 100,
					delayOnTouchOnly: true,
					group: 'snippets',
					onStart: (evt) => {
						draggedSnippetId = evt.item.dataset.id || null;
					},
					onEnd: (evt) => {
						draggedSnippetId = null;
						dragOverCategoryId = null;
						
						// Within same group
						if (evt.to === node) {
							const { oldIndex, newIndex } = evt;
							if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
								const snipsInGroup = dbStore.data.snippets.filter(s => (s.categoryId || '') === categoryId);
								const item = snipsInGroup[oldIndex];
								const targetItem = snipsInGroup[newIndex];
								
								if (item && targetItem) {
									const dbOldIndex = dbStore.data.snippets.findIndex(s => s.id === item.id);
									const dbNewIndex = dbStore.data.snippets.findIndex(s => s.id === targetItem.id);
									
									if (dbOldIndex !== -1 && dbNewIndex !== -1) {
										const items = [...dbStore.data.snippets];
										const [moved] = items.splice(dbOldIndex, 1);
										items.splice(dbNewIndex, 0, moved);
										dbStore.data.snippets = items;
										dbStore.save();
									}
								}
							}
						}
					},
					onAdd: (evt) => {
						const snippetId = evt.item.dataset.id;
						const { newIndex } = evt;
						if (snippetId && newIndex !== undefined) {
							const snippetIndex = dbStore.data.snippets.findIndex(s => s.id === snippetId);
							if (snippetIndex !== -1) {
								const items = [...dbStore.data.snippets];
								const [moved] = items.splice(snippetIndex, 1);
								moved.categoryId = categoryId;
								moved.updatedAt = new Date().toISOString();
								
								const snipsInGroup = items.filter(s => (s.categoryId || '') === categoryId);
								const targetItem = snipsInGroup[newIndex];
								
								if (targetItem) {
									const dbTargetIndex = items.findIndex(s => s.id === targetItem.id);
									items.splice(dbTargetIndex, 0, moved);
								} else {
									items.push(moved);
								}
								
								dbStore.data.snippets = items;
								dbStore.save();
							}
						}
					}
				});
			} else {
				if (sortableInstance) {
					sortableInstance.destroy();
					sortableInstance = null;
				}
			}
		});
		
		return {
			destroy() {
				if (sortableInstance) sortableInstance.destroy();
			}
		};
	}

	function handleDragOver(e: DragEvent, categoryId: string | null) {
		if (isReorderMode && draggedSnippetId && categoryId !== null) {
			e.preventDefault();
			dragOverCategoryId = categoryId;
		}
	}

	function handleDragLeave(e: DragEvent, categoryId: string | null) {
		if (dragOverCategoryId === categoryId) {
			dragOverCategoryId = null;
		}
	}

	function handleDrop(e: DragEvent, categoryId: string | null) {
		if (isReorderMode && draggedSnippetId && categoryId !== null) {
			e.preventDefault();
			const snippet = dbStore.data.snippets.find(s => s.id === draggedSnippetId);
			if (snippet && snippet.categoryId !== categoryId) {
				snippet.categoryId = categoryId;
				snippet.updatedAt = new Date().toISOString();
				dbStore.save();
			}
			dragOverCategoryId = null;
		}
	}
</script>

<svelte:head>
	<title>Copypasta - Home</title>
</svelte:head>

{#if !authStore.isValid}
	<div class="alert alert-warning mb-6">
		<AlertTriangle class="w-5 h-5" />
		<div>
			<h3 class="font-bold">Sync Not Configured</h3>
			<div class="text-xs">Your snippets are only saved locally. To sync across devices, please configure GitHub Gist settings.</div>
		</div>
		<a href="/settings" class="btn btn-sm">Configure Sync</a>
	</div>
{/if}

{#if dbStore.isLoading && dbStore.data.snippets.length === 0}
	<div class="flex justify-center py-20">
		<Loader2 class="w-12 h-12 animate-spin text-primary" />
	</div>
{:else}
	<div class="flex flex-col md:flex-row gap-6">
		<!-- Sidebar Categories -->
		<div class="w-full md:w-64 flex-shrink-0">
			<div class="bg-base-100 p-4 rounded-box shadow-sm border border-base-200 sticky top-24">
				<h2 class="text-lg font-bold mb-4 px-2">Categories</h2>
				<ul class="menu w-full p-0">
					<li>
						<button 
							class={!selectedCategoryId ? 'active text-left' : 'text-left'} 
							onclick={() => (selectedCategoryId = null)}
						>
							All Snippets
						</button>
					</li>
					{#each dbStore.data.categories as category}
						<li 
							ondragover={(e) => handleDragOver(e, category.id)}
							ondragleave={(e) => handleDragLeave(e, category.id)}
							ondrop={(e) => handleDrop(e, category.id)}
						>
							<button 
								class={`text-left transition-colors ${selectedCategoryId === category.id ? 'active' : ''} ${dragOverCategoryId === category.id ? 'bg-primary/20 outline-dashed outline-2 outline-primary/50 outline-offset-[-2px]' : ''}`}
								onclick={() => (selectedCategoryId = category.id)}
							>
								{#if category.icon}
									<span class="mr-1">{category.icon}</span>
								{/if}
								{category.name}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<!-- Snippets Grid -->
		<div class="flex-1">
			<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
				<h1 class="text-2xl font-bold">
					{selectedCategoryId 
						? dbStore.data.categories.find(c => c.id === selectedCategoryId)?.name 
						: 'All Snippets'}
				</h1>
				<div class="flex items-center gap-2 w-full sm:w-auto">
					<select 
						class="select select-bordered select-sm font-bold" 
						value={dbStore.globalLanguageId}
						onchange={(e) => dbStore.setGlobalLanguageId(e.currentTarget.value)}
					>
						{#each dbStore.data.settings.languages as lang}
							<option value={lang.id}>{lang.name}</option>
						{/each}
					</select>
					<button 
						class={`btn btn-sm ${isReorderMode ? 'btn-secondary' : 'btn-ghost border border-base-300'}`} 
						onclick={() => (isReorderMode = !isReorderMode)}
					>
						<ArrowUpDown class="w-4 h-4" /> Reorder
					</button>
					<button class="btn btn-primary btn-sm" onclick={addSnippet}>
						<Plus class="w-4 h-4" /> Add
					</button>
				</div>
			</div>

			{#if groupedSnippets.length === 0}
				<div class="text-center py-12 bg-base-100 rounded-box border border-base-200 border-dashed">
					<p class="text-base-content/60 mb-4">No snippets found in this category.</p>
					<button class="btn btn-outline btn-sm" onclick={addSnippet}>
						Create First Snippet
					</button>
				</div>
			{:else}
				<div class="flex flex-col gap-6">
					{#each groupedSnippets as group (group.categoryId)}
						<div>
							{#if !selectedCategoryId}
								<div class="divider text-sm font-bold text-base-content/50">
									{group.category?.icon || ''} {group.category?.name || 'Unknown'}
								</div>
							{/if}
							
							<div class={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${isReorderMode ? 'cursor-grab active:cursor-grabbing' : ''}`} use:sortableGroup={group.categoryId}>
								{#each group.snippets as snippet (snippet.id)}
									<SnippetCard 
										{snippet} 
										startInEditMode={snippet.id === newlyCreatedSnippetId} 
										{isReorderMode} 
										onEditComplete={() => { if (snippet.id === newlyCreatedSnippetId) newlyCreatedSnippetId = null; }}
									/>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
