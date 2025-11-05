import { type LoaderFunctionArgs, Outlet, redirect } from 'react-router';
import { ErrorPopup } from '~/components/Error';
import type { LoadContext } from '~/server';
import { pruneEphemeralNodes } from '~/server/db/pruner';
import ResponseError from '~/server/headscale/api/error';
import log from '~/utils/log';

export async function loader({
	request,
	context,
	...rest
}: LoaderFunctionArgs<LoadContext>) {
	const healthy = await context.client.healthcheck();
	const session = await context.sessions.auth(request);
	await pruneEphemeralNodes({ context, request, ...rest });

	// We shouldn't session invalidate if Headscale is down
	// TODO: Notify in the logs or the UI that OIDC auth key is wrong if enabled
	if (healthy) {
		try {
			await context.client.get('v1/apikey', session.api_key);
		} catch (error) {
			if (error instanceof ResponseError) {
				log.debug('api', 'API Key validation failed %o', error);
				return redirect('/login', {
					headers: {
						'Set-Cookie': await context.sessions.destroySession(),
					},
				});
			}
		}
	}

	return {
		healthy,
	};
}

export default function Layout() {
	return (
		<main className="container mx-auto overscroll-contain mt-4 mb-24">
			<Outlet />
		</main>
	);
}

export function ErrorBoundary() {
	return <ErrorPopup type="embedded" />;
}
