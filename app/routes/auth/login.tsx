import { useEffect } from 'react';
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	redirect,
	useSearchParams,
} from 'react-router';
import { Form, useActionData, useLoaderData } from 'react-router';
import Button from '~/components/Button';
import Card from '~/components/Card';
import Code from '~/components/Code';
import Input from '~/components/Input';
import type { LoadContext } from '~/server';
import type { Key } from '~/types';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const qp = new URL(request.url).searchParams;
	const state = qp.get('s');

	try {
		const session = await context.sessions.auth(request);
		if (session.has('api_key')) {
			return redirect('/machines');
		}
	} catch {}

	const disableApiKeyLogin = context.config.oidc?.disable_api_key_login;
	if (context.oidc && disableApiKeyLogin) {
		// Prevents automatic redirect loop if OIDC is enabled and API key login is disabled
		// Since logging out would just log back in based on the redirects

		if (state !== 'logout') {
			return redirect('/oidc/start');
		}
	}

	return {
		oidc: context.oidc,
		disableApiKeyLogin,
		state,
	};
}

export async function action({
	request,
	context,
}: ActionFunctionArgs<LoadContext>) {
	const formData = await request.formData();
	const oidcStart = formData.get('oidc-start');
	const session = await context.sessions.getOrCreate(request);

	if (oidcStart) {
		if (!context.oidc) {
			throw new Error('OIDC is not enabled');
		}

		return redirect('/oidc/start');
	}

	const apiKey = String(formData.get('api-key'));

	// Test the API key
	try {
		const apiKeys = await context.client.get<{ apiKeys: Key[] }>(
			'v1/apikey',
			apiKey,
		);

		const key = apiKeys.apiKeys.find((k) => apiKey.startsWith(k.prefix));
		if (!key) {
			return {
				error: 'Invalid API key',
			};
		}

		const expiry = new Date(key.expiration);
		const expiresIn = expiry.getTime() - Date.now();
		const expiresDays = Math.round(expiresIn / 1000 / 60 / 60 / 24);

		session.set('state', 'auth');
		session.set('api_key', apiKey);
		session.set('user', {
			subject: 'unknown-non-oauth',
			name: key.prefix,
			email: `${expiresDays.toString()} days`,
		});

		return redirect('/machines', {
			headers: {
				'Set-Cookie': await context.sessions.commit(session, {
					maxAge: expiresIn,
				}),
			},
		});
	} catch {
		return {
			error: 'Invalid API key',
		};
	}
}

export default function Page() {
	const { state, disableApiKeyLogin, oidc } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const [params] = useSearchParams();

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
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Card className="max-w-sm m-4 sm:m-0" variant="raised">
					<Card.Title>You have been logged out</Card.Title>
					<Card.Text>
						You can now close this window. If you would like to log in again,
						please refresh the page.
					</Card.Text>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<Card className="max-w-sm m-4 sm:m-0" variant="raised">
				<Card.Title>Welcome to Headplane</Card.Title>
				{!disableApiKeyLogin ? (
					<Form method="post">
						<Card.Text>
							Enter an API key to authenticate with Headplane. You can generate
							one by running <Code>headscale apikeys create</Code> in your
							terminal.
						</Card.Text>

						{actionData?.error ? (
							<p className="text-red-500 text-sm mb-2">{actionData.error}</p>
						) : undefined}
						<Input
							isRequired
							labelHidden
							label="API Key"
							name="api-key"
							placeholder="API Key"
							type="password"
							className="mt-4 mb-2"
						/>
						<Button className="w-full" variant="heavy" type="submit">
							Sign In
						</Button>
					</Form>
				) : undefined}
				{oidc ? (
					<Form method="POST">
						<input type="hidden" name="oidc-start" value="true" />
						<Button
							className="w-full mt-2"
							variant={disableApiKeyLogin ? 'heavy' : 'light'}
							type="submit"
						>
							Single Sign-On
						</Button>
					</Form>
				) : undefined}
			</Card>
		</div>
	);
}
