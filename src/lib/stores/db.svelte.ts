import { browser } from '$app/environment';
import { authStore } from './auth.svelte';
import { GithubProvider } from './providers/github';
import { GDriveProvider } from './providers/gdrive';
import type { StorageAdapter } from './providers/types';
export interface Language {
	id: string;
	name: string;
	showInMultiple?: boolean;
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
		dismissedSyncWarning?: boolean;
		hideLanguageTitles?: boolean;
		slimMode?: boolean;
	};
	categories: Category[];
	snippets: Snippet[];
	updatedAt: string;
}

export const DEFAULT_DB: Database = {
	settings: {
		languages: [
			{ id: 'en', name: 'English', showInMultiple: true },
			{ id: 'de', name: 'German', showInMultiple: true }
		],
		hideLanguageTitles: false,
		slimMode: false
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
				const parsed = JSON.parse(stored);
				if (parsed?.settings?.languages) {
					parsed.settings.languages.forEach((l: Language) => {
						if (l.showInMultiple === undefined) {
							l.showInMultiple = l.id === 'en' || l.id === 'de';
						}
					});
				}
				return parsed;
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
	fluidWidth = $state<boolean>(
		browser && localStorage.getItem('copypasta_local_fluid_width') === 'true'
	);
	columnCount = $state<string>(
		(browser && localStorage.getItem('copypasta_local_column_count')) || '2'
	);
	editingSnippetIds = $state<string[]>([]);
	conflictData = $state<Database | null>(null);
	isLoading = $state(false);
	error = $state<string | null>(null);
	syncStatus = $state<
		'Offline/No Auth' | 'Unsaved' | 'Syncing...' | 'Synced' | 'Error' | 'Local Only'
	>(authStore.isValid ? 'Syncing...' : 'Local Only');

	setGlobalLanguageId(id: string) {
		this.globalLanguageId = id;
		if (browser) {
			localStorage.setItem('copypasta_local_lang', id);
		}
	}

	setFluidWidth(fluid: boolean) {
		this.fluidWidth = fluid;
		if (browser) {
			localStorage.setItem('copypasta_local_fluid_width', fluid.toString());
		}
	}

	setColumnCount(count: string) {
		this.columnCount = count;
		if (browser) {
			localStorage.setItem('copypasta_local_column_count', count);
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

	private getAdapter(): StorageAdapter | null {
		if (authStore.activeProvider === 'github') return new GithubProvider();
		if (authStore.activeProvider === 'gdrive') return new GDriveProvider();
		return null;
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

		const adapter = this.getAdapter();
		if (!adapter) {
			this.syncStatus = 'Local Only';
			return;
		}

		this.isLoading = true;
		this.syncStatus = 'Syncing...';
		this.error = null;

		try {
			const result = await adapter.sync(this.data, this.getLastSyncedAt());

			if (result.action === 'error') {
				this.error = result.error || 'Unknown sync error';
				this.syncStatus = 'Error';
			} else if (result.action === 'conflict') {
				this.conflictData = result.remoteData || null;
				this.syncStatus = 'Error';
			} else if (result.action === 'pulled' && result.remoteData) {
				this.forcePull(result.remoteData);
			} else if (result.action === 'pushed') {
				this.setLastSyncedAt(result.remoteDate || new Date(this.data.updatedAt).getTime());
				this.syncStatus = 'Synced';
			} else {
				this.syncStatus = 'Synced';
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

		let syncDelay = parseInt(import.meta.env.VITE_SYNC_DELAY_MS || '3000', 10);
		if (isNaN(syncDelay)) syncDelay = 3000;

		if (authStore.isValid) {
			this.syncStatus = 'Unsaved';
		}

		this._saveTimeout = setTimeout(() => {
			this._saveTimeout = null;
			this._pushToRemote();
		}, syncDelay);
	}

	async forcePush() {
		this.conflictData = null;
		await this._pushToRemote();
	}

	forcePull(remoteData: Database) {
		if (remoteData?.settings?.languages) {
			remoteData.settings.languages.forEach((l: Language) => {
				if (l.showInMultiple === undefined) {
					l.showInMultiple = l.id === 'en' || l.id === 'de';
				}
			});
		}
		this.conflictData = null;
		this.data = remoteData;
		this._saveLocal();
		this.setLastSyncedAt(new Date(remoteData.updatedAt || 0).getTime());
		this.syncStatus = 'Synced';
	}

	private async _pushToRemote() {
		if (!authStore.isValid) {
			this.syncStatus = 'Local Only';
			return;
		}
		if (!navigator.onLine) {
			this.syncStatus = 'Offline/No Auth';
			return;
		}

		const adapter = this.getAdapter();
		if (!adapter) {
			this.syncStatus = 'Local Only';
			return;
		}

		this.isLoading = true;
		this.syncStatus = 'Syncing...';
		this.error = null;

		try {
			const result = await adapter.push(this.data);
			this.setLastSyncedAt(result.remoteDate);
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
