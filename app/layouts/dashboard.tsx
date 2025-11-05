import { Outlet, redirect } from 'react-router';
import { ErrorPopup } from '~/components/Error';
import { pruneEphemeralNodes } from '~/server/db/pruner';
import ResponseError from '~/server/headscale/api/response-error';
import log from '~/utils/log';
import type { Route } from './+types/dashboard';

export async function loader({ request, context, ...rest }: Route.LoaderArgs) {
	const session = await context.sessions.auth(request);
	const api = context.hsApi.getRuntimeClient(session.api_key);
	await pruneEphemeralNodes({ context, request, ...rest });
	const healthy = await api.isHealthy();

	// We shouldn't session invalidate if Headscale is down
	// TODO: Notify in the logs or the UI whether or not the OIDC auth key is wrong if enabled
	if (healthy) {
		try {
			await api.getApiKeys();
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
