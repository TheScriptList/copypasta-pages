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
		Clock,
		Home,
		FolderHeart,
		Settings
	} from '@lucide/svelte';
	import { scale, fade } from 'svelte/transition';
</script>

<div class="navbar sticky top-0 z-50 border-b border-base-200 bg-base-100 px-4 shadow-sm">
	<div class="navbar-start">
		<a href="{base}/" class="btn gap-2 btn-ghost px-0 text-xl">
			<Copy class="h-6 w-6 text-primary" />
			<span class="font-bold">Copypasta</span>
		</a>
	</div>

	<div class="navbar-center hidden gap-1 sm:flex">
		<a href="{base}/" class="btn btn-ghost btn-sm {page.route.id === '/' ? 'btn-active' : ''}">
			<Home class="h-4 w-4" /> Home
		</a>
		<a
			href="{base}/categories"
			class="btn btn-ghost btn-sm {page.route.id === '/categories' ? 'btn-active' : ''}"
		>
			<FolderHeart class="h-4 w-4" /> Categories
		</a>
		<a
			href="{base}/settings"
			class="btn btn-ghost btn-sm {page.route.id === '/settings' ? 'btn-active' : ''}"
		>
			<Settings class="h-4 w-4" /> Settings
		</a>
	</div>

	<div class="navbar-end">
		<!-- Sync Status Badge -->
		<div
			class="sm:tooltip sm:tooltip-bottom"
			data-tip={dbStore.data.updatedAt && dbStore.data.updatedAt !== '1970-01-01T00:00:00.000Z'
				? `${new Date(dbStore.data.updatedAt).toLocaleString()}`
				: ''}
		>
			<div
				class="mr-2 badge inline-grid place-items-center badge-soft transition-colors duration-300 sm:mr-4
				{dbStore.syncStatus === 'Synced'
					? 'badge-success'
					: dbStore.syncStatus === 'Syncing...'
						? 'badge-info'
						: dbStore.syncStatus === 'Unsaved'
							? 'badge-warning'
							: dbStore.syncStatus === 'Error'
								? 'badge-error'
								: ''}"
			>
				{#key dbStore.syncStatus}
					<div
						class="col-start-1 row-start-1 flex items-center justify-center"
						in:scale={{ duration: 300, start: 0.8, delay: 150 }}
						out:fade={{ duration: 150 }}
					>
						{#if dbStore.syncStatus === 'Synced'}
							<Cloud class="h-4 w-4 sm:mr-1" />
						{:else if dbStore.syncStatus === 'Syncing...'}
							<CloudCog class="h-4 w-4 animate-pulse sm:mr-1" />
						{:else if dbStore.syncStatus === 'Unsaved'}
							<Clock class="h-4 w-4 sm:mr-1" />
						{:else if dbStore.syncStatus === 'Error'}
							<AlertCircle class="h-4 w-4 sm:mr-1" />
						{:else}
							<CloudOff class="h-4 w-4 sm:mr-1" />
						{/if}
						<span class="hidden sm:inline">{dbStore.syncStatus}</span>
					</div>
				{/key}
			</div>
		</div>
		<div class="sm:tooltip sm:tooltip-bottom" data-tip="GitHub">
			<a
				href="https://github.com/TheScriptList/copypasta-pages"
				target="_blank"
				rel="noopener noreferrer"
				class="btn btn-circle btn-ghost"
			>
				<svg
					role="img"
					class="h-5 w-5 fill-current"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
					><title>GitHub</title><path
						d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
					/></svg
				>
			</a>
		</div>
	</div>
</div>
