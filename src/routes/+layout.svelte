<script lang="ts">
	import "../app.css";
	import { SvelteToast } from "@zerodevx/svelte-toast";
	import {
		type QueryClient,
		QueryClientProvider,
	} from "@tanstack/svelte-query";

	type Data = {
		queryClient: QueryClient;
	};

	export let data: Data;
</script>

<QueryClientProvider client={data.queryClient}>
	<slot />
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
