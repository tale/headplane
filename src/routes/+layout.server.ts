import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from './$types';
import { base } from "$app/paths";

export async function load({ url }: Parameters<LayoutServerLoad>[0]) {
	if (url.pathname === base) {
		redirect(307, `${base}/machines`);
	}
}
