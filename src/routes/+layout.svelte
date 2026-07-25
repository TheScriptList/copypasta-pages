<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/Navbar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { dbStore } from '$lib/stores/db.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { AlertTriangle } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		if (authStore.isValid) {
			dbStore.sync();
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-base-200 pb-16 sm:pb-0 flex flex-col">
	<Navbar />
	
	<main class="flex-1 p-4 max-w-7xl mx-auto w-full">
		{@render children()}
	</main>
	
	<BottomNav />
</div>

<div class="modal {dbStore.conflictData ? 'modal-open' : ''}">
	<div class="modal-box max-w-md">
		<h3 class="font-bold text-lg text-warning flex items-center gap-2">
			<AlertTriangle class="w-5 h-5" /> Sync Conflict Detected
		</h3>
		<p class="py-4 text-sm">
			We found existing snippets in this Gist, but your local device has more recent changes. How would you like to proceed?
		</p>
		<div class="flex flex-col gap-3 mt-2">
			<button class="btn btn-primary h-auto py-3" onclick={async () => {
				await dbStore.forcePush();
			}}>
				<div class="flex flex-col items-start w-full">
					<span class="font-bold">Keep Local (Push)</span>
					<span class="text-xs font-normal opacity-80 mt-1 text-left leading-tight">Overwrite the remote Gist with your newer local data</span>
				</div>
			</button>
			<button class="btn btn-outline h-auto py-3" onclick={() => {
				if (dbStore.conflictData) dbStore.forcePull(dbStore.conflictData);
			}}>
				<div class="flex flex-col items-start w-full">
					<span class="font-bold">Download Remote (Pull)</span>
					<span class="text-xs font-normal opacity-80 mt-1 text-left leading-tight">Discard local changes and download data from the Gist</span>
				</div>
			</button>
		</div>
	</div>
</div>
