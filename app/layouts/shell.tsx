import {
	LoaderFunctionArgs,
	Outlet,
	redirect,
	useLoaderData,
} from 'react-router';
import Footer from '~/components/Footer';
import Header from '~/components/Header';
import type { LoadContext } from '~/server';

// This loads the bare minimum for the application to function
// So we know that if context fails to load then well, oops?
export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	try {
		const session = await context.sessions.auth(request);
		if (!session.has('api_key')) {
			// There is a session, but it's not valid
			return redirect('/login', {
				headers: {
					'Set-Cookie': await context.sessions.destroy(session),
				},
			});
		}

		return {
			config: context.hs.c,
			url: context.config.headscale.public_url ?? context.config.headscale.url,
			configAvailable: context.hs.readable(),
			debug: context.config.debug,
			user: session.get('user'),
		};
	} catch {
		// No session, so we can just return
		return redirect('/login');
	}
}

export default function Shell() {
	const data = useLoaderData<typeof loader>();
	return (
		<>
			<Header {...data} />
			<Outlet />
			<Footer {...data} />
		</>
	);
}
