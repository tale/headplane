import { type ActionFunctionArgs, redirect } from 'react-router';
import type { LoadContext } from '~/server';

export async function loader() {
	return redirect('/machines');
}

export async function action({
	request,
	context,
}: ActionFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	if (!session.has('api_key')) {
		return redirect('/login');
	}

	// When API key is disabled, we need to explicitly redirect
	// with a logout state to prevent auto login again.
	const url = context.config.oidc?.disable_api_key_login
		? '/login?s=logout'
		: '/login';

	return redirect(url, {
		headers: {
			'Set-Cookie': await context.sessions.destroy(session),
		},
	});
}
