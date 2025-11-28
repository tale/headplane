import { Outlet, redirect } from 'react-router';
import { ErrorBanner } from '~/components/error-banner';
import { pruneEphemeralNodes } from '~/server/db/pruner';
import { isDataUnauthorizedError } from '~/server/headscale/api/error-client';
import log from '~/utils/log';
import type { Route } from './+types/dashboard';

export async function loader({ request, context, ...rest }: Route.LoaderArgs) {
	const session = await context.sessions.auth(request);
	const api = context.hsApi.getRuntimeClient(session.api_key);

	// MARK: The session should stay valid if Headscale isn't healthy
	const healthy = await api.isHealthy();
	if (healthy) {
		try {
			await api.getApiKeys();
			await pruneEphemeralNodes({ context, request, ...rest });
		} catch (error) {
			if (isDataUnauthorizedError(error)) {
				log.warn(
					'auth',
					'Logging out %s due to expired API key',
					session.user.name,
				);
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

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return (
		<div className="w-fit mx-auto overscroll-contain my-24">
			<ErrorBanner className="max-w-2xl" error={error} />
		</div>
	);
}
