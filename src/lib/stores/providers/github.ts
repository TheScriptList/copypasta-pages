import type { Database } from '../db.svelte';
import type { StorageAdapter, SyncResult } from './types';
import { authStore } from '../auth.svelte';

export class GithubProvider implements StorageAdapter {
	async sync(localData: Database, lastSyncedAt: number): Promise<SyncResult> {
		const token = authStore.github.token;
		const gistId = authStore.github.gistId;

		if (!token || !gistId) {
			return { action: 'error', error: 'Missing GitHub credentials' };
		}

		try {
			const res = await fetch(`https://api.github.com/gists/${gistId}`, {
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/vnd.github.v3+json'
				}
			});

			if (!res.ok) throw new Error('Failed to fetch gist');

			const gist = await res.json();
			const file = gist.files['copypasta.json'];

			if (file && file.content) {
				const remoteData = JSON.parse(file.content) as Database;

				// Migration for older data formats
				if (remoteData?.settings?.languages) {
					remoteData.settings.languages.forEach((l: any) => {
						if (l.showInMultiple === undefined) {
							l.showInMultiple = l.id === 'en' || l.id === 'de';
						}
					});
				}

				const localDate = new Date(localData.updatedAt || 0).getTime();
				const remoteDate = new Date(remoteData.updatedAt || 0).getTime();

				if (!remoteData.updatedAt) {
					// Remote is empty or invalid, push local
					const pushResult = await this.push(localData);
					return { action: 'pushed', remoteDate: pushResult.remoteDate };
				} else {
					const isRemoteNewer = remoteDate > lastSyncedAt;
					const isLocalNewer = localDate > lastSyncedAt;

					if (isRemoteNewer && isLocalNewer && localDate !== remoteDate) {
						return { action: 'conflict', remoteData, remoteDate };
					} else if (isRemoteNewer) {
						return { action: 'pulled', remoteData, remoteDate };
					} else if (isLocalNewer) {
						const pushResult = await this.push(localData);
						return { action: 'pushed', remoteDate: pushResult.remoteDate };
					} else {
						return { action: 'synced' };
					}
				}
			} else {
				// Initialize gist if empty
				const pushResult = await this.push(localData);
				return { action: 'pushed', remoteDate: pushResult.remoteDate };
			}
		} catch (err) {
			const e = err as Error;
			return { action: 'error', error: e.message };
		}
	}

	async push(localData: Database): Promise<{ remoteDate: number }> {
		const token = authStore.github.token;
		const gistId = authStore.github.gistId;

		if (!token || !gistId) {
			throw new Error('Missing GitHub credentials');
		}

		const res = await fetch(`https://api.github.com/gists/${gistId}`, {
			method: 'PATCH',
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/vnd.github.v3+json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				files: {
					'copypasta.json': {
						content: JSON.stringify(localData, null, 2)
					}
				}
			})
		});

		if (!res.ok) throw new Error('Failed to update gist');
		return { remoteDate: new Date(localData.updatedAt).getTime() };
	}
}
