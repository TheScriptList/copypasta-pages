<script lang="ts">
	import { dbStore } from '$lib/stores/db.svelte';
	import { Trash2, GripVertical, Plus, ChevronUp, ChevronDown } from '@lucide/svelte';
	import Sortable from 'sortablejs';
	import { onMount } from 'svelte';

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

	function sortable(node: HTMLElement) {
		const sortableInstance = new Sortable(node, {
			animation: 150,
			handle: '.drag-handle',
			onEnd: (evt) => {
				const { oldIndex, newIndex } = evt;
				if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
					const items = [...dbStore.data.categories];
					const [movedItem] = items.splice(oldIndex, 1);
					items.splice(newIndex, 0, movedItem);
					dbStore.data.categories = items;
					dbStore.save();
				}
			}
		});
		return {
			destroy() {
				sortableInstance.destroy();
			}
		};
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
	<title>Categories - Copypasta</title>
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
				<ul class="divide-y divide-base-200" use:sortable>
					{#each dbStore.data.categories as category, index (category.id)}
						<li
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
		<p class="py-4">Are you sure you want to delete this category? This action cannot be undone.</p>
		<div class="modal-action">
			<form method="dialog">
				<button class="btn" onclick={() => (categoryToDeleteId = null)}>Cancel</button>
				<button class="btn btn-error" onclick={confirmDelete}>Delete</button>
			</form>
		</div>
	</div>
</dialog>
