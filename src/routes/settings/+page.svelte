<script lang="ts">
	import pkg from '../../../package.json';
	import { authStore } from '$lib/stores/auth.svelte';
	import { dbStore, DEFAULT_DB } from '$lib/stores/db.svelte';
	import { Save, Trash2, Plus, Cloud, Loader2, ExternalLink, AlertTriangle, Download, Upload } from 'lucide-svelte';
	import { DatabaseBackup, Languages } from '@lucide/svelte';
	import type { Component } from 'svelte';

	let pat = $state(authStore.token);
	let gistId = $state(authStore.gistId);
	let isCreatingGist = $state(false);
	let patError = $state(false);
	let gistError = $state(false);
	let errorMessage = $state<string | null>(null);

	let confirmModalOpen = $state(false);
	let confirmTitle = $state('');
	let confirmMessage = $state('');
	let confirmAction = $state<() => void>(() => {});
	let confirmBtnText = $state('Confirm');
	let confirmBtnClass = $state('btn-primary');
	let confirmIcon = $state<any>(null);

	function openConfirm(title: string, message: string, action: () => void, btnText: string = 'Confirm', btnClass: string = 'btn-primary', icon: any = null) {
		confirmTitle = title;
		confirmMessage = message;
		confirmAction = action;
		confirmBtnText = btnText;
		confirmBtnClass = btnClass;
		confirmIcon = icon;
		confirmModalOpen = true;
	}

	let toasts = $state<{id: number, message: string, type: 'success' | 'error' | 'warning'}[]>([]);
	let toastId = 0;
	function showToast(message: string, type: 'success' | 'error' | 'warning' = 'error') {
		const id = toastId++;
		toasts.push({ id, message, type });
		setTimeout(() => {
			toasts = toasts.filter(t => t.id !== id);
		}, 3000);
	}

	async function createNewGist() {
		if (!pat.trim()) {
			patError = true;
			errorMessage = 'Personal Access Token (PAT) is required to create a new Gist.';
			return;
		}
		
		isCreatingGist = true;
		try {
			const response = await fetch('https://api.github.com/gists', {
				method: 'POST',
				headers: {
					'Authorization': `token ${pat.trim()}`,
					'Accept': 'application/vnd.github.v3+json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					description: 'Copypasta Sync Database',
					public: false,
					files: {
						'copypasta.json': {
							content: JSON.stringify(DEFAULT_DB, null, 2)
						}
					}
				})
			});
			
			if (!response.ok) {
				throw new Error(`Failed to create gist: ${response.statusText}`);
			}
			
			const data = await response.json();
			gistId = data.id;
			saveAuth();
		} catch (error: any) {
			console.error(error);
			patError = true;
			errorMessage = error.message || 'Error creating Gist. Make sure your PAT has gist permissions.';
		} finally {
			isCreatingGist = false;
		}
	}

	async function saveAuth() {
		let hasError = false;
		if (!pat.trim()) {
			patError = true;
			hasError = true;
		}
		if (!gistId.trim()) {
			gistError = true;
			hasError = true;
		}
		if (hasError) {
			errorMessage = 'Please provide both a PAT and a Gist ID to save your sync settings.';
			return;
		}

		errorMessage = null;
		authStore.save(pat, gistId);
		await dbStore.sync();
	}

	let newLangId = $state('');
	let newLangName = $state('');

	function addLanguage() {
		if (newLangId.trim() && newLangName.trim()) {
			dbStore.data.settings.languages.push({
				id: newLangId.trim(),
				name: newLangName.trim()
			});
			dbStore.save();
			newLangId = '';
			newLangName = '';
		}
	}

	function removeLanguage(id: string) {
		if (dbStore.data.settings.languages.length <= 1) {
			showToast('You must have at least one language.', 'error');
			return;
		}
		openConfirm(
			'Remove Language',
			'Are you sure you want to remove this language? This action cannot be undone.',
			() => {
				dbStore.data.settings.languages = dbStore.data.settings.languages.filter(l => l.id !== id);
				dbStore.save();
				confirmModalOpen = false;
				showToast('Language removed.', 'success');
			},
			'Delete',
			'btn-error',
			Trash2
		);
	}

	function downloadBackup() {
		const dataStr = JSON.stringify(dbStore.data, null, 2);
		const blob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `copypasta-backup-${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	let fileInput: HTMLInputElement;

	function handleRestore(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				const backupData = JSON.parse(content);
				
				if (backupData && Array.isArray(backupData.snippets) && Array.isArray(backupData.categories)) {
					openConfirm(
						'Restore Backup',
						'This will completely overwrite your current snippets. Are you sure?',
						() => {
							backupData.updatedAt = new Date().toISOString();
							dbStore.data = backupData;
							dbStore.save();
							confirmModalOpen = false;
							showToast('Backup restored successfully!', 'success');
						},
						'Restore',
						'btn-warning',
						Upload
					);
				} else {
					showToast('Invalid backup file format.', 'error');
				}
			} catch {
				showToast('Error parsing backup file.', 'error');
			}
			target.value = '';
		};
		reader.readAsText(file);
	}
</script>

<svelte:head>
	<title>Settings - Copypasta</title>
</svelte:head>

<div class="max-w-3xl mx-auto space-y-8">
	<div>
		<h1 class="text-3xl font-bold">Settings</h1>
		<p class="text-base-content/70 mt-2">Configure sync and preferences.</p>
	</div>

	<!-- GitHub Sync Settings -->
	<section class="card bg-base-100 shadow-sm border border-base-200">
		<div class="card-body">
			<h2 class="card-title flex items-center gap-2">
				<Cloud class="w-5 h-5" />
				GitHub Gist Sync
			</h2>
			<p class="text-sm text-base-content/70 mb-4">
				Your data is securely stored in a GitHub Gist and synced across devices using a Personal Access Token (PAT).
				<a href="https://github.com/settings/tokens/new?scopes=gist&description=Copypasta" target="_blank" rel="noopener noreferrer" class="link link-primary inline-flex items-center gap-1">Generate a PAT <ExternalLink class="w-3 h-3"/></a>
			</p>
			
			<form onsubmit={(e) => { e.preventDefault(); saveAuth(); }}>
				<fieldset class="fieldset w-full">
					<legend class="fieldset-legend font-medium">Personal Access Token (PAT)</legend>
					<input 
						id="pat"
						name="password"
						autocomplete="current-password"
						type="password" 
						placeholder="ghp_..." 
						class="input input-bordered w-full" 
						class:input-error={patError}
						oninput={() => { patError = false; errorMessage = null; }}
						bind:value={pat}
					/>
					<p class="label text-base-content/60">Needs the "gist" scope.</p>
				</fieldset>

				<fieldset class="fieldset w-full">
					<legend class="fieldset-legend font-medium">Gist ID</legend>
					<input 
						id="gist"
						name="username"
						autocomplete="username"
						type="text" 
						placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j" 
						class="input input-bordered w-full" 
						class:input-error={gistError}
						oninput={() => { gistError = false; errorMessage = null; }}
						bind:value={gistId}
					/>
				</fieldset>

				{#if errorMessage}
					<div class="alert alert-error mt-4 shadow-sm text-sm p-3">
						<AlertTriangle class="w-4 h-4 shrink-0" />
						<span>{errorMessage}</span>
					</div>
				{/if}

				<div class="card-actions flex-wrap justify-between items-center mt-6 pt-4 border-t border-base-200">
					<div class={gistId ? "sm:tooltip sm:tooltip-right" : ""} data-tip={gistId ? "To create a new one the current ID has to be cleared." : null}>
						<button type="button" class="btn btn-secondary" onclick={createNewGist} disabled={isCreatingGist || !!gistId}>
							{#if isCreatingGist}
								<Loader2 class="w-4 h-4 animate-spin" />
							{:else}
								<Plus class="w-4 h-4" /> Create new Gist
							{/if}
						</button>
					</div>
					<button type="submit" class="btn btn-primary">
						<Save class="w-4 h-4" /> Save
					</button>
				</div>
			</form>

			{#if authStore.isValid || dbStore.syncStatus === 'Error'}
				<div class="mt-4 p-3 bg-base-200/50 rounded-lg text-sm flex flex-col gap-2">
					<div class="flex items-center justify-between">
						<span class="font-medium">Status:</span>
						<div class="flex items-center gap-2">
							{#if dbStore.syncStatus === 'Synced'}
								<div class="badge badge-success gap-1"><Cloud class="w-3 h-3"/> Synced</div>
							{:else if dbStore.syncStatus === 'Error'}
								<div class="badge badge-error gap-1"><Cloud class="w-3 h-3"/> Error</div>
							{:else if dbStore.syncStatus === 'Syncing...'}
								<div class="badge badge-info gap-1"><Loader2 class="w-3 h-3 animate-spin"/> Syncing</div>
							{:else}
								<div class="badge badge-ghost">{dbStore.syncStatus}</div>
							{/if}
						</div>
					</div>
					
					<div class="flex justify-end">
						<button class="btn btn-sm btn-outline" onclick={() => dbStore.sync()} disabled={dbStore.isLoading}>
							{#if dbStore.isLoading}
								<Loader2 class="w-3 h-3 animate-spin" /> Syncing...
							{:else}
								<Cloud class="w-3 h-3" /> Sync Now
							{/if}
						</button>
					</div>
					
					{#if dbStore.syncStatus === 'Error' && dbStore.error}
						<div class="text-error text-xs">{dbStore.error}</div>
					{/if}

					{#if dbStore.data.updatedAt && dbStore.syncStatus !== 'Error'}
						<div class="flex items-center justify-between">
							<span class="font-medium">Last synced:</span>
							<span class="text-base-content/70">{new Date(dbStore.data.updatedAt).toLocaleString()}</span>
						</div>
					{/if}

					{#if authStore.gistId}
						<div class="flex items-center justify-between">
							<span class="font-medium">Gist Link:</span>
							<a href={`https://gist.github.com/${authStore.gistId}`} target="_blank" rel="noopener noreferrer" class="link link-primary">View on GitHub</a>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<!-- Languages Settings -->
	<section class="card bg-base-100 shadow-sm border border-base-200">
		<div class="card-body">
			<h2 class="card-title">
				<Languages class="w-5 h-5" />
				Languages
			</h2>
			<p class="text-sm text-base-content/70 mb-4">
				Configure the languages for your dual-mode or multi-mode snippets.
			</p>

			<div class="overflow-x-auto">
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th>ID (e.g. en)</th>
							<th>Name (e.g. English)</th>
							<th class="w-16"></th>
						</tr>
					</thead>
					<tbody>
						{#each dbStore.data.settings.languages as lang}
							<tr>
								<td class="font-mono text-sm">{lang.id}</td>
								<td>{lang.name}</td>
								<td>
									<button class="btn btn-ghost btn-sm text-error" onclick={() => removeLanguage(lang.id)}>
										<Trash2 class="w-4 h-4" />
									</button>
								</td>
							</tr>
						{/each}
						
						<!-- Add New -->
						<tr>
							<td>
								<input type="text" placeholder="ID" class="input input-bordered input-sm w-full max-w-xs" bind:value={newLangId} />
							</td>
							<td>
								<input type="text" placeholder="Name" class="input input-bordered input-sm w-full max-w-xs" bind:value={newLangName} onkeydown={(e) => e.key === 'Enter' && addLanguage()} />
							</td>
							<td>
								<button class="btn btn-primary btn-sm" onclick={addLanguage} disabled={!newLangId.trim() || !newLangName.trim()}>
									<Plus class="w-4 h-4" />
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</section>

	<!-- Backup & Restore -->
	<section class="card bg-base-100 shadow-sm border border-base-200">
		<div class="card-body p-6">
			<h2 class="card-title text-lg flex items-center gap-2 mb-2">
				<DatabaseBackup class="w-5 h-5" />
				Backup & Restore
			</h2>
			<p class="text-sm text-base-content/70 mb-4">
				Export your current snippets as a JSON file, or restore a previous backup. Restoring will completely overwrite your current data.
			</p>

			<div class="flex flex-col sm:flex-row gap-4">
				<button class="btn btn-outline" onclick={downloadBackup}>
					<Download class="w-4 h-4" /> Download Backup
				</button>
				<button class="btn btn-outline btn-error" onclick={() => fileInput.click()}>
					<Upload class="w-4 h-4" /> Restore Backup
				</button>
				<input type="file" accept=".json,application/json" class="hidden" bind:this={fileInput} onchange={handleRestore} />
			</div>
		</div>
	</section>

	<div class="text-center text-sm text-base-content/50 mt-4 pb-4 font-mono">
		v{pkg.version}
	</div>
</div>

<div class="modal" class:modal-open={confirmModalOpen}>
	<div class="modal-box">
		<h3 class="font-bold text-lg flex items-center gap-2">
			{#if confirmIcon}
				{@const Icon = confirmIcon}
				<Icon class="w-5 h-5 text-current" />
			{/if}
			{confirmTitle}
		</h3>
		<p class="py-4 text-sm opacity-80">{confirmMessage}</p>
		<div class="modal-action">
			<button class="btn btn-ghost" onclick={() => confirmModalOpen = false}>Cancel</button>
			<button class="btn {confirmBtnClass}" onclick={confirmAction}>{confirmBtnText}</button>
		</div>
	</div>
</div>

<div class="toast toast-top toast-center mt-16 sm:toast-bottom sm:toast-end sm:mt-0 z-50">
	{#each toasts as toast (toast.id)}
		<div class="alert alert-{toast.type} shadow-lg">
			<span>{toast.message}</span>
		</div>
	{/each}
</div>
