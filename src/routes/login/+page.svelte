<script lang="ts">
	import { base } from "$app/paths";
</script>

<svelte:head>
	<title>Login</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center">
	<div class="w-1/3 border p-4 rounded-lg">
		<h1 class="text-2xl">Login</h1>
		<p class="text-sm text-gray-500 mt-8 mb-4">
			Enter an API key to authenticate with Headplane. You can generate
			one by running
			<code class="bg-gray-100 p-1 rounded-md">
				headscale apikeys create
			</code>
			in your terminal.
		</p>

		<input
			type="text"
			id="api-key"
			class="border rounded-md p-2 w-full"
			placeholder="API Key"
		/>
		<div class="flex items-center gap-x-2 py-2">
			<hr class="flex-1" />
			<span class="text-gray-500">or</span>
			<hr class="flex-1" />
		</div>
		<a href={`${base}/oidc/start`}>
			<button class="bg-blue-500 text-white rounded-md p-2 w-full">
				Login with SSO
			</button>
		</a>
	</div>
</div>
