import {
	LoaderFunctionArgs,
	Outlet,
	redirect,
	useLoaderData,
} from 'react-router';
import Footer from '~/components/Footer';
import Header from '~/components/Header';
import { hs_getConfig } from '~/utils/config/loader';
import { noContext } from '~/utils/log';
import { getSession } from '~/utils/sessions.server';
import type { AppContext } from '~server/context/app';

// This loads the bare minimum for the application to function
// So we know that if context fails to load then well, oops?
export async function loader({
	request,
	context,
}: LoaderFunctionArgs<AppContext>) {
	const session = await getSession(request.headers.get('Cookie'));
	if (!session.has('hsApiKey')) {
		return redirect('/login');
	}

	if (!context) {
		throw noContext();
	}

	const ctx = context.context;
	const { mode, config } = hs_getConfig();

	return {
		config,
		url: ctx.headscale.public_url ?? ctx.headscale.url,
		configAvailable: mode !== 'no',
		debug: ctx.debug,
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
	);
}
