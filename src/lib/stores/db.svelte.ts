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
	updatedAt: new Date().toISOString()
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

	async load() {
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
				
				if (remoteDate > localDate || !this.data.updatedAt) {
					this.data = remoteData;
					this._saveLocal();
				}
			} else {
				// Initialize gist if empty
				await this.save();
			}
			this.syncStatus = 'Synced';
		} catch (e: any) {
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

	async save() {
		this.data.updatedAt = new Date().toISOString();
		this._saveLocal();

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
			const content = JSON.stringify(this.data, null, 2);
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
							content
						}
					}
				})
			});
			if (!res.ok) throw new Error('Failed to save to gist');
			this.syncStatus = 'Synced';
		} catch (e: any) {
			this.error = e.message;
			this.syncStatus = 'Error';
		} finally {
			this.isLoading = false;
		}
	}
}

export const dbStore = new DbStore();
