<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/Navbar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { dbStore } from '$lib/stores/db.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { AlertTriangle } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		if (authStore.isValid) {
			dbStore.sync();
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col bg-base-200 pb-16 sm:pb-0">
	<Navbar />

	<main class="mx-auto w-full max-w-7xl flex-1 p-4">
		{@render children()}
	</main>

	<BottomNav />
</div>

<div class="modal {dbStore.conflictData ? 'modal-open' : ''}">
	<div class="modal-box max-w-md">
		<h3 class="flex items-center gap-2 text-lg font-bold text-warning">
			<AlertTriangle class="h-5 w-5" /> Sync Conflict Detected
		</h3>
		<p class="py-4 text-sm">
			We found existing snippets in this Gist, but your local device has more recent changes. How
			would you like to proceed?
		</p>
		<div class="mt-2 flex flex-col gap-3">
			<button
				class="btn h-auto py-3 btn-primary"
				onclick={async () => {
					await dbStore.forcePush();
				}}
			>
				<div class="flex w-full flex-col items-start">
					<span class="font-bold">Keep Local (Push)</span>
					<span class="mt-1 text-left text-xs leading-tight font-normal opacity-80"
						>Overwrite the remote Gist with your newer local data</span
					>
				</div>
			</button>
			<button
				class="btn h-auto btn-outline py-3"
				onclick={() => {
					if (dbStore.conflictData) dbStore.forcePull(dbStore.conflictData);
				}}
			>
				<div class="flex w-full flex-col items-start">
					<span class="font-bold">Download Remote (Pull)</span>
					<span class="mt-1 text-left text-xs leading-tight font-normal opacity-80"
						>Discard local changes and download data from the Gist</span
					>
				</div>
			</button>
		</div>
	</div>
</div>
