<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { dbStore } from '$lib/stores/db.svelte';
	import {
		Copy,
		Cloud,
		CloudOff,
		CloudCog,
		AlertCircle,
		Home,
		FolderHeart,
		Settings
	} from '@lucide/svelte';
</script>

<div class="navbar sticky top-0 z-50 border-b border-base-200 bg-base-100 px-4 shadow-sm">
	<div class="navbar-start">
		<a href="{base}/" class="btn gap-2 btn-ghost px-0 text-xl">
			<Copy class="h-6 w-6 text-primary" />
			<span class="font-bold">Copypasta</span>
		</a>
	</div>

	<div class="navbar-center hidden gap-1 sm:flex">
		<a href="{base}/" class="btn btn-ghost btn-sm {page.url.pathname === '/' ? 'btn-active' : ''}">
			<Home class="h-4 w-4" /> Home
		</a>
		<a
			href="{base}/categories"
			class="btn btn-ghost btn-sm {page.url.pathname === '/categories' ? 'btn-active' : ''}"
		>
			<FolderHeart class="h-4 w-4" /> Categories
		</a>
		<a
			href="{base}/settings"
			class="btn btn-ghost btn-sm {page.url.pathname === '/settings' ? 'btn-active' : ''}"
		>
			<Settings class="h-4 w-4" /> Settings
		</a>
	</div>

	<div class="navbar-end">
		<!-- Sync Status Badge -->
		<div
			class="sm:tooltip sm:tooltip-left sm:before:text-xs"
			data-tip={dbStore.data.updatedAt && dbStore.data.updatedAt !== '1970-01-01T00:00:00.000Z'
				? `${new Date(dbStore.data.updatedAt).toLocaleString()}`
				: ''}
		>
			<div
				class="mr-2 badge sm:mr-4 {dbStore.syncStatus === 'Synced'
					? 'badge-outline badge-success'
					: dbStore.syncStatus === 'Syncing...'
						? 'badge-outline badge-info'
						: dbStore.syncStatus === 'Error'
							? 'badge-outline badge-error'
							: 'badge-ghost'}"
			>
				{#if dbStore.syncStatus === 'Synced'}
					<Cloud class="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
				{:else if dbStore.syncStatus === 'Syncing...'}
					<CloudCog class="mr-1 h-3 w-3 animate-pulse sm:h-4 sm:w-4" />
				{:else if dbStore.syncStatus === 'Error'}
					<AlertCircle class="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
				{:else}
					<CloudOff class="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
				{/if}
				<span class="hidden sm:inline">{dbStore.syncStatus}</span>
			</div>
		</div>
	</div>
</div>
