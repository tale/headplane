import { eq } from 'drizzle-orm';
import { CircleCheckIcon } from 'lucide-react';
import { Outlet, redirect } from 'react-router';
import Button from '~/components/Button';
import Card from '~/components/Card';
import Footer from '~/components/Footer';
import Header from '~/components/Header';
import { users } from '~/server/db/schema';
import { Capabilities } from '~/server/web/roles';
import toast from '~/utils/toast';
import { Route } from './+types/shell';

// This loads the bare minimum for the application to function
// So we know that if context fails to load then well, oops?
export async function loader({ request, context }: Route.LoaderArgs) {
	try {
		const session = await context.sessions.auth(request);
		if (
			context.oidc &&
			session.user.subject !== 'unknown-non-oauth' &&
			!request.url.endsWith('/onboarding')
		) {
			const [user] = await context.db
				.select()
				.from(users)
				.where(eq(users.sub, session.user.subject))
				.limit(1);

			if (!user?.onboarded) {
				return redirect('/onboarding');
			}
		}

		const api = context.hsApi.getRuntimeClient(session.api_key);
		const check = await context.sessions.check(request, Capabilities.ui_access);
		return {
			config: context.hs.c,
			url: context.config.headscale.public_url ?? context.config.headscale.url,
			configAvailable: context.hs.readable(),
			debug: context.config.debug,
			user: session.user,
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
			healthy: await api.isHealthy(),
		};
	} catch {
		return redirect('/login', {
			headers: {
				'Set-Cookie': await context.sessions.destroySession(),
			},
		});
	}
}

export default function Shell({ loaderData }: Route.ComponentProps) {
	return (
		<>
			<Header {...loaderData} />
			{/* Always show the outlet if we are onboarding */}
			{(loaderData.onboarding ? true : loaderData.uiAccess) ? (
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
								`tailscale up --login-server=${loaderData.url}`,
							);

							toast('Copied to clipboard');
						}}
					>
						tailscale up --login-server={loaderData.url}
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
			<Footer {...loaderData} />
		</>
	);
}
