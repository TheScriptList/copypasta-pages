import { browser } from '$app/environment';

class AuthStore {
	token = $state(browser ? localStorage.getItem('gh_pat') || '' : '');
	gistId = $state(browser ? localStorage.getItem('gh_gist_id') || '' : '');

	save(token: string, gistId: string) {
		this.token = token;
		this.gistId = gistId;
		if (browser) {
			localStorage.setItem('gh_pat', token);
			localStorage.setItem('gh_gist_id', gistId);
		}
	}
    
	clear() {
		this.token = '';
		this.gistId = '';
		if (browser) {
			localStorage.removeItem('gh_pat');
			localStorage.removeItem('gh_gist_id');
		}
	}

	get isValid() {
		return this.token.length > 0 && this.gistId.length > 0;
	}
}

export const authStore = new AuthStore();
