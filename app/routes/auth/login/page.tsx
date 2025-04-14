import { useEffect } from 'react';
import {
	ActionFunctionArgs,
	Form,
	LoaderFunctionArgs,
	Link as RemixLink,
	data,
	redirect,
	useActionData,
	useLoaderData,
	useSearchParams,
} from 'react-router';
import Button from '~/components/Button';
import Card from '~/components/Card';
import Code from '~/components/Code';
import Input from '~/components/Input';
import type { LoadContext } from '~/server';
import { useLiveData } from '~/utils/live-data';
import { loginAction } from './action';
import Logout from './logout';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	try {
		const session = await context.sessions.auth(request);
		if (session.has('api_key')) {
			return redirect('/machines');
		}
	} catch {}

	const qp = new URL(request.url).searchParams;
	const state = qp.get('s') ?? undefined;

	// OIDC config cannot be undefined if an OIDC client is set
	// Also check if we are in a logout state and skip redirect if we are
	const ssoOnly = context.config.oidc?.disable_api_key_login;
	if (state !== 'logout' && ssoOnly) {
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
		oidc: context.oidc,
		state,
	};
}

export async function action(request: ActionFunctionArgs<LoadContext>) {
	return loginAction(request);
}

export default function Page() {
	const { state, oidc } = useLoaderData<typeof loader>();
	const formData = useActionData<typeof action>();
	const [params] = useSearchParams();
	const { pause } = useLiveData();

	useEffect(() => {
		// This page does NOT need stale while revalidate logic
		pause();
	});

	useEffect(() => {
		// State is a one time thing, we need to remove it after it has
		// been consumed to prevent logic loops.
		if (state !== null) {
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
	}, [state, params]);

	if (state === 'logout') {
		return <Logout />;
	}

	return (
		<div className="flex w-screen h-screen items-center justify-center">
			<Card className="max-w-md m-4 sm:m-0">
				<Card.Title>Welcome to Headplane</Card.Title>
				<Form method="POST">
					<Card.Text>
						Enter an API key to authenticate with Headplane. You can generate
						one by running <Code>headscale apikeys create</Code> in your
						terminal.
					</Card.Text>
					<Input
						isRequired
						labelHidden
						label="API Key"
						name="api_key"
						placeholder="API Key"
						type="password"
						className="mt-8 mb-2"
					/>
					{formData?.success === false ? (
						<Card.Text className="text-sm mb-2 text-red-600 dark:text-red-300">
							{formData.message}
						</Card.Text>
					) : undefined}
					<Button className="w-full" variant="heavy" type="submit">
						Sign In
					</Button>
				</Form>
				{oidc ? (
					<RemixLink to="/oidc/start">
						<Button variant="light" className="w-full mt-2">
							Single Sign-On
						</Button>
					</RemixLink>
				) : undefined}
			</Card>
		</div>
	);
}
