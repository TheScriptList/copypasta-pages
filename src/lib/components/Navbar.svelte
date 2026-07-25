<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { dbStore } from '$lib/stores/db.svelte';
	import { Copy, Cloud, CloudOff, CloudCog, AlertCircle, Home, FolderHeart, Settings } from 'lucide-svelte';
</script>

<div class="navbar bg-base-100 shadow-sm border-b border-base-200 sticky top-0 z-50 px-4">
	<div class="navbar-start">
		<a href="{base}/" class="btn btn-ghost text-xl gap-2 px-0">
			<Copy class="w-6 h-6 text-primary" />
			<span class="font-bold">Copypasta</span>
		</a>
	</div>
	
	<div class="navbar-center hidden sm:flex gap-1">
		<a href="{base}/" class="btn btn-ghost btn-sm {page.url.pathname === '/' ? 'btn-active' : ''}">
			<Home class="w-4 h-4" /> Home
		</a>
		<a href="{base}/categories" class="btn btn-ghost btn-sm {page.url.pathname === '/categories' ? 'btn-active' : ''}">
			<FolderHeart class="w-4 h-4" /> Categories
		</a>
		<a href="{base}/settings" class="btn btn-ghost btn-sm {page.url.pathname === '/settings' ? 'btn-active' : ''}">
			<Settings class="w-4 h-4" /> Settings
		</a>
	</div>

	<div class="navbar-end">
		<!-- Sync Status Badge -->
		<div class="sm:tooltip sm:tooltip-left sm:before:text-xs" data-tip={dbStore.data.updatedAt && dbStore.data.updatedAt !== '1970-01-01T00:00:00.000Z' ? `${new Date(dbStore.data.updatedAt).toLocaleString()}` : ''}>
			<div class="badge mr-2 sm:mr-4 {
				dbStore.syncStatus === 'Synced' ? 'badge-success badge-outline' :
				dbStore.syncStatus === 'Syncing...' ? 'badge-info badge-outline' :
				dbStore.syncStatus === 'Error' ? 'badge-error badge-outline' : 'badge-ghost'
			}">
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
		</div>
	</div>
</div>
