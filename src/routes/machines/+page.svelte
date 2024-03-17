<script lang="ts">
	import { IconCircleFilled, IconCopy } from "@tabler/icons-svelte";
	import { toast } from "@zerodevx/svelte-toast";
	import type { Machine } from "$lib/types";
	import clsx from "clsx";
	import { createQuery } from "@tanstack/svelte-query";
	import { pull } from "$lib/api";

	const query = createQuery({
		queryKey: ["machines"],
		queryFn: async () => {
			const data = await pull<{ nodes: Machine[] }>("v1/node");
			return data.nodes;
		},
	});
</script>

<svelte:head>
	<title>Machines</title>
</svelte:head>

{#if $query.isLoading}
	<p>Loading...</p>
{:else if $query.isError}
	<p>Error: {$query.error.message}</p>
{:else if $query.isSuccess}
	<table class="table-auto w-full rounded-lg">
		<thead>
			<tr class="text-left">
				<th class="pl-4">Name</th>
				<th>IP Addresses</th>
				<th>Last Seen</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-200">
			{#each $query.data as machine}
				<tr class="hover:bg-gray-100">
					<td class="pt-2 pb-4 pl-4">
						<h1>{machine.givenName}</h1>
						<span class="text-sm font-mono text-gray-500"
							>{machine.name}</span
						>
					</td>
					<td class="pt-2 pb-4 font-mono text-gray-600">
						{#each machine.ipAddresses as ip, i}
							<span
								class={clsx(
									"flex items-center gap-x-1",
									i > 0 && "text-sm text-gray-400",
								)}
							>
								{ip}
								<button
									class="focus:outline-none"
									on:click={() => {
										navigator.clipboard.writeText(ip);
										toast.push("Copied IP address");
									}}
								>
									<IconCopy
										stroke={1}
										size={16}
										class="text-gray-400"
									/>
								</button>
							</span>
						{/each}
					</td>
					<td>
						<span
							class="flex items-center gap-x-1 text-sm text-gray-500"
						>
							<IconCircleFilled
								stroke={1}
								size={24}
								class={clsx(
									"w-4 h-4",
									machine.online
										? "text-green-700"
										: "text-gray-300",
								)}
							/>
							<p>
								{machine.online
									? "Connected"
									: new Date(
											machine.lastSeen,
										).toLocaleString()}
							</p>
						</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
