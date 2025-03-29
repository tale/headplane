import { BanIcon } from 'lucide-react';
import {
	LoaderFunctionArgs,
	Outlet,
	redirect,
	useLoaderData,
} from 'react-router';
import Card from '~/components/Card';
import Footer from '~/components/Footer';
import Header from '~/components/Header';
import type { LoadContext } from '~/server';
import { Capabilities } from '~/server/web/roles';

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

		const check = await context.sessions.check(request, Capabilities.ui_access);
		return {
			config: context.hs.c,
			url: context.config.headscale.public_url ?? context.config.headscale.url,
			configAvailable: context.hs.readable(),
			debug: context.config.debug,
			user: session.get('user'),
			uiAccess: check,
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
			{data.uiAccess ? (
				<Outlet />
			) : (
				<Card className="mx-auto w-fit mt-24">
					<div className="flex items-center justify-between">
						<Card.Title className="text-3xl mb-0">Access Denied</Card.Title>
						<BanIcon className="w-10 h-10" />
					</div>
					<Card.Text className="mt-4 text-lg">
						Your account does not have access to the UI. Please contact your
						administrator.
					</Card.Text>
				</Card>
			)}
			<Footer {...data} />
		</>
	);
}
