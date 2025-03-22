import { XCircleFillIcon } from '@primer/octicons-react';
import { type LoaderFunctionArgs, redirect } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import type { LoadContext } from '~/server';
import { ResponseError } from '~/server/headscale/api-client';
import cn from '~/utils/cn';
import log from '~/utils/log';
import { useLiveData } from '~/utils/useLiveData';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const healthy = await context.client.healthcheck();
	const session = await context.sessions.auth(request);

	// We shouldn't session invalidate if Headscale is down
	if (healthy) {
		try {
			await context.client.get('/api/v1/apikey', session.get('api_key')!);
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
	useLiveData({ interval: 3000 });
	const { healthy } = useLoaderData<typeof loader>();

	return (
		<>
			{!healthy ? (
				<div
					className={cn(
						'fixed bottom-0 right-0 z-50 w-fit h-14',
						'flex flex-col justify-center gap-1',
					)}
				>
					<div
						className={cn(
							'flex items-center gap-1.5 mr-1.5 py-2 px-1.5',
							'border rounded-lg text-white bg-red-500',
							'border-red-600 dark:border-red-400 shadow-sm',
						)}
					>
						<XCircleFillIcon className="w-4 h-4 text-white" />
						Headscale is unreachable
					</div>
				</div>
			) : undefined}
			<main className="container mx-auto overscroll-contain mt-4 mb-24">
				<Outlet />
			</main>
		</>
	);
}
