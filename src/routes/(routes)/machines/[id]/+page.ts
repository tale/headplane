import { pull } from "$lib/api";
import type { Machine } from "$lib/types";
import type { PageLoad } from './$types';

export async function load({ parent, params }: Parameters<PageLoad>[0]) {
	const { queryClient, apiKey } = await parent();

	await queryClient.prefetchQuery({
		queryKey: [`machines/${params.id}`],
		queryFn: async () => {
			const data = await pull<{ node: Machine }>(`v1/node/${params.id}`, apiKey);
			return data.node;
		},
	});

	return {
		id: params.id,
		apiKey,
	}
}
