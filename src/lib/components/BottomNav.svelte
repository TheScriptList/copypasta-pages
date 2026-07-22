<script lang="ts">
	import { page } from '$app/state';
	import { Home, FolderHeart, Settings } from 'lucide-svelte';
</script>

<div class="dock sm:hidden border-t border-base-200 z-50">
	<a href="/" class={page.url.pathname === '/' ? 'dock-active text-primary' : 'text-base-content/70'}>
		<Home class="w-5 h-5" />
		<span class="dock-label">Home</span>
	</a>
	<a href="/categories" class={page.url.pathname === '/categories' ? 'dock-active text-primary' : 'text-base-content/70'}>
		<FolderHeart class="w-5 h-5" />
		<span class="dock-label">Categories</span>
	</a>
	<a href="/settings" class={page.url.pathname === '/settings' ? 'dock-active text-primary' : 'text-base-content/70'}>
		<Settings class="w-5 h-5" />
		<span class="dock-label">Settings</span>
	</a>
</div>
