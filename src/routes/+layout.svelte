<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/Navbar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { dbStore } from '$lib/stores/db.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		if (authStore.isValid) {
			dbStore.load();
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
