<script lang="ts">
	import { dbStore, type Snippet } from '$lib/stores/db.svelte';
	import { Check, Edit2, Save, X, Clock, Trash2 } from 'lucide-svelte';
	import { fade, scale, slide } from 'svelte/transition';
	import { backOut } from 'svelte/easing';

	let { snippet, startInEditMode = false, isReorderMode = false, onEditComplete }: { snippet: Snippet; startInEditMode?: boolean; isReorderMode?: boolean; onEditComplete?: () => void } = $props();
	
	let copied = $state(false);
	
	let isEditing = $state(startInEditMode);
	let editContents = $state<Record<string, string>>(startInEditMode ? { ...snippet.content } : {});
	let deleteModal: HTMLDialogElement;

	let activeContent = $derived(snippet.content[dbStore.globalLanguageId] || '');

	$effect(() => {
		if (isReorderMode && isEditing) {
			isEditing = false;
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

	async function handleCopy() {
		if (isEditing || isReorderMode) return;
		try {
			await navigator.clipboard.writeText(activeContent);
			copied = true;
			setTimeout(() => (copied = false), 2000);
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
		const dbSnippet = dbStore.data.snippets.find(s => s.id === snippet.id);
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
		dbStore.data.snippets = dbStore.data.snippets.filter(s => s.id !== snippet.id);
		dbStore.save();
	}
</script>

<style>
	@keyframes shake {
		0%, 100% { rotate: 0deg; }
		25% { rotate: -0.5deg; }
		75% { rotate: 0.5deg; }
	}
	.shake-animation {
		animation: shake 0.3s ease-in-out infinite;
	}
</style>

<div class={`card bg-base-100 shadow-xl border border-base-200 snippet-card ${isReorderMode ? 'shake-animation cursor-grab active:cursor-grabbing' : ''}`} data-id={snippet.id}>
	<div class="card-body p-4 pointer-events-none">
		<div class={`flex justify-between items-start mb-3 ${isReorderMode ? 'opacity-50' : 'pointer-events-auto'}`}>
			<div class="flex flex-col gap-1">
				<div class="tooltip tooltip-bottom tooltip-right" data-tip={new Date(snippet.updatedAt).toLocaleString()}>
					<div class="text-xs text-base-content/50 flex items-center gap-1 cursor-help w-max mt-1">
						<Clock class="w-3 h-3" />
						Updated {getRelativeTime(snippet.updatedAt)}
					</div>
				</div>
			</div>
			
			{#if isEditing}
				<div class="flex gap-1">
					<button class="btn btn-sm btn-ghost btn-circle text-error" onclick={openDeleteModal} title="Delete">
						<Trash2 class="w-4 h-4" />
					</button>
					<button class="btn btn-sm btn-ghost btn-circle text-base-content/50" onclick={cancelEdit} title="Cancel">
						<X class="w-4 h-4" />
					</button>
					<button class="btn btn-sm btn-ghost btn-circle text-success" onclick={saveEdit} title="Save">
						<Save class="w-4 h-4" />
					</button>
				</div>
			{:else}
				<button class="btn btn-sm btn-circle btn-ghost" onclick={startEdit} title="Edit snippet" disabled={isReorderMode}>
					<Edit2 class="w-4 h-4" />
				</button>
			{/if}
		</div>

		<div class={isReorderMode ? 'pointer-events-none' : 'pointer-events-auto'}>
			{#if isEditing}
				<div class="flex flex-col gap-4" in:slide={{duration: 250, delay: 250}} out:slide={{duration: 250}}>
					{#each dbStore.data.settings.languages as lang}
						<div>
							<label class="label pt-0 pb-1"><span class="label-text text-xs font-bold">{lang.name} Content</span></label>
							<textarea 
								class="textarea textarea-bordered font-mono text-sm w-full leading-relaxed" 
								rows="3" 
								bind:value={editContents[lang.id]}
								placeholder="Enter {lang.name} snippet..."
							></textarea>
						</div>
					{/each}
				</div>
			{:else}
				<div in:slide={{duration: 250, delay: 250}} out:slide={{duration: 250}}>
					<button 
						class="bg-base-200 hover:bg-base-300 rounded-lg p-3 font-mono text-sm whitespace-pre-wrap break-words min-h-[4rem] text-left transition-colors relative group w-full block"
						onclick={handleCopy}
						aria-label="Copy snippet"
						disabled={isReorderMode}
					>
						{activeContent || 'Empty snippet'}
						{#if copied}
							<div 
								class="absolute inset-0 bg-success/20 flex items-center justify-center rounded-lg backdrop-blur-sm"
								transition:fade={{duration: 150}}
							>
								<div 
									class="bg-success text-success-content px-3 py-1 rounded-full flex items-center gap-2 shadow-sm font-sans font-bold"
									transition:scale={{duration: 300, start: 0.8, opacity: 0, easing: backOut}}
								>
									<Check class="w-4 h-4" /> Copied!
								</div>
							</div>
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<dialog bind:this={deleteModal} class="modal">
	<div class="modal-box">
		<h3 class="font-bold text-lg text-error flex items-center gap-2">
			<Trash2 class="w-5 h-5" /> Delete Snippet?
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
