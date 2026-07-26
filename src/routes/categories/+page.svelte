<script lang="ts">
	import { dbStore } from '$lib/stores/db.svelte';
	import { Trash2, GripVertical, Plus, ChevronUp, ChevronDown } from '@lucide/svelte';
	import { draggable, droppable, type DragDropState } from '@thisux/sveltednd';
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';

	let newCategoryName = $state('');
	let newCategoryEmoji = $state('');

	onMount(() => {
		import('emoji-picker-element');
	});

	function emojiPicker(node: HTMLElement, callback: (emoji: string) => void) {
		const handler = (e: Event) => callback((e as CustomEvent).detail.unicode);
		node.addEventListener('emoji-click', handler);
		return {
			destroy() {
				node.removeEventListener('emoji-click', handler);
			}
		};
	}

	function handleDrop(state: DragDropState<typeof dbStore.data.categories[0]>) {
		const { draggedItem, targetContainer, dropPosition } = state;
		if (!targetContainer) return;
		
		const dragIndex = dbStore.data.categories.findIndex((c) => c.id === draggedItem.id);
		let dropIndex = parseInt(targetContainer ?? '0');
		if (dropPosition === 'after') dropIndex++;

		if (dragIndex !== -1) {
			const items = [...dbStore.data.categories];
			const [category] = items.splice(dragIndex, 1);
			const adjusted = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
			items.splice(adjusted, 0, category);
			dbStore.data.categories = items;
			dbStore.save();
		}
	}

	function moveCategory(index: number, direction: -1 | 1) {
		const newIndex = index + direction;
		if (newIndex >= 0 && newIndex < dbStore.data.categories.length) {
			const items = [...dbStore.data.categories];
			const [movedItem] = items.splice(index, 1);
			items.splice(newIndex, 0, movedItem);
			dbStore.data.categories = items;
			dbStore.save();
		}
	}

	function addCategory() {
		if (newCategoryName.trim()) {
			dbStore.data.categories.push({
				id: crypto.randomUUID(),
				name: newCategoryName.trim(),
				icon: newCategoryEmoji.trim()
			});
			dbStore.save();
			newCategoryName = '';
			newCategoryEmoji = '';
		}
	}

	let deleteModal: HTMLDialogElement;
	let categoryToDeleteId: string | null = $state(null);

	function openDeleteModal(id: string) {
		categoryToDeleteId = id;
		deleteModal.showModal();
	}

	function confirmDelete() {
		if (categoryToDeleteId) {
			dbStore.data.categories = dbStore.data.categories.filter((c) => c.id !== categoryToDeleteId);
			dbStore.save();
			categoryToDeleteId = null;
		}
	}
</script>

<svelte:head>
	<title>Copypasta - Categories</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">Categories</h1>
	</div>

	<!-- Add Category -->
	<div class="card border border-base-200 bg-base-100 shadow-sm">
		<div class="card-body flex-row items-center gap-4 overflow-visible p-4">
			<div class="dropdown dropdown-bottom">
				<div tabindex="0" role="button" class="btn w-16 btn-soft text-xl">
					{newCategoryEmoji || '😀'}
				</div>
				<div
					tabindex="-1"
					class="dropdown-content z-[1] w-[350px] rounded-box bg-base-100 p-2 shadow"
				>
					<emoji-picker
						class="w-full"
						use:emojiPicker={(emoji) => {
							newCategoryEmoji = emoji;
							if (document.activeElement instanceof HTMLElement) {
								document.activeElement.blur();
							}
						}}
					></emoji-picker>
				</div>
			</div>

			<input
				type="text"
				placeholder="New Category Name"
				class="input-bordered input flex-1"
				bind:value={newCategoryName}
				onkeydown={(e) => e.key === 'Enter' && addCategory()}
			/>
			<button class="btn btn-primary" onclick={addCategory} disabled={!newCategoryName.trim()}>
				<Plus class="h-5 w-5" /> Add
			</button>
		</div>
	</div>

	<!-- Categories List -->
	<div class="card border border-base-200 bg-base-100 shadow-sm">
		<div class="card-body p-0">
			{#if dbStore.data.categories.length === 0}
				<div class="p-8 text-center text-base-content/60">No categories yet. Add one above.</div>
			{:else}
				<ul class="divide-y divide-base-200">
					{#each dbStore.data.categories as category, index (category.id)}
						{@const snippetCount = dbStore.data.snippets.filter((s) => s.categoryId === category.id).length}
						<li
							animate:flip={{ duration: 300 }}
							use:draggable={{ container: index.toString(), dragData: category, handle: '.drag-handle' }}
							use:droppable={{ container: index.toString(), callbacks: { onDrop: handleDrop } }}
							class="flex items-center gap-4 bg-base-100 p-4 transition-colors hover:bg-base-200/50"
						>
							<div
								class="drag-handle cursor-grab text-base-content/40 hover:text-base-content active:cursor-grabbing"
							>
								<GripVertical class="h-5 w-5" />
							</div>

							<div class="flex flex-col gap-1">
								<button
									class="btn h-4 min-h-0 btn-ghost p-0 btn-xs"
									disabled={index === 0}
									onclick={() => moveCategory(index, -1)}
								>
									<ChevronUp class="h-4 w-4" />
								</button>
								<button
									class="btn h-4 min-h-0 btn-ghost p-0 btn-xs"
									disabled={index === dbStore.data.categories.length - 1}
									onclick={() => moveCategory(index, 1)}
								>
									<ChevronDown class="h-4 w-4" />
								</button>
							</div>

							<div class="flex flex-1 gap-2 overflow-visible font-medium">
								<div class="dropdown dropdown-bottom">
									<div tabindex="0" role="button" class="btn w-12 btn-soft text-lg btn-sm">
										{category.icon || '😀'}
									</div>
									<div
										tabindex="-1"
										class="dropdown-content z-[1] w-[350px] rounded-box bg-base-100 p-2 shadow"
									>
										<emoji-picker
											class="w-full"
											use:emojiPicker={(emoji) => {
												category.icon = emoji;
												dbStore.save();
												if (document.activeElement instanceof HTMLElement) {
													document.activeElement.blur();
												}
											}}
										></emoji-picker>
									</div>
								</div>

								<input
									type="text"
									class="input w-full input-ghost font-medium input-sm"
									bind:value={category.name}
									onchange={() => dbStore.save()}
								/>
							</div>

							<div class="badge badge-soft badge-sm whitespace-nowrap">
								{snippetCount} {snippetCount === 1 ? 'snippet' : 'snippets'}
							</div>

							<button
								class="btn btn-ghost text-error btn-sm"
								onclick={() => openDeleteModal(category.id)}
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<dialog bind:this={deleteModal} class="modal">
	<div class="modal-box">
		<h3 class="flex items-center gap-2 text-lg font-bold text-error">
			<Trash2 class="h-5 w-5" /> Delete Category?
		</h3>
		<p class="py-2">Are you sure you want to delete this category? This action cannot be undone.</p>
		<p class="text-sm text-base-content/60">All snippets in this category will be moved to Uncategorized.</p>
		<div class="modal-action">
			<form method="dialog">
				<button class="btn" onclick={() => (categoryToDeleteId = null)}>Cancel</button>
				<button class="btn btn-error" onclick={confirmDelete}>Delete</button>
			</form>
		</div>
	</div>
</dialog>
