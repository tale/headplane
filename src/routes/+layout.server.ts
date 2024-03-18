import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from './$types';
import { base } from "$app/paths";

export async function load({ url, locals }: Parameters<LayoutServerLoad>[0]) {
	if (url.pathname === base) {
		redirect(307, `${base}/machines`);
	}

	if (!locals.apiKey && url.pathname !== `${base}/login`) {
		redirect(307, `${base}/login`);
	}

	return {
		apiKey: locals.apiKey,
	};
}
