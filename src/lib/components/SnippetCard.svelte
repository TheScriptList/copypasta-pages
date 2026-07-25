<script lang="ts">
	import { dbStore, type Snippet } from '$lib/stores/db.svelte';
	import { Check, Edit2, Save, X, Clock, Trash2 } from '@lucide/svelte';
	import { fade, scale, slide } from 'svelte/transition';
	import { backOut } from 'svelte/easing';

	let {
		snippet,
		startInEditMode = false,
		isReorderMode = false,
		onEditComplete
	}: {
		snippet: Snippet;
		startInEditMode?: boolean;
		isReorderMode?: boolean;
		onEditComplete?: () => void;
	} = $props();

	let copiedId = $state<string | null>(null);

	// svelte-ignore state_referenced_locally
	let isEditing = $state(startInEditMode);
	// svelte-ignore state_referenced_locally
	let editContents = $state<Record<string, string>>(startInEditMode ? { ...snippet.content } : {});
	let deleteModal: HTMLDialogElement;

	let activeContent = $derived(snippet.content[dbStore.globalLanguageId] || '');
	let languagesShowingInMultiple = $derived(
		dbStore.data.settings.languages.filter((l) => l.showInMultiple)
	);

	import { onMount, onDestroy, untrack } from 'svelte';

	$effect(() => {
		const editing = isEditing;
		const id = snippet.id;
		untrack(() => {
			if (editing) {
				if (!dbStore.editingSnippetIds.includes(id)) {
					dbStore.editingSnippetIds.push(id);
				}
			} else {
				dbStore.editingSnippetIds = dbStore.editingSnippetIds.filter(
					(existingId) => existingId !== id
				);
			}
		});
	});

	$effect(() => {
		if (isReorderMode && isEditing) {
			isEditing = false;
		}
	});

	function handleGlobalSave() {
		if (isEditing) saveEdit();
	}

	function handleGlobalCancel() {
		if (isEditing) cancelEdit();
	}

	onMount(() => {
		window.addEventListener('save-all', handleGlobalSave);
		window.addEventListener('cancel-all', handleGlobalCancel);
	});

	onDestroy(() => {
		dbStore.editingSnippetIds = dbStore.editingSnippetIds.filter((id) => id !== snippet.id);
		if (typeof window !== 'undefined') {
			window.removeEventListener('save-all', handleGlobalSave);
			window.removeEventListener('cancel-all', handleGlobalCancel);
		}
	});

	function getRelativeTime(dateString: string) {
		if (!dateString) return 'Just now';
		const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
		const date = new Date(dateString);
		const diffInMs = date.getTime() - Date.now();
		const diffInSeconds = Math.round(diffInMs / 1000);

		if (Math.abs(diffInSeconds) < 60) return rtf.format(diffInSeconds, 'second');
		const diffInMinutes = Math.round(diffInSeconds / 60);
		if (Math.abs(diffInMinutes) < 60) return rtf.format(diffInMinutes, 'minute');
		const diffInHours = Math.round(diffInMinutes / 60);
		if (Math.abs(diffInHours) < 24) return rtf.format(diffInHours, 'hour');
		const diffInDays = Math.round(diffInHours / 24);
		if (Math.abs(diffInDays) < 30) return rtf.format(diffInDays, 'day');
		const diffInMonths = Math.round(diffInDays / 30);
		if (Math.abs(diffInMonths) < 12) return rtf.format(diffInMonths, 'month');
		const diffInYears = Math.round(diffInMonths / 12);
		return rtf.format(diffInYears, 'year');
	}

	async function handleCopy(content: string, id: string = 'single') {
		if (isEditing || isReorderMode || !content) return;
		try {
			await navigator.clipboard.writeText(content);
			copiedId = id;
			setTimeout(() => {
				if (copiedId === id) copiedId = null;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy text: ', err);
		}
	}

	function startEdit() {
		editContents = { ...snippet.content };
		isEditing = true;
	}

	function cancelEdit() {
		isEditing = false;
		if (onEditComplete) onEditComplete();
	}

	function saveEdit() {
		const dbSnippet = dbStore.data.snippets.find((s) => s.id === snippet.id);
		if (dbSnippet) {
			dbSnippet.content = { ...editContents };
			dbSnippet.updatedAt = new Date().toISOString();
			dbStore.save();
		}
		isEditing = false;
		if (onEditComplete) onEditComplete();
	}

	function openDeleteModal() {
		deleteModal.showModal();
	}

	function confirmDelete() {
		dbStore.data.snippets = dbStore.data.snippets.filter((s) => s.id !== snippet.id);
		dbStore.save();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isEditing) return;
		if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			saveEdit();
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			cancelEdit();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class={`snippet-card card border border-base-200 bg-base-100 shadow-xl ${isReorderMode ? 'shake-animation cursor-grab active:cursor-grabbing' : ''}`}
	data-id={snippet.id}
	transition:scale={{ duration: 300, start: 0.9, opacity: 0, easing: backOut }}
>
	<div class="pointer-events-none card-body p-4">
		<div
			class={`flex items-start justify-between ${isReorderMode ? 'opacity-50' : 'pointer-events-auto'}`}
		>
			<div class="flex flex-col gap-1">
				<div
					class="tooltip tooltip-bottom tooltip-right"
					data-tip={new Date(snippet.updatedAt).toLocaleString()}
				>
					<div class="mt-1 flex w-max cursor-help items-center gap-1 text-xs text-base-content/50">
						<Clock class="h-3 w-3" />
						Updated {getRelativeTime(snippet.updatedAt)}
					</div>
				</div>
			</div>

			{#if isEditing}
				<div class="flex gap-1">
					<button
						class="btn btn-circle btn-ghost text-error btn-sm"
						onclick={openDeleteModal}
						title="Delete"
					>
						<Trash2 class="h-4 w-4" />
					</button>
					<button
						class="btn btn-circle btn-ghost text-base-content/50 btn-sm"
						onclick={cancelEdit}
						title="Cancel"
					>
						<X class="h-4 w-4" />
					</button>
					<button
						class="btn btn-circle btn-ghost text-success btn-sm"
						onclick={saveEdit}
						title="Save"
					>
						<Save class="h-4 w-4" />
					</button>
				</div>
			{:else}
				<button
					class="btn btn-circle btn-ghost btn-sm"
					onclick={startEdit}
					title="Edit snippet"
					disabled={isReorderMode}
				>
					<Edit2 class="h-4 w-4" />
				</button>
			{/if}
		</div>

		<div class={isReorderMode ? 'pointer-events-none' : 'pointer-events-auto'}>
			{#if isEditing}
				<div
					class="flex flex-col gap-4"
					in:slide={{ duration: 250, delay: 250 }}
					out:slide={{ duration: 250 }}
				>
					{#each dbStore.data.settings.languages as lang (lang.id)}
						<div>
							<label class="label pt-0 pb-1" for="content-{snippet.id}-{lang.id}"
								><span class="label-text text-xs font-bold">{lang.name} Content</span></label
							>
							<textarea
								id="content-{snippet.id}-{lang.id}"
								class="textarea-bordered textarea w-full font-mono text-sm leading-relaxed"
								rows="3"
								bind:value={editContents[lang.id]}
								placeholder="Enter {lang.name} snippet..."></textarea>
						</div>
					{/each}
				</div>
			{:else}
				<div in:slide={{ duration: 250, delay: 250 }} out:slide={{ duration: 250 }}>
					{#if dbStore.globalLanguageId === 'multiple'}
						<div class="flex flex-col gap-3">
							{#each languagesShowingInMultiple as lang (lang.id)}
								{#if snippet.content[lang.id]}
									<div
										class="flex flex-col gap-1 {dbStore.data.settings.hideLanguageTitles ? 'tooltip tooltip-top hover:before:delay-1000 hover:after:delay-1000 before:z-50' : ''}"
										data-tip={dbStore.data.settings.hideLanguageTitles ? lang.name : null}
									>
										{#if !dbStore.data.settings.hideLanguageTitles}
											<span class="px-1 text-xs font-bold opacity-60">{lang.name}</span>
										{/if}
										<button
											class="group relative block min-h-12 w-full cursor-pointer rounded-lg bg-base-200 p-3 text-left font-mono text-sm break-words whitespace-pre-wrap transition-colors hover:bg-base-300"
											onclick={() => handleCopy(snippet.content[lang.id], lang.id)}
											aria-label="Copy snippet for {lang.name}"
											disabled={isReorderMode}
										>
											{snippet.content[lang.id]}
											{#if copiedId === lang.id}
												<div
													class="absolute inset-0 flex items-center justify-center rounded-lg bg-success/20 backdrop-blur-sm"
													transition:fade={{ duration: 150 }}
												>
													<div
														class="flex items-center gap-2 rounded-full bg-success px-3 py-1 font-sans font-bold text-success-content shadow-sm"
														transition:scale={{ duration: 300, start: 0.8, opacity: 0, easing: backOut }}
													>
														<Check class="h-4 w-4" /> Copied
													</div>
												</div>
											{/if}
										</button>
									</div>
								{/if}
							{/each}
							{#if languagesShowingInMultiple.every((lang) => !snippet.content[lang.id])}
								<button
									class="group relative block min-h-12 w-full cursor-pointer rounded-lg bg-base-200 p-3 text-left font-mono text-sm break-words whitespace-pre-wrap transition-colors hover:bg-base-300"
									disabled={true}
								>
									Empty snippet
								</button>
							{/if}
						</div>
					{:else}
						<button
							class="group relative block min-h-12 w-full cursor-pointer rounded-lg bg-base-200 p-3 text-left font-mono text-sm break-words whitespace-pre-wrap transition-colors hover:bg-base-300"
							onclick={() => handleCopy(activeContent, 'single')}
							aria-label="Copy snippet"
							disabled={isReorderMode}
						>
							{activeContent || 'Empty snippet'}
							{#if copiedId === 'single'}
								<div
									class="absolute inset-0 flex items-center justify-center rounded-lg bg-success/20 backdrop-blur-sm"
									transition:fade={{ duration: 150 }}
								>
									<div
										class="flex items-center gap-2 rounded-full bg-success px-3 py-1 font-sans font-bold text-success-content shadow-sm"
										transition:scale={{ duration: 300, start: 0.8, opacity: 0, easing: backOut }}
									>
										<Check class="h-4 w-4" /> Copied
									</div>
								</div>
							{/if}
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<dialog bind:this={deleteModal} class="modal">
	<div class="modal-box">
		<h3 class="flex items-center gap-2 text-lg font-bold text-error">
			<Trash2 class="h-5 w-5" /> Delete Snippet?
		</h3>
		<p class="py-4">Are you sure you want to delete this snippet? This action cannot be undone.</p>
		<div class="modal-action">
			<form method="dialog">
				<button class="btn">Cancel</button>
				<button class="btn btn-error" onclick={confirmDelete}>Delete</button>
			</form>
		</div>
	</div>
</dialog>

<style>
	@keyframes shake {
		0%,
		100% {
			rotate: 0deg;
		}
		25% {
			rotate: -0.5deg;
		}
		75% {
			rotate: 0.5deg;
		}
	}
	.shake-animation {
		animation: shake 0.3s ease-in-out infinite;
	}
</style>
