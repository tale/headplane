import { CircleCheckIcon } from 'lucide-react';
import {
	LoaderFunctionArgs,
	Outlet,
	redirect,
	useLoaderData,
} from 'react-router';
import Button from '~/components/Button';
import Card from '~/components/Card';
import Footer from '~/components/Footer';
import Header from '~/components/Header';
import type { LoadContext } from '~/server';
import { Capabilities } from '~/server/web/roles';
import { User } from '~/types';
import log from '~/utils/log';
import toast from '~/utils/toast';

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

		// Onboarding is only a feature of the OIDC flow
		if (context.oidc && !request.url.endsWith('/onboarding')) {
			let onboarded = false;

			const sessionUser = session.get('user');
			if (sessionUser) {
				if (context.sessions.onboardForSubject(sessionUser.subject)) {
					// Assume onboarded
					onboarded = true;
				} else {
					try {
						const { users } = await context.client.get<{ users: User[] }>(
							'v1/user',
							session.get('api_key')!,
						);

						if (users.length === 0) {
							onboarded = false;
						}

						const user = users.find((u) => {
							if (u.provider !== 'oidc') {
								return false;
							}

							// For some reason, headscale makes providerID a url where the
							// last component is the subject, so we need to strip that out
							const subject = u.providerId?.split('/').pop();
							if (!subject) {
								return false;
							}

							const sessionUser = session.get('user');
							if (!sessionUser) {
								return false;
							}

							if (context.sessions.onboardForSubject(sessionUser.subject)) {
								// Assume onboarded
								return true;
							}

							return subject === sessionUser.subject;
						});

						if (user) {
							onboarded = true;
						}
					} catch (e) {
						// If we cannot lookup users, just assume our user is onboarded
						log.debug('api', 'Failed to lookup users %o', e);
						onboarded = true;
					}
				}
			}

			if (!onboarded) {
				return redirect('/onboarding');
			}
		}

		const check = await context.sessions.check(request, Capabilities.ui_access);
		return {
			config: context.hs.c,
			url: context.config.headscale.public_url ?? context.config.headscale.url,
			configAvailable: context.hs.readable(),
			debug: context.config.debug,
			user: session.get('user'),
			uiAccess: check,
			access: {
				ui: await context.sessions.check(request, Capabilities.ui_access),
				dns: await context.sessions.check(request, Capabilities.read_network),
				users: await context.sessions.check(request, Capabilities.read_users),
				policy: await context.sessions.check(request, Capabilities.read_policy),
				machines: await context.sessions.check(
					request,
					Capabilities.read_machines,
				),
				settings: await context.sessions.check(
					request,
					Capabilities.read_feature,
				),
			},
			onboarding: request.url.endsWith('/onboarding'),
			healthy: await context.client.healthcheck(),
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
			{/* Always show the outlet if we are onboarding */}
			{(data.onboarding ? true : data.uiAccess) ? (
				<Outlet />
			) : (
				<Card className="mx-auto w-fit mt-24">
					<div className="flex items-center justify-between">
						<Card.Title className="text-3xl mb-0">Connected</Card.Title>
						<CircleCheckIcon className="w-10 h-10" />
					</div>
					<Card.Text className="my-4 text-lg">
						Connect to Tailscale with your devices to access this Tailnet. Use
						this command to help you get started:
					</Card.Text>
					<Button
						className="flex text-md font-mono"
						onPress={async () => {
							await navigator.clipboard.writeText(
								`tailscale up --login-server=${data.url}`,
							);

							toast('Copied to clipboard');
						}}
					>
						tailscale up --login-server={data.url}
					</Button>
					<p className="text-xs mt-1 opacity-50 text-center">
						Click this button to copy the command.
					</p>
					<p className="mt-4 text-sm opacity-50">
						Your account does not have access to the UI. Please contact your
						administrator if you believe this is a mistake.
					</p>
				</Card>
			)}
			<Footer {...data} />
		</>
	);
}
