<script lang="ts">
	import { IconCopy } from "@tabler/icons-svelte";
	import { toast } from "@zerodevx/svelte-toast";
	import clsx from "clsx";
	export let key: string;
	export let value: string;
	export let copyable = false;
</script>

<dl class="flex gap-1 text-sm">
	<dt
		class="w-1/4 shrink-0 min-w-0 truncate text-gray-700 dark:text-gray-300"
	>
		{key}
	</dt>
	{#if copyable}
		<button
			class="focus:outline-none flex items-center gap-x-1 truncate hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
			on:click={() => {
				navigator.clipboard.writeText(value);
				toast.push("Copied " + key);
			}}
		>
			<dd class="min-w-0 truncate px-2 py-1">
				{value}
			</dd>
			<IconCopy
				stroke={1}
				size={24}
				class="text-gray-600 dark:text-gray-200 pr-2"
			/>
		</button>
	{:else}
		<dd class="min-w-0 truncate px-2 py-1">
			{value}
		</dd>
	{/if}
</dl>
