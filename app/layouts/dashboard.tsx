import { type LoaderFunctionArgs, redirect } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import { useEffect } from 'react'

import { ErrorPopup } from '~/components/Error';
import Header from '~/components/Header';
import { toast } from '~/components/Toaster';
import Footer from '~/components/Footer';
import Link from '~/components/Link';
import { useLiveData } from '~/utils/useLiveData'
import { cn } from '~/utils/cn';
import { loadContext } from '~/utils/config/headplane';
import { HeadscaleError, pull, healthcheck } from '~/utils/headscale';
import { destroySession, getSession } from '~/utils/sessions.server';
import { XCircleFillIcon } from '@primer/octicons-react';
import log from '~/utils/log';

export async function loader({ request }: LoaderFunctionArgs) {
	let healthy = false;
	try {
		healthy = await healthcheck();
	} catch (error) {
		log.debug('APIC', 'Healthcheck failed %o', error);
	}

	// We shouldn't session invalidate if Headscale is down
	if (healthy) {
		// We can assert because shell ensures this is set
		const session = await getSession(request.headers.get('Cookie'));
		const apiKey = session.get('hsApiKey')!;

		try {
			await pull('v1/apikey', apiKey);
		} catch (error) {
			if (error instanceof HeadscaleError) {
				log.debug('APIC', 'API Key validation failed %o', error);
				return redirect('/login', {
					headers: {
						'Set-Cookie': await destroySession(session),
					},
				});
			}
		}
	}

	return {
		healthy,
	}
}

export default function Layout() {
	useLiveData({ interval: 3000 });
	const { healthy } = useLoaderData<typeof loader>()

	return (
		<>
			{!healthy ? (
				<div className={cn(
					'fixed bottom-0 right-0 z-50 w-fit h-14',
					'flex flex-col justify-center gap-1',
				)}>
					<div className={cn(
						'flex items-center gap-1.5 mr-1.5 py-2 px-1.5',
						'border rounded-lg text-white bg-red-500',
						'border-red-600 dark:border-red-400 shadow-sm',
					)}>
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
