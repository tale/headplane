import { browser } from '$app/environment'
import { QueryClient } from '@tanstack/svelte-query'
import type { LayoutLoadEvent } from './$types'

export async function load({ data }: LayoutLoadEvent) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				enabled: browser,
				refetchInterval: 1000
			},
		},
	})

	return {
		queryClient,
		apiKey: data.apiKey,
	}
}
