import type { Database } from '../db.svelte';
import type { StorageAdapter, SyncResult } from './types';
import { authStore } from '../auth.svelte';

export class GDriveProvider implements StorageAdapter {
	private readonly fileName = 'copypasta.json';

	private async findFile(token: string): Promise<{ id: string } | null> {
		const res = await fetch(
			`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${this.fileName}'&fields=files(id,name)`,
			{
				headers: {
					Authorization: `Bearer ${token}`
				}
			}
		);
		if (!res.ok) throw new Error('Failed to list files in Google Drive AppData');
		const data = await res.json();
		if (data.files && data.files.length > 0) {
			return { id: data.files[0].id };
		}
		return null;
	}

	async sync(localData: Database, lastSyncedAt: number): Promise<SyncResult> {
		const token = authStore.gdrive.accessToken;

		if (!token) {
			return { action: 'error', error: 'Missing Google Drive credentials' };
		}

		try {
			// Find if the file exists
			let fileId = authStore.gdrive.fileId;
			if (!fileId) {
				const found = await this.findFile(token);
				if (found) {
					fileId = found.id;
					authStore.gdrive.fileId = fileId;
					authStore.save();
				}
			}

			if (fileId) {
				// File exists, fetch it
				const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
					headers: {
						Authorization: `Bearer ${token}`
					}
				});

				if (!res.ok) throw new Error('Failed to fetch file from Google Drive');
				const remoteData = (await res.json()) as Database;

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
				// Initialize file if it doesn't exist
				const pushResult = await this.push(localData);
				return { action: 'pushed', remoteDate: pushResult.remoteDate };
			}
		} catch (err) {
			const e = err as Error;
			return { action: 'error', error: e.message };
		}
	}

	async push(localData: Database): Promise<{ remoteDate: number }> {
		const token = authStore.gdrive.accessToken;

		if (!token) {
			throw new Error('Missing Google Drive credentials');
		}

		let fileId = authStore.gdrive.fileId;
		const boundary = '-------314159265358979323846';
		const delimiter = `\r\n--${boundary}\r\n`;
		const close_delim = `\r\n--${boundary}--`;

		const contentType = 'application/json';
		const metadata = {
			name: this.fileName,
			mimeType: contentType,
			parents: fileId ? undefined : ['appDataFolder']
		};

		const multipartRequestBody =
			delimiter +
			'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
			JSON.stringify(metadata) +
			delimiter +
			'Content-Type: ' +
			contentType +
			'\r\n\r\n' +
			JSON.stringify(localData, null, 2) +
			close_delim;

		let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
		let method = 'POST';

		if (fileId) {
			// Update existing file
			url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
			method = 'PATCH';
		} else {
			// First time, create it
			const found = await this.findFile(token);
			if (found) {
				fileId = found.id;
				authStore.gdrive.fileId = fileId;
				authStore.save();
				url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
				method = 'PATCH';
				// Remove parents from metadata since we are updating
				delete metadata.parents;
			}
		}

		const res = await fetch(url, {
			method: method,
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': `multipart/related; boundary=${boundary}`
			},
			body: multipartRequestBody
		});

		if (!res.ok) throw new Error('Failed to update Google Drive AppData');
		const data = await res.json();
		
		if (!fileId && data.id) {
			authStore.gdrive.fileId = data.id;
			authStore.save();
		}

		return { remoteDate: new Date(localData.updatedAt).getTime() };
	}
}
