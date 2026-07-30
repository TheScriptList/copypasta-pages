import { browser } from '$app/environment';

export type ActiveProvider = 'github' | 'gdrive' | 'none';

class AuthStore {
	activeProvider = $state<ActiveProvider>(
		browser ? (localStorage.getItem('cp_active_provider') as ActiveProvider) || 'none' : 'none'
	);

	github = $state({
		token: browser ? localStorage.getItem('gh_pat') || '' : '',
		gistId: browser ? localStorage.getItem('gh_gist_id') || '' : ''
	});

	gdrive = $state({
		clientId: browser
			? localStorage.getItem('gd_client_id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
			: '',
		accessToken: browser ? localStorage.getItem('gd_access_token') || '' : '',
		fileId: browser ? localStorage.getItem('gd_file_id') || '' : ''
	});

	save() {
		if (browser) {
			localStorage.setItem('cp_active_provider', this.activeProvider);

			// Github
			localStorage.setItem('gh_pat', this.github.token);
			localStorage.setItem('gh_gist_id', this.github.gistId);

			// GDrive
			localStorage.setItem('gd_client_id', this.gdrive.clientId);
			localStorage.setItem('gd_access_token', this.gdrive.accessToken);
			localStorage.setItem('gd_file_id', this.gdrive.fileId);
		}
	}

	clearProvider(provider: ActiveProvider) {
		if (provider === 'github') {
			this.github.token = '';
			this.github.gistId = '';
		} else if (provider === 'gdrive') {
			this.gdrive.accessToken = '';
			this.gdrive.fileId = '';
		}
		this.save();
	}

	get isValid() {
		if (this.activeProvider === 'github') {
			return this.github.token.length > 0 && this.github.gistId.length > 0;
		}
		if (this.activeProvider === 'gdrive') {
			return this.gdrive.accessToken.length > 0; // FileId can be empty initially
		}
		return false;
	}
}

export const authStore = new AuthStore();
