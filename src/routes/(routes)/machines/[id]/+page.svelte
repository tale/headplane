<script lang="ts">
	import type { PageData } from "./$types";
	import { createQuery } from "@tanstack/svelte-query";
	import { pull } from "$lib/api";
	import type { Machine } from "$lib/types";
	import { IconCircleFilled } from "@tabler/icons-svelte";
	import Attribute from "$lib/components/Attribute.svelte";
	import clsx from "clsx";

	export let data: PageData;
	const query = createQuery({
		queryKey: [`machines/${data.id}`],
		queryFn: async () => {
			const response = await pull<{ node: Machine }>(
				`v1/node/${data.id}`,
				data.apiKey,
			);
			return response.node;
		},
	});
</script>

<svelte:head>
	<title>
		{$query.isSuccess ? `${$query.data.givenName} - Machines` : "Machines"}
	</title>
</svelte:head>

{#if $query.isLoading}
	<p>Loading...</p>
{:else if $query.isError}
	<p>Error: {$query.error.message}</p>
{:else if $query.isSuccess}
	<div>
		<span class="flex items-baseline gap-x-4 text-sm mb-4">
			<h1 class="text-2xl font-bold">
				{$query.data.givenName}
			</h1>
			<IconCircleFilled
				stroke={1}
				size={24}
				class={clsx(
					"w-4 h-4",
					$query.data.online ? "text-green-700" : "text-gray-300",
				)}
			/>
		</span>
		<div class="p-4 md:p-6 border dark:border-zinc-700 rounded-lg">
			<Attribute key="Creator" value={$query.data.user.name} />
			<Attribute key="Node ID" value={$query.data.id} />
			<Attribute key="Node Name" value={$query.data.givenName} />
			<Attribute key="Hostname" value={$query.data.name} />
			<Attribute
				key="Node Key"
				value={$query.data.nodeKey}
				copyable={true}
			/>
			<Attribute
				key="Created"
				value={new Date($query.data.createdAt).toLocaleString()}
			/>
			<Attribute
				key="Last Seen"
				value={new Date($query.data.lastSeen).toLocaleString()}
			/>
			<Attribute
				key="Expiry"
				value={new Date($query.data.expiry).toLocaleString()}
			/>
			<Attribute
				key="Domain"
				value={`${$query.data.givenName}.${$query.data.user.name}.ts.net`}
				copyable={true}
			/>
		</div>
	</div>
{/if}
