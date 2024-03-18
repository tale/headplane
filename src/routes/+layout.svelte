<script lang="ts">
	import "../app.css";
	import Link from "$lib/components/Link.svelte";
	import { SvelteToast } from "@zerodevx/svelte-toast";
	import {
		type QueryClient,
		QueryClientProvider,
	} from "@tanstack/svelte-query";

	import {
		IconBrandFlightradar24,
		IconServer,
		IconUsers,
	} from "@tabler/icons-svelte";

	type Data = {
		queryClient: QueryClient;
	};

	export let data: Data;
</script>

<header class="bg-gray-800 text-white mb-16">
	<nav class="container mx-auto">
		<div class="flex items-center gap-x-2 mb-8 pt-4">
			<IconBrandFlightradar24 stroke={1} size={24} />
			<h1 class="text-2xl">Headplane</h1>
		</div>
		<div class="flex items-center gap-x-4">
			<Link to="/machines" name="Machines" icon={IconServer} />
			<Link to="/users" name="Users" icon={IconUsers} />
		</div>
	</nav>
</header>

<QueryClientProvider client={data.queryClient}>
	<main class="container mx-auto">
		<slot />
	</main>
</QueryClientProvider>

<SvelteToast
	options={{
		duration: 2000,
		initial: 2000,
		dismissable: false,
		reversed: true,
		intro: { y: "100%" },
	}}
/>
