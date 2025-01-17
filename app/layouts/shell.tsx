import Header from '~/components/Header';
import Footer from '~/components/Footer';
import { getSession } from '~/utils/sessions.server';
import { loadContext } from '~/utils/config/headplane';
import { useLoaderData, LoaderFunctionArgs, Outlet, redirect } from 'react-router';

// This loads the bare minimum for the application to function
// So we know that if context fails to load then well, oops?
export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	if (!session.has('hsApiKey')) {
		return redirect('/login');
	}

	const context = await loadContext();
	return {
		config: context.config,
		url: context.headscalePublicUrl ?? context.headscaleUrl,
		debug: context.debug,
		user: session.get('user'),
	};
}

export default function Shell() {
	const data = useLoaderData<typeof loader>();
	return (
		<>
			<Header {...data} />
			<Outlet />
			<Footer {...data} />
		</>
	)
}
