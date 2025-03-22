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

	return redirect('/login', {
		headers: {
			'Set-Cookie': await context.sessions.destroy(session),
		},
	});
}
