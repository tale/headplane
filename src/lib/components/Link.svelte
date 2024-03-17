<script lang="ts">
	import { page } from "$app/stores";
	import { base } from "$app/paths";
	import clsx from "clsx";

	export let to: string;
	export let name: string;
	export let icon: any;
</script>

<a
	href={`${base}${to}`}
	class={clsx(
		"flex items-center gap-x-2 p-4 border-b-2",
		$page.url.pathname === `${base}${to}`
			? "border-white"
			: "border-transparent",
	)}
>
	<svelte:component this={icon} stroke={1} size={24} />
	{name}
</a>
