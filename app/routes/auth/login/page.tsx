import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
	data,
	Form,
	Link as RemixLink,
	redirect,
	useSearchParams,
} from 'react-router';
import Button from '~/components/Button';
import Card from '~/components/Card';
import Code from '~/components/Code';
import Input from '~/components/Input';
import Link from '~/components/Link';
import { useLiveData } from '~/utils/live-data';
import type { Route } from './+types/page';
import { loginAction } from './action';
import Logout from './logout';

export async function loader({ request, context }: Route.LoaderArgs) {
	try {
		await context.sessions.auth(request);
		return redirect('/machines');
	} catch {}

	const qp = new URL(request.url).searchParams;
	const urlState = qp.get('s') ?? undefined;

	// OIDC config cannot be undefined if an OIDC client is set
	// Also check if we are in a logout state and skip redirect if we are
	const ssoOnly = context.config.oidc?.disable_api_key_login;
	if (urlState !== 'logout' && ssoOnly) {
		// This shouldn't be possible, but still a safe sanity check
		if (!context.oidc) {
			throw data(
				'`oidc.disable_api_key_login` was set without a valid OIDC configuration',
				{
					status: 400,
				},
			);
		}

		return redirect('/oidc/start');
	}

	return {
		isOidcEnabled: context.oidc !== undefined,
		isCookieSecureEnabled: context.config.server.cookie_secure,
		urlState,
	};
}

export async function action(request: Route.ActionArgs) {
	return loginAction(request);
}

export default function Page({ loaderData, actionData }: Route.ComponentProps) {
	const { isOidcEnabled, isCookieSecureEnabled, urlState } = loaderData;
	const [showCookieWarning, setShowCookieWarning] = useState(false);
	const [params] = useSearchParams();
	const { pause } = useLiveData();

	useEffect(() => {
		// This page does NOT need stale while revalidate logic
		pause();

		if (isCookieSecureEnabled && window.location.protocol !== 'https:') {
			setShowCookieWarning(true);
		}
	});

	useEffect(() => {
		// State is a one time thing, we need to remove it after it has
		// been consumed to prevent logic loops.
		if (urlState !== null) {
			const searchParams = new URLSearchParams(params);
			searchParams.delete('s');

			// Replacing because it's not a navigation, just a cleanup of the URL
			// We can't use the useSearchParams method since it revalidates
			// which will trigger a full reload
			const newUrl = searchParams.toString()
				? `{${window.location.pathname}?${searchParams.toString()}`
				: window.location.pathname;

			window.history.replaceState(null, '', newUrl);
		}
	}, [urlState, params]);

	if (urlState === 'logout') {
		return <Logout />;
	}

	return (
		<div className="flex w-screen h-screen items-center justify-center">
			<div>
				{showCookieWarning ? (
					<Card className="max-w-md m-4 sm:m-0 mb-4 sm:mb-4 border border-red-500">
						<div className="flex items-center justify-between gap-4">
							<Card.Title className="text-red-500">
								Configuration Issue
							</Card.Title>
							<AlertCircle className="w-6 h-6 mb-2 text-red-500" />
						</div>
						<Card.Text className="text-sm text-red-600 dark:text-red-400">
							Headplane is configured to use secure cookies, but this site is
							being served over an insecure connection and login will not work
							correctly.{' '}
							<Link
								name="Headplane Common Issues"
								to="https://headplane.net/configuration/common-issues#issue-logging-in-does-not-do-anything"
							>
								Learn more.
							</Link>
						</Card.Text>
					</Card>
				) : undefined}
				<Card className="max-w-md m-4 sm:m-0">
					<Card.Title>Welcome to Headplane</Card.Title>
					<Form method="POST">
						<Card.Text>
							Enter an API key to authenticate with Headplane. You can generate
							one by running <Code>headscale apikeys create</Code> in your
							terminal.
						</Card.Text>
						<Input
							className="mt-8 mb-2"
							isRequired
							label="API Key"
							labelHidden
							name="api_key"
							placeholder="API Key"
							type="password"
						/>
						{actionData?.success === false ? (
							<Card.Text className="text-sm mb-2 text-red-600 dark:text-red-300">
								{actionData.message}
							</Card.Text>
						) : undefined}
						<Button className="w-full" type="submit" variant="heavy">
							Sign In
						</Button>
					</Form>
					{isOidcEnabled ? (
						<RemixLink to="/oidc/start">
							<Button className="w-full mt-2" variant="light">
								Single Sign-On
							</Button>
						</RemixLink>
					) : undefined}
				</Card>
			</div>
		</div>
	);
}
