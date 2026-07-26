<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { Home, FolderHeart, Settings } from '@lucide/svelte';
</script>

<div class="dock z-50 border-t border-base-200 sm:hidden">
	<a href="{base}/" class={page.route.id === '/' ? 'dock-active' : ''}>
		<Home class="h-5 w-5" />
		<span class="dock-label">Home</span>
	</a>
	<a href="{base}/categories" class={page.route.id === '/categories' ? 'dock-active' : ''}>
		<FolderHeart class="h-5 w-5" />
		<span class="dock-label">Categories</span>
	</a>
	<a href="{base}/settings" class={page.route.id === '/settings' ? 'dock-active' : ''}>
		<Settings class="h-5 w-5" />
		<span class="dock-label">Settings</span>
	</a>
</div>
