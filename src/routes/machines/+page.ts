import { pull } from "$lib/api";
import type { Machine } from "$lib/types";
import type { PageLoad } from './$types';

export async function load({ parent }: Parameters<PageLoad>[0]) {
	const { queryClient } = await parent();

	await queryClient.prefetchQuery({
		queryKey: ['machines'],
		queryFn: async () => {
			const data = await pull<{ nodes: Machine[] }>('v1/node');
			return data.nodes;
		},
	});
}
