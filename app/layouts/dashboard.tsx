import { XCircleFillIcon } from '@primer/octicons-react';
import { ServerCrash } from 'lucide-react';
import {
	type LoaderFunctionArgs,
	isRouteErrorResponse,
	redirect,
	useRouteError,
} from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import Card from '~/components/Card';
import { ErrorPopup, getErrorMessage } from '~/components/Error';
import type { LoadContext } from '~/server';
import ResponseError from '~/server/headscale/api-error';
import cn from '~/utils/cn';
import log from '~/utils/log';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const healthy = await context.client.healthcheck();
	const session = await context.sessions.auth(request);

	// We shouldn't session invalidate if Headscale is down
	// TODO: Notify in the logs or the UI that OIDC auth key is wrong if enabled
	if (healthy) {
		try {
			await context.client.get('v1/apikey', session.get('api_key')!);
		} catch (error) {
			if (error instanceof ResponseError) {
				log.debug('api', 'API Key validation failed %o', error);
				return redirect('/login', {
					headers: {
						'Set-Cookie': await context.sessions.destroy(session),
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
		<>
			<main className="container mx-auto overscroll-contain mt-4 mb-24">
				<Outlet />
			</main>
		</>
	);
}

export function ErrorBoundary() {
	return <ErrorPopup type="embedded" />;
}
