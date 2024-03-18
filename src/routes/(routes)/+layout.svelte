<script lang="ts">
	import {
		IconBrandFlightradar24,
		IconServer,
		IconUsers,
	} from "@tabler/icons-svelte";
	import Link from "$lib/components/Link.svelte";
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

<main class="container mx-auto">
	<slot />
</main>
