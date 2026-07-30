<script lang="ts">
	import pkg from '../../../package.json';
	import { authStore } from '$lib/stores/auth.svelte';
	import { dbStore, DEFAULT_DB } from '$lib/stores/db.svelte';
	import {
		Save,
		Trash2,
		Plus,
		Cloud,
		Loader2,
		ExternalLink,
		AlertTriangle,
		Download,
		Upload,
		DatabaseBackup,
		Languages,
		LayoutGrid
	} from '@lucide/svelte';
	import { scale, fade } from 'svelte/transition';

	let pat = $state(authStore.github.token);
	let gistId = $state(authStore.github.gistId);
	let isCreatingGist = $state(false);
	let patError = $state(false);
	let gistError = $state(false);
	let errorMessage = $state<string | null>(null);

	let gdriveClientId = $state(authStore.gdrive.clientId);
	let gdriveClientIdError = $state(false);

	const HAS_GLOBAL_CLIENT_ID = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
	let showCustomClientId = $state(
		!HAS_GLOBAL_CLIENT_ID || 
		(authStore.gdrive.clientId && authStore.gdrive.clientId !== import.meta.env.VITE_GOOGLE_CLIENT_ID)
	);

	let activeTab = $state<'github' | 'gdrive'>(authStore.activeProvider === 'gdrive' ? 'gdrive' : 'github');

	let gisTokenClient: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

	let appDataModalOpen = $state(false);
	let gdriveFiles = $state<{id: string, name: string}[] | null>(null);
	let isLoadingGdriveFiles = $state(false);

	async function loadGdriveFiles() {
		if (!authStore.gdrive.accessToken) return;
		isLoadingGdriveFiles = true;
		try {
			const res = await fetch(
				`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)`,
				{
					headers: {
						Authorization: `Bearer ${authStore.gdrive.accessToken}`
					}
				}
			);
			if (!res.ok) throw new Error('Failed to fetch AppData files');
			const data = await res.json();
			gdriveFiles = data.files || [];
		} catch {
			showToast('Error loading App Data files', 'error');
		} finally {
			isLoadingGdriveFiles = false;
		}
	}

	async function deleteGdriveFile(id: string) {
		if (!authStore.gdrive.accessToken) return;
		
		openConfirm(
			'Delete File',
			'Are you sure you want to permanently delete this file from your Google Drive App Data? This will break sync if it is the active database file.',
			async () => {
				confirmModalOpen = false;
				try {
					const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
						method: 'DELETE',
						headers: {
							Authorization: `Bearer ${authStore.gdrive.accessToken}`
						}
					});
					if (!res.ok) throw new Error('Failed to delete file');
					
					showToast('File deleted successfully', 'success');
					if (gdriveFiles) {
						gdriveFiles = gdriveFiles.filter(f => f.id !== id);
					}
					if (authStore.gdrive.fileId === id) {
						authStore.gdrive.fileId = '';
						authStore.save();
					}
				} catch {
					showToast('Error deleting file', 'error');
				}
			},
			'Delete',
			'btn-error',
			Trash2
		);
	}

	function initGis() {
		// @ts-expect-error Google is defined by external script
		if (typeof google !== 'undefined' && !gisTokenClient && gdriveClientId) {
			// @ts-expect-error Google is defined by external script
			gisTokenClient = google.accounts.oauth2.initTokenClient({
				client_id: gdriveClientId,
				scope: 'https://www.googleapis.com/auth/drive.appdata',
				callback: (tokenResponse: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
					if (tokenResponse && tokenResponse.access_token) {
						authStore.gdrive.accessToken = tokenResponse.access_token;
						authStore.gdrive.clientId = gdriveClientId;
						authStore.save();
						dbStore.sync();
					}
				}
			});
		}
	}

	function loginGdrive() {
		if (!gdriveClientId.trim()) {
			gdriveClientIdError = true;
			errorMessage = 'Google Client ID is required.';
			return;
		}
		errorMessage = null;
		
		authStore.gdrive.clientId = gdriveClientId;
		authStore.save();

		// @ts-expect-error Google is defined by external script
		if (typeof google === 'undefined') {
			errorMessage = 'Google Identity Services script not loaded yet.';
			return;
		}

		if (!gisTokenClient) {
			initGis();
		}
		
		if (gisTokenClient) {
			gisTokenClient.requestAccessToken();
		}
	}

	let confirmModalOpen = $state(false);
	let confirmTitle = $state('');
	let confirmMessage = $state('');
	let confirmAction = $state<() => void>(() => {});
	let confirmBtnText = $state('Confirm');
	let confirmBtnClass = $state('btn-primary');
	let confirmIcon = $state<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

	function openConfirm(
		title: string,
		message: string,
		action: () => void,
		btnText: string = 'Confirm',
		btnClass: string = 'btn-primary',
		icon: any = null // eslint-disable-line @typescript-eslint/no-explicit-any
	) {
		confirmTitle = title;
		confirmMessage = message;
		confirmAction = action;
		confirmBtnText = btnText;
		confirmBtnClass = btnClass;
		confirmIcon = icon;
		confirmModalOpen = true;
	}

	let toasts = $state<{ id: number; message: string; type: 'success' | 'error' | 'warning' }[]>([]);
	let toastId = 0;
	function showToast(message: string, type: 'success' | 'error' | 'warning' = 'error') {
		const id = toastId++;
		toasts.push({ id, message, type });
		setTimeout(() => {
			toasts = toasts.filter((t) => t.id !== id);
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
					Authorization: `token ${pat.trim()}`,
					Accept: 'application/vnd.github.v3+json',
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
			saveAuth('github');
		} catch (err) {
			const error = err as Error;
			console.error(error);
			patError = true;
			errorMessage =
				error.message || 'Error creating Gist. Make sure your PAT has gist permissions.';
		} finally {
			isCreatingGist = false;
		}
	}

	async function saveAuth(provider: 'github' | 'gdrive') {
		let hasError = false;
		if (provider === 'github') {
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
			authStore.github.token = pat.trim();
			authStore.github.gistId = gistId.trim();
			authStore.save();
			
			if (authStore.activeProvider === 'github') {
				await dbStore.sync();
			} else {
				showToast('GitHub credentials saved.', 'success');
			}
		} else if (provider === 'gdrive') {
			if (!gdriveClientId.trim()) {
				gdriveClientIdError = true;
				errorMessage = 'Please provide a Google Client ID.';
				return;
			}
			authStore.gdrive.clientId = gdriveClientId.trim();
			authStore.save();
			showToast('Google Drive Settings saved.', 'success');
		}
	}

	function setActiveProvider(provider: 'github' | 'gdrive') {
		authStore.activeProvider = provider;
		authStore.save();
		dbStore.sync();
	}

	let newLangId = $state('');
	let newLangName = $state('');

	function addLanguage() {
		if (newLangId.trim() && newLangName.trim()) {
			dbStore.data.settings.languages.push({
				id: newLangId.trim(),
				name: newLangName.trim(),
				showInMultiple: false
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
				dbStore.data.settings.languages = dbStore.data.settings.languages.filter(
					(l) => l.id !== id
				);
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
		a.download = `copypasta-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
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

				if (
					backupData &&
					Array.isArray(backupData.snippets) &&
					Array.isArray(backupData.categories)
				) {
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
	<title>Copypasta - Settings</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-8">
	<div>
		<h1 class="text-3xl font-bold">Settings</h1>
		<p class="mt-2 text-base-content/70">Configure sync and preferences.</p>
	</div>

	<!-- Sync Settings -->
	<section class="card border border-base-200 bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title flex items-center gap-2">
				<Cloud class="h-5 w-5" />
				Cloud Sync
			</h2>
			<p class="mb-4 text-sm text-base-content/70">
				Choose a provider to sync your snippets securely across devices.
			</p>

			<div role="tablist" class="tabs tabs-box mb-4">
				<button 
					role="tab" 
					class="tab indicator {activeTab === 'github' ? 'tab-active' : ''}" 
					onclick={() => { activeTab = 'github'; errorMessage = null; }}
				>
					GitHub Gist
					{#if authStore.activeProvider === 'github'}
						<span class="indicator-item indicator-top indicator-center badge badge-primary badge-xs" in:scale={{duration: 200, start: 0.8}} out:scale={{duration: 200, start: 0.8}}>Active</span>
					{/if}
				</button>
				<button 
					role="tab" 
					class="tab indicator {activeTab === 'gdrive' ? 'tab-active' : ''}" 
					onclick={() => { activeTab = 'gdrive'; errorMessage = null; }}
				>
					Google Drive
					{#if authStore.activeProvider === 'gdrive'}
						<span class="indicator-item indicator-top indicator-center badge badge-primary badge-xs" in:scale={{duration: 200, start: 0.8}} out:scale={{duration: 200, start: 0.8}}>Active</span>
					{/if}
				</button>
			</div>

			{#if activeTab === 'github'}
				<div>
					<p class="mb-4 text-sm text-base-content/70">
						Your data is securely stored in a GitHub Gist using a Personal Access Token (PAT).
						<a
							href="https://github.com/settings/tokens/new?scopes=gist&description=Copypasta"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex link items-center gap-1 link-primary"
							>Generate a PAT <ExternalLink class="h-3 w-3" /></a
						>
					</p>

					<form
						onsubmit={(e) => {
							e.preventDefault();
							saveAuth('github');
						}}
					>
						<fieldset class="fieldset w-full">
							<legend class="fieldset-legend font-medium">Personal Access Token (PAT)</legend>
							<input
								id="pat"
								name="password"
								autocomplete="current-password"
								type="password"
								placeholder="ghp_..."
								class="input-bordered input w-full"
								class:input-error={patError}
								oninput={() => {
									patError = false;
									errorMessage = null;
								}}
								bind:value={pat}
							/>
							<p class="label text-base-content/60">Needs the "gist" scope.</p>
						</fieldset>

						<fieldset class="fieldset w-full mt-2">
							<legend class="fieldset-legend font-medium">Gist ID</legend>
							<input
								id="gist"
								name="username"
								autocomplete="username"
								type="text"
								placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j"
								class="input-bordered input w-full"
								class:input-error={gistError}
								oninput={() => {
									gistError = false;
									errorMessage = null;
								}}
								bind:value={gistId}
							/>
						</fieldset>

						{#if errorMessage}
							<div class="mt-4 alert p-3 text-sm alert-error shadow-sm">
								<AlertTriangle class="h-4 w-4 shrink-0" />
								<span>{errorMessage}</span>
							</div>
						{/if}

						<div
							class="mt-6 card-actions flex-wrap items-center justify-between border-t border-base-200 pt-4"
						>
							<div
								class={gistId ? 'sm:tooltip sm:tooltip-right' : ''}
								data-tip={gistId ? 'To create a new one the current ID has to be cleared.' : null}
							>
								<button
									type="button"
									class="btn btn-secondary"
									onclick={createNewGist}
									disabled={isCreatingGist || !!gistId}
								>
									{#if isCreatingGist}
										<Loader2 class="h-4 w-4 animate-spin" />
									{:else}
										<Plus class="h-4 w-4" /> Create new Gist
									{/if}
								</button>
							</div>
							
							<div class="flex items-center gap-2">
								<button 
									type="button" 
									class="btn grid place-items-center transition-all duration-300 {authStore.activeProvider === 'github' ? 'btn-disabled' : 'btn-outline btn-accent'}" 
									onclick={() => setActiveProvider('github')}
									disabled={authStore.activeProvider === 'github'}
								>
									{#key authStore.activeProvider}
										<span class="col-start-1 row-start-1" in:scale={{duration:250, delay: 100, start: 0.95}} out:fade={{duration:150}}>
											{authStore.activeProvider === 'github' ? 'Currently Active' : 'Set as Active Sync Provider'}
										</span>
									{/key}
								</button>
								<button type="submit" class="btn btn-primary">
									<Save class="h-4 w-4" /> Save
								</button>
							</div>
						</div>
					</form>
				</div>
			{:else if activeTab === 'gdrive'}
				<div>
					<p class="mb-4 text-sm text-base-content/70">
						Your data will be stored securely in a hidden folder on your Google Drive that only this app can access (App Data Folder).
					</p>

					<form
						onsubmit={(e) => {
							e.preventDefault();
							saveAuth('gdrive');
						}}
					>
						{#if HAS_GLOBAL_CLIENT_ID}
							<div class="form-control mb-4">
								<label class="label cursor-pointer justify-start gap-3">
									<input type="checkbox" class="checkbox" bind:checked={showCustomClientId} onchange={(e) => {
										if (!e.currentTarget.checked) {
											gdriveClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
											gdriveClientIdError = false;
											errorMessage = null;
										} else {
											if (gdriveClientId === import.meta.env.VITE_GOOGLE_CLIENT_ID) {
												gdriveClientId = '';
											}
										}
									}} />
									<span class="label-text">Use custom Google Client ID (for self-hosting)</span>
								</label>
							</div>
						{/if}

						{#if showCustomClientId}
							<fieldset class="fieldset w-full">
								<legend class="fieldset-legend font-medium">Google Client ID</legend>
								<input
									id="clientid"
									type="text"
									placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
									class="input-bordered input w-full"
									class:input-error={gdriveClientIdError}
									oninput={() => {
										gdriveClientIdError = false;
										errorMessage = null;
									}}
									bind:value={gdriveClientId}
								/>
								<p class="label text-base-content/60">From your Google Cloud Project.</p>
							</fieldset>
						{/if}

						{#if errorMessage}
							<div class="mt-4 alert p-3 text-sm alert-error shadow-sm">
								<AlertTriangle class="h-4 w-4 shrink-0" />
								<span>{errorMessage}</span>
							</div>
						{/if}

						<div
							class="mt-6 card-actions flex-wrap items-center justify-between border-t border-base-200 pt-4"
						>
							<div>
								<button
									type="button"
									class="btn btn-secondary"
									onclick={loginGdrive}
								>
									Sign in with Google
								</button>
								{#if authStore.gdrive.accessToken}
									<span class="ml-2 text-sm text-success">Authenticated</span>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<button 
									type="button" 
									class="btn grid place-items-center transition-all duration-300 {authStore.activeProvider === 'gdrive' ? 'btn-disabled' : 'btn-outline btn-accent'}" 
									onclick={() => setActiveProvider('gdrive')}
									disabled={authStore.activeProvider === 'gdrive'}
								>
									{#key authStore.activeProvider}
										<span class="col-start-1 row-start-1" in:scale={{duration:250, delay: 100, start: 0.95}} out:fade={{duration:150}}>
											{authStore.activeProvider === 'gdrive' ? 'Currently Active' : 'Set as Active Sync Provider'}
										</span>
									{/key}
								</button>
								<button type="submit" class="btn btn-primary">
									<Save class="h-4 w-4" /> Save
								</button>
							</div>
						</div>
					</form>
				</div>
			{/if}

			{#if authStore.isValid || dbStore.syncStatus === 'Error'}
				<div class="mt-4 flex flex-col gap-2 rounded-lg bg-base-200/50 p-3 text-sm">
					<div class="flex items-center justify-between">
						<span class="font-medium">Active Provider:</span>
						<span class="badge badge-neutral">{authStore.activeProvider}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="font-medium">Status:</span>
						<div class="flex items-center gap-2">
							{#if dbStore.syncStatus === 'Synced'}
								<div class="badge gap-1 badge-success"><Cloud class="h-3 w-3" /> Synced</div>
							{:else if dbStore.syncStatus === 'Error'}
								<div class="badge gap-1 badge-error"><Cloud class="h-3 w-3" /> Error</div>
							{:else if dbStore.syncStatus === 'Syncing...'}
								<div class="badge gap-1 badge-info">
									<Loader2 class="h-3 w-3 animate-spin" /> Syncing
								</div>
							{:else}
								<div class="badge badge-ghost">{dbStore.syncStatus}</div>
							{/if}
						</div>
					</div>

					<div class="flex justify-end">
						<button
							class="btn btn-outline btn-sm"
							onclick={() => dbStore.sync()}
							disabled={dbStore.isLoading}
						>
							{#if dbStore.isLoading}
								<Loader2 class="h-3 w-3 animate-spin" /> Syncing...
							{:else}
								<Cloud class="h-3 w-3" /> Sync Now
							{/if}
						</button>
					</div>

					{#if dbStore.syncStatus === 'Error' && dbStore.error}
						<div class="text-xs text-error">{dbStore.error}</div>
					{/if}

					{#if dbStore.data.updatedAt && dbStore.syncStatus !== 'Error'}
						<div class="flex items-center justify-between">
							<span class="font-medium">Last synced:</span>
							<span class="text-base-content/70"
								>{new Date(dbStore.data.updatedAt).toLocaleString()}</span
							>
						</div>
					{/if}

					{#if authStore.activeProvider === 'github' && authStore.github.gistId}
						<div class="flex items-center justify-between">
							<span class="font-medium">Gist Link:</span>
							<a
								href={`https://gist.github.com/${authStore.github.gistId}`}
								target="_blank"
								rel="noopener noreferrer"
								class="link link-primary">View on GitHub</a
							>
						</div>
					{/if}

					{#if authStore.activeProvider === 'gdrive' && authStore.gdrive.accessToken}
						<div class="flex items-center justify-between">
							<span class="font-medium">App Data:</span>
							<button 
								type="button"
								class="link link-primary border-none bg-transparent p-0 font-normal hover:bg-transparent"
								onclick={() => { appDataModalOpen = true; loadGdriveFiles(); }}
							>
								Manage Files
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<!-- UI Layout Settings -->
	<section class="card border border-base-200 bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title">
				<LayoutGrid class="h-5 w-5" />
				Layout Preferences
			</h2>
			<p class="mb-4 text-sm text-base-content/70">
				Customize how snippets are displayed on the main page. (Stored locally on this device)
			</p>

			<div class="flex max-w-xs items-center justify-between">
				<span class="text-sm font-medium">Fluid Width (Full Screen)</span>
				<input
					type="checkbox"
					class="toggle toggle-primary"
					checked={dbStore.fluidWidth}
					onchange={(e) => dbStore.setFluidWidth(e.currentTarget.checked)}
				/>
			</div>

			<div class="mt-4 flex max-w-xs items-center justify-between">
				<span class="text-sm font-medium">Slim Mode (Desktop Only)</span>
				<input
					type="checkbox"
					class="toggle toggle-primary"
					checked={dbStore.data.settings.slimMode}
					onchange={(e) => {
						dbStore.data.settings.slimMode = e.currentTarget.checked;
						dbStore.save();
					}}
				/>
			</div>

			<fieldset class="mt-4 fieldset w-full max-w-xs">
				<legend class="fieldset-legend font-medium">Grid Columns</legend>
				<select
					class="select-bordered select w-full"
					value={dbStore.columnCount}
					onchange={(e) => dbStore.setColumnCount(e.currentTarget.value)}
				>
					<option value="1">1 Column</option>
					<option value="2">2 Columns</option>
					<option value="3">3 Columns</option>
					<option value="4">4 Columns</option>
					<option value="auto">Auto-fit (Responsive)</option>
				</select>
			</fieldset>
		</div>
	</section>

	<!-- Languages Settings -->
	<section class="card border border-base-200 bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title">
				<Languages class="h-5 w-5" />
				Languages
			</h2>
			<p class="mb-4 text-sm text-base-content/70">
				Configure the languages for your dual-mode or multi-mode snippets.
			</p>

			<div class="mb-4 flex max-w-sm items-center justify-between">
				<span class="text-sm font-medium">Hide Language Titles in Multiple View</span>
				<input
					type="checkbox"
					class="toggle toggle-primary"
					checked={dbStore.data.settings.hideLanguageTitles}
					onchange={(e) => {
						dbStore.data.settings.hideLanguageTitles = e.currentTarget.checked;
						dbStore.save();
					}}
				/>
			</div>

			<div class="overflow-x-auto">
				<table class="table w-full table-zebra">
					<thead>
						<tr>
							<th>ID (e.g. en)</th>
							<th>Name (e.g. English)</th>
							<th class="text-center">Show in Multiple</th>
							<th class="w-16"></th>
						</tr>
					</thead>
					<tbody>
						{#each dbStore.data.settings.languages as lang (lang.id)}
							<tr>
								<td class="font-mono text-sm">{lang.id}</td>
								<td>{lang.name}</td>
								<td class="text-center">
									<input
										type="checkbox"
										class="checkbox checkbox-sm checkbox-primary"
										checked={lang.showInMultiple}
										onchange={(e) => {
											lang.showInMultiple = e.currentTarget.checked;
											dbStore.save();
										}}
									/>
								</td>
								<td>
									<button
										class="btn btn-ghost text-error btn-sm"
										onclick={() => removeLanguage(lang.id)}
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</td>
							</tr>
						{/each}

						<!-- Add New -->
						<tr>
							<td>
								<input
									type="text"
									placeholder="ID"
									class="input-bordered input w-full max-w-xs input-sm"
									bind:value={newLangId}
								/>
							</td>
							<td>
								<input
									type="text"
									placeholder="Name"
									class="input-bordered input w-full max-w-xs input-sm"
									bind:value={newLangName}
									onkeydown={(e) => e.key === 'Enter' && addLanguage()}
								/>
							</td>
							<td></td>
							<td>
								<button
									class="btn btn-primary btn-sm"
									onclick={addLanguage}
									disabled={!newLangId.trim() || !newLangName.trim()}
								>
									<Plus class="h-4 w-4" />
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</section>

	<!-- Backup & Restore -->
	<section class="card border border-base-200 bg-base-100 shadow-sm">
		<div class="card-body p-6">
			<h2 class="mb-2 card-title flex items-center gap-2 text-lg">
				<DatabaseBackup class="h-5 w-5" />
				Backup & Restore
			</h2>
			<p class="mb-4 text-sm text-base-content/70">
				Export your current snippets as a JSON file, or restore a previous backup. Restoring will
				completely overwrite your current data.
			</p>

			<div class="flex flex-col gap-4 sm:flex-row">
				<button class="btn btn-outline" onclick={downloadBackup}>
					<Download class="h-4 w-4" /> Download Backup
				</button>
				<button class="btn btn-outline btn-warning" onclick={() => fileInput.click()}>
					<Upload class="h-4 w-4" /> Restore Backup
				</button>
				<input
					type="file"
					accept=".json,application/json"
					class="hidden"
					bind:this={fileInput}
					onchange={handleRestore}
				/>
			</div>
		</div>
	</section>

	<div class="mt-4 pb-4 text-center font-mono text-sm text-base-content/50">
		v{pkg.version}
	</div>
</div>

<dialog class="modal" class:modal-open={appDataModalOpen}>
	<div class="modal-box">
		<h3 class="font-bold text-lg mb-4">App Data Management</h3>
		<p class="text-sm text-base-content/70 mb-4">
			View and permanently delete files stored in the hidden App Data folder for this application on your Google Drive.
		</p>
		
		<div class="flex flex-col gap-2 min-h-32 mb-6">
			{#if isLoadingGdriveFiles}
				<div class="flex items-center justify-center h-full text-base-content/50">
					<Loader2 class="h-6 w-6 animate-spin" />
					<span class="ml-2">Loading files...</span>
				</div>
			{:else if gdriveFiles !== null}
				{#if gdriveFiles.length === 0}
					<div class="flex items-center justify-center h-full text-base-content/50 italic">
						No files found in App Data.
					</div>
				{:else}
					<ul class="menu bg-base-200 w-full rounded-box">
						{#each gdriveFiles as file (file.id)}
							<li>
								<div class="flex justify-between items-center w-full hover:bg-base-300">
									<div class="flex flex-col gap-0.5 pointer-events-none">
										<span class="font-medium text-sm leading-tight">{file.name}</span>
										<span class="text-xs text-base-content/50 font-mono leading-tight">{file.id}</span>
									</div>
									<button type="button" class="btn btn-ghost btn-sm text-error btn-square z-10" onclick={() => deleteGdriveFile(file.id)}>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
		
		<div class="modal-action">
			<button type="button" class="btn" onclick={() => appDataModalOpen = false}>Close</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop" onsubmit={() => appDataModalOpen = false}>
		<button>close</button>
	</form>
</dialog>

<dialog class="modal" class:modal-open={confirmModalOpen} style="z-index: 1000;">
	<div class="modal-box">
		<h3 class="flex items-center gap-2 text-lg font-bold">
			{#if confirmIcon}
				{@const Icon = confirmIcon}
				<Icon class="h-5 w-5 text-current" />
			{/if}
			{confirmTitle}
		</h3>
		<p class="py-4 text-sm opacity-80">{confirmMessage}</p>
		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={() => (confirmModalOpen = false)}>Cancel</button>
			<button type="button" class="btn {confirmBtnClass}" onclick={confirmAction}>{confirmBtnText}</button>
		</div>
	</div>
</dialog>

<div class="toast toast-center toast-top z-50 mt-16 sm:toast-end sm:toast-bottom sm:mt-0">
	{#each toasts as toast (toast.id)}
		<div class="alert alert-{toast.type} shadow-lg">
			<span>{toast.message}</span>
		</div>
	{/each}
</div>
