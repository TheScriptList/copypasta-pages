<script lang="ts">
	import { page } from '$app/state';
	import { dbStore } from '$lib/stores/db.svelte';
	import { Copy, Cloud, CloudOff, CloudCog, AlertCircle } from 'lucide-svelte';
</script>

<div class="navbar bg-base-100 shadow-sm border-b border-base-200 sticky top-0 z-50 px-4">
	<div class="flex-1">
		<a href="/" class="btn btn-ghost text-xl gap-2 px-0">
			<Copy class="w-6 h-6 text-primary" />
			<span class="font-bold">Copypasta</span>
		</a>
	</div>
	<div class="flex-none flex items-center gap-2">
		<!-- Sync Status Badge -->
		<div class="badge badge-sm sm:badge-md mr-2 sm:mr-4 {
			dbStore.syncStatus === 'Synced' ? 'badge-success badge-outline' :
			dbStore.syncStatus === 'Syncing...' ? 'badge-info badge-outline' :
			dbStore.syncStatus === 'Error' ? 'badge-error badge-outline' : 'badge-ghost'
		}" title={dbStore.syncStatus}>
			{#if dbStore.syncStatus === 'Synced'}
				<Cloud class="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
			{:else if dbStore.syncStatus === 'Syncing...'}
				<CloudCog class="w-3 h-3 sm:w-4 sm:h-4 mr-1 animate-pulse" />
			{:else if dbStore.syncStatus === 'Error'}
				<AlertCircle class="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
			{:else}
				<CloudOff class="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
			{/if}
			<span class="hidden sm:inline">{dbStore.syncStatus}</span>
		</div>

		<div class="hidden sm:flex gap-1">
			<a href="/" class="btn btn-ghost btn-sm {page.url.pathname === '/' ? 'btn-active' : ''}">Home</a>
			<a href="/categories" class="btn btn-ghost btn-sm {page.url.pathname === '/categories' ? 'btn-active' : ''}">Categories</a>
			<a href="/settings" class="btn btn-ghost btn-sm {page.url.pathname === '/settings' ? 'btn-active' : ''}">Settings</a>
		</div>
	</div>
</div>
