import type { Database } from '../db.svelte';

export interface SyncResult {
	action: 'pushed' | 'pulled' | 'conflict' | 'synced' | 'error';
	remoteData?: Database;
	remoteDate?: number;
	error?: string;
}

export interface StorageAdapter {
	/**
	 * Synchronizes local data with the remote storage.
	 * @param localData The current local database
	 * @param lastSyncedAt Timestamp of the last successful sync
	 */
	sync(localData: Database, lastSyncedAt: number): Promise<SyncResult>;

	/**
	 * Force pushes local data to the remote storage (overwrites remote).
	 * @param localData The current local database
	 */
	push(localData: Database): Promise<{ remoteDate: number }>;
}
