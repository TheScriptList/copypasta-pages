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

	let languagesShowingInMultiple = $derived(
		dbStore.data.settings.languages.filter((l) => l.showInMultiple)
	);
	let isMultipleMode = $derived(dbStore.globalLanguageId === 'multiple');
	let displayedLanguages = $derived.by(() => {
		if (isMultipleMode) {
			return languagesShowingInMultiple;
		}
		const lang = dbStore.data.settings.languages.find((l) => l.id === dbStore.globalLanguageId);
		return lang ? [lang] : [];
	});
	let isSlim = $derived(!!dbStore.data.settings.slimMode);

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
	class={`snippet-card group card border border-base-200 bg-base-100 shadow-xl ${isReorderMode ? 'shake-animation cursor-grab active:cursor-grabbing' : ''} ${isSlim ? 'md:overflow-hidden' : ''}`}
	style={isReorderMode
		? `animation-delay: -${Math.random() * 0.3}s; animation-duration: ${0.25 + Math.random() * 0.15}s;`
		: ''}
	data-id={snippet.id}
	transition:scale={{ duration: 300, start: 0.9, opacity: 0, easing: backOut }}
>
	<div class={`pointer-events-none card-body p-4 ${isSlim ? 'md:p-2' : ''}`}>
		<div
			class={`flex items-start justify-between ${isReorderMode ? 'opacity-50' : 'pointer-events-auto'} ${isSlim ? 'md:pointer-events-none md:absolute md:top-0 md:right-0 md:left-0 md:z-10 md:bg-linear-to-b md:from-base-100/95 md:to-transparent md:p-2 md:pb-6 md:transition-all md:duration-200' : ''} ${isSlim && !isEditing ? `md:-translate-y-full md:opacity-0 ${!isReorderMode ? 'md:group-hover:translate-y-0 md:group-hover:opacity-100' : ''}` : ''} ${isSlim && isEditing ? 'md:translate-y-0 md:opacity-100' : ''}`}
		>
			<div class="pointer-events-auto flex flex-col gap-1">
				<div
					class="tooltip tooltip-bottom tooltip-right"
					data-tip={new Date(snippet.updatedAt).toLocaleString()}
				>
					<div
						class={`${isSlim ? 'md:mt-0' : 'mt-1'} flex w-max cursor-help items-center gap-1 text-xs text-base-content/50`}
					>
						<Clock class="h-3 w-3" />
						Updated {getRelativeTime(snippet.updatedAt)}
					</div>
				</div>
			</div>

			<div class="relative flex h-8 min-w-26 shrink-0 items-center justify-end">
				{#if isEditing}
					<div
						class="pointer-events-auto absolute right-0 flex gap-1"
						in:fade={{ duration: 150 }}
						out:fade={{ duration: 150 }}
					>
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
						class="btn pointer-events-auto absolute right-0 btn-circle btn-ghost btn-sm"
						in:fade={{ duration: 150 }}
						out:fade={{ duration: 150 }}
						onclick={startEdit}
						title="Edit snippet"
						disabled={isReorderMode}
					>
						<Edit2 class="h-4 w-4" />
					</button>
				{/if}
			</div>
		</div>

		<div class={isReorderMode ? 'pointer-events-none' : 'pointer-events-auto'}>
			{#if isSlim && isEditing}
				<div class="hidden md:block" transition:slide={{ duration: 250 }}>
					<div class="h-10"></div>
				</div>
			{/if}
			{#if isEditing}
				<div transition:slide={{ duration: 250 }}>
					<div
						class="flex flex-col gap-4"
						in:fade={{ duration: 200, delay: 50 }}
						out:fade={{ duration: 150 }}
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
				</div>
			{:else}
				<div transition:slide={{ duration: 250 }}>
					<div
						class="flex flex-col gap-3"
						in:fade={{ duration: 200, delay: 50 }}
						out:fade={{ duration: 150 }}
					>
						{#each displayedLanguages as lang (lang.id)}
							{@const content = snippet.content[lang.id]}
							{#if content || !isMultipleMode}
								<div
									class="flex flex-col gap-1 {isMultipleMode &&
									dbStore.data.settings.hideLanguageTitles
										? 'tooltip tooltip-top before:z-50 hover:before:delay-1000 hover:after:delay-1000'
										: ''}"
									data-tip={isMultipleMode && dbStore.data.settings.hideLanguageTitles
										? lang.name
										: null}
								>
									{#if isMultipleMode && !dbStore.data.settings.hideLanguageTitles}
										<span class="px-1 text-xs font-bold opacity-60">{lang.name}</span>
									{/if}
									{#if content}
										<button
											class="group relative block min-h-12 w-full cursor-pointer rounded-lg bg-base-200 p-3 text-left font-mono text-sm wrap-break-word whitespace-pre-wrap transition-colors hover:bg-base-300"
											onclick={() => handleCopy(content, lang.id)}
											aria-label="Copy snippet"
											disabled={isReorderMode}
										>
											{content}
											{#if copiedId === lang.id}
												<div
													class="absolute inset-0 flex items-center justify-center rounded-lg bg-success/20 backdrop-blur-sm"
													transition:fade={{ duration: 150 }}
												>
													<div
														class="flex items-center gap-2 rounded-full bg-success px-3 py-1 font-sans font-bold text-success-content shadow-sm"
														transition:scale={{
															duration: 300,
															start: 0.8,
															opacity: 0,
															easing: backOut
														}}
													>
														<Check class="h-4 w-4" /> Copied
													</div>
												</div>
											{/if}
										</button>
									{:else}
										<button
											class="relative block min-h-12 w-full cursor-default rounded-lg bg-base-200 p-3 text-left font-mono text-sm wrap-break-word whitespace-pre-wrap text-base-content/50 italic transition-colors select-none"
											disabled={true}
										>
											Empty snippet
										</button>
									{/if}
								</div>
							{/if}
						{/each}
						{#if isMultipleMode && displayedLanguages.every((lang) => !snippet.content[lang.id])}
							<button
								class="relative block min-h-12 w-full cursor-default rounded-lg bg-base-200 p-3 text-left font-mono text-sm wrap-break-word whitespace-pre-wrap text-base-content/50 italic transition-colors select-none"
								disabled={true}
							>
								Empty snippet
							</button>
						{/if}
					</div>
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
