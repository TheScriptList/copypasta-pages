import { browser } from '$app/environment';
import { authStore } from './auth.svelte';

export interface Language {
	id: string;
	name: string;
}

export interface Category {
	id: string;
	name: string;
	icon: string;
}

export interface Snippet {
	id: string;
	categoryId: string;
	content: Record<string, string>; // mapping from languageId -> text
	createdAt: string;
	updatedAt: string;
}

export interface Database {
	settings: {
		languages: Language[];
	};
	categories: Category[];
	snippets: Snippet[];
	updatedAt: string;
}

export const DEFAULT_DB: Database = {
	settings: {
		languages: [
			{ id: 'en', name: 'English' },
			{ id: 'de', name: 'German' }
		]
	},
	categories: [],
	snippets: [],
	updatedAt: '1970-01-01T00:00:00.000Z'
};

function loadInitialData(): Database {
	if (browser) {
		const stored = localStorage.getItem('copypasta_local_db');
		if (stored) {
			try {
				return JSON.parse(stored);
			} catch {
				// ignore invalid JSON
			}
		}
	}
	return DEFAULT_DB;
}

class DbStore {
	data = $state<Database>(loadInitialData());
	globalLanguageId = $state<string>(
		(browser && localStorage.getItem('copypasta_local_lang')) || 'en'
	);
	editingSnippetIds = $state<string[]>([]);
	conflictData = $state<Database | null>(null);
	isLoading = $state(false);
	error = $state<string | null>(null);
	syncStatus = $state<'Offline/No Auth' | 'Syncing...' | 'Synced' | 'Error' | 'Local Only'>(
		authStore.isValid ? 'Syncing...' : 'Local Only'
	);

	setGlobalLanguageId(id: string) {
		this.globalLanguageId = id;
		if (browser) {
			localStorage.setItem('copypasta_local_lang', id);
		}
	}

	getLastSyncedAt(): number {
		if (!browser) return 0;
		return parseInt(localStorage.getItem('copypasta_last_synced') || '0', 10);
	}

	setLastSyncedAt(timestamp: number) {
		if (browser) {
			localStorage.setItem('copypasta_last_synced', timestamp.toString());
		}
	}

	async sync() {
		if (!authStore.isValid) {
			this.syncStatus = 'Offline/No Auth';
			return;
		}
		if (!navigator.onLine) {
			this.syncStatus = 'Offline/No Auth';
			return;
		}

		this.isLoading = true;
		this.syncStatus = 'Syncing...';
		this.error = null;
		try {
			const res = await fetch(`https://api.github.com/gists/${authStore.gistId}`, {
				headers: {
					Authorization: `Bearer ${authStore.token}`,
					Accept: 'application/vnd.github.v3+json'
				}
			});
			if (!res.ok) throw new Error('Failed to fetch gist');
			const gist = await res.json();
			const file = gist.files['copypasta.json'];
			if (file && file.content) {
				const remoteData = JSON.parse(file.content) as Database;
				const localDate = new Date(this.data.updatedAt || 0).getTime();
				const remoteDate = new Date(remoteData.updatedAt || 0).getTime();
				const lastSynced = this.getLastSyncedAt();

				if (!remoteData.updatedAt) {
					await this._pushToGist();
				} else {
					const isRemoteNewer = remoteDate > lastSynced;
					const isLocalNewer = localDate > lastSynced;

					if (isRemoteNewer && isLocalNewer && localDate !== remoteDate) {
						this.conflictData = remoteData;
						this.syncStatus = 'Error';
						this.isLoading = false;
						return;
					} else if (isRemoteNewer) {
						this.forcePull(remoteData);
					} else if (isLocalNewer) {
						await this._pushToGist();
					} else {
						this.syncStatus = 'Synced';
					}
				}
			} else {
				// Initialize gist if empty
				await this._pushToGist();
			}
		} catch (err) {
			const e = err as Error;
			this.error = e.message;
			this.syncStatus = 'Error';
		} finally {
			this.isLoading = false;
		}
	}

	private _saveLocal() {
		if (browser) {
			localStorage.setItem('copypasta_local_db', JSON.stringify(this.data));
		}
	}

	private _saveTimeout: ReturnType<typeof setTimeout> | null = null;

	async save() {
		this.data.updatedAt = new Date().toISOString();
		this._saveLocal();

		if (this._saveTimeout) {
			clearTimeout(this._saveTimeout);
		}

		this._saveTimeout = setTimeout(() => {
			this._saveTimeout = null;
			this._pushToGist();
		}, 1000);
	}

	async forcePush() {
		this.conflictData = null;
		await this._pushToGist();
	}

	forcePull(remoteData: Database) {
		this.conflictData = null;
		this.data = remoteData;
		this._saveLocal();
		this.setLastSyncedAt(new Date(remoteData.updatedAt || 0).getTime());
		this.syncStatus = 'Synced';
	}

	private async _pushToGist() {
		if (!authStore.isValid) {
			this.syncStatus = 'Local Only';
			return;
		}
		if (!navigator.onLine) {
			this.syncStatus = 'Offline/No Auth';
			return;
		}

		this.isLoading = true;
		this.syncStatus = 'Syncing...';
		this.error = null;
		try {
			const res = await fetch(`https://api.github.com/gists/${authStore.gistId}`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${authStore.token}`,
					Accept: 'application/vnd.github.v3+json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					files: {
						'copypasta.json': {
							content: JSON.stringify(this.data, null, 2)
						}
					}
				})
			});
			if (!res.ok) throw new Error('Failed to update gist');
			this.setLastSyncedAt(new Date(this.data.updatedAt).getTime());
			this.syncStatus = 'Synced';
		} catch (err) {
			const e = err as Error;
			this.error = e.message;
			this.syncStatus = 'Error';
		} finally {
			this.isLoading = false;
		}
	}
}

export const dbStore = new DbStore();
