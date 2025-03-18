import {
	LoaderFunctionArgs,
	Outlet,
	redirect,
	useLoaderData,
} from 'react-router';
import Footer from '~/components/Footer';
import Header from '~/components/Header';
import { hs_getConfig } from '~/utils/config/loader';
import { getSession } from '~/utils/sessions.server';
import type { AppContext } from '~server/context/app';
import { hp_getConfig } from '~server/context/global';

// This loads the bare minimum for the application to function
// So we know that if context fails to load then well, oops?
export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	if (!session.has('hsApiKey')) {
		return redirect('/login');
	}

	const context = hp_getConfig();
	const { mode, config } = hs_getConfig();

	return {
		config,
		url: context.headscale.public_url ?? context.headscale.url,
		configAvailable: mode !== 'no',
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
	);
}
