<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { dbStore, DEFAULT_DB } from '$lib/stores/db.svelte';
	import { Save, Trash2, Plus, Cloud, Loader2, ExternalLink, AlertTriangle } from 'lucide-svelte';

	let pat = $state(authStore.token);
	let gistId = $state(authStore.gistId);
	let isCreatingGist = $state(false);
	let patError = $state(false);
	let gistError = $state(false);
	let errorMessage = $state<string | null>(null);

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

	function saveAuth() {
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
		dbStore.load(); // Load data from new gist
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
			alert('You must have at least one language.');
			return;
		}
		if (confirm('Remove this language?')) {
			dbStore.data.settings.languages = dbStore.data.settings.languages.filter(l => l.id !== id);
			dbStore.save();
		}
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
			
			<div class="form-control w-full">
				<label class="label">
					<span class="label-text font-medium">Personal Access Token (PAT)</span>
				</label>
				<input 
					type="password" 
					placeholder="ghp_..." 
					class="input input-bordered w-full" 
					class:input-error={patError}
					oninput={() => { patError = false; errorMessage = null; }}
					bind:value={pat}
				/>
				<label class="label">
					<span class="label-text-alt text-base-content/60">Needs the "gist" scope.</span>
				</label>
			</div>

			<div class="form-control w-full">
				<label class="label">
					<span class="label-text font-medium">Gist ID</span>
				</label>
				<input 
					type="text" 
					placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j" 
					class="input input-bordered w-full" 
					class:input-error={gistError}
					oninput={() => { gistError = false; errorMessage = null; }}
					bind:value={gistId}
				/>
			</div>

			{#if errorMessage}
				<div class="alert alert-error mt-4 shadow-sm text-sm p-3">
					<AlertTriangle class="w-4 h-4 shrink-0" />
					<span>{errorMessage}</span>
				</div>
			{/if}

			<div class="card-actions flex-wrap justify-between items-center mt-6 pt-4 border-t border-base-200">
				<div class={gistId ? "tooltip tooltip-right" : ""} data-tip={gistId ? "To create a new one the current ID has to be cleared." : null}>
					<button class="btn btn-secondary" onclick={createNewGist} disabled={isCreatingGist || !!gistId}>
						{#if isCreatingGist}
							<Loader2 class="w-4 h-4 animate-spin" />
						{:else}
							<Plus class="w-4 h-4" /> Create new Gist
						{/if}
					</button>
				</div>
				<button class="btn btn-primary" onclick={saveAuth}>
					<Save class="w-4 h-4" /> Save
				</button>
			</div>

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
			<h2 class="card-title">Languages</h2>
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
</div>
