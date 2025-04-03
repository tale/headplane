import { LoaderFunctionArgs, redirect } from 'react-router';
import { LoadContext } from '~/server';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	const user = session.get('user');
	if (!user) {
		return redirect('/login');
	}

	context.sessions.overrideOnboarding(user.subject, true);
	return redirect('/machines');
}
