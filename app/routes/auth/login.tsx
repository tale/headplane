import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	redirect,
} from 'react-router';
import { Form, useActionData, useLoaderData } from 'react-router';
import { useMemo } from 'react';

import Button from '~/components/Button';
import Card from '~/components/Card';
import Code from '~/components/Code';
import TextField from '~/components/TextField';
import type { Key } from '~/types';
import { loadContext } from '~/utils/config/headplane';
import { pull } from '~/utils/headscale';
import { beginAuthFlow, getRedirectUri } from '~/utils/oidc';
import { commitSession, getSession } from '~/utils/sessions.server';

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	if (session.has('hsApiKey')) {
		return redirect('/machines', {
			headers: {
				'Set-Cookie': await commitSession(session),
			},
		});
	}

	const context = await loadContext();

	// Only set if OIDC is properly enabled anyways
	if (context.oidc?.disableKeyLogin) {
		return redirect('/oidc/start');
	}

	return {
		oidc: context.oidc?.issuer,
		apiKey: !context.oidc?.disableKeyLogin,
	};
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const oidcStart = formData.get('oidc-start');
	const session = await getSession(request.headers.get('Cookie'));

	if (oidcStart) {
		const context = await loadContext();

		if (!context.oidc) {
			throw new Error('An invalid OIDC configuration was provided');
		}

		return redirect('/oidc/start');
	}

	const apiKey = String(formData.get('api-key'));

	// Test the API key
	try {
		const apiKeys = await pull<{ apiKeys: Key[] }>('v1/apikey', apiKey);
		const key = apiKeys.apiKeys.find((k) => apiKey.startsWith(k.prefix));
		if (!key) {
			throw new Error('Invalid API key');
		}

		const expiry = new Date(key.expiration);
		const expiresIn = expiry.getTime() - Date.now();
		const expiresDays = Math.round(expiresIn / 1000 / 60 / 60 / 24);

		session.set('hsApiKey', apiKey);
		session.set('user', {
			subject: 'unknown-non-oauth',
			name: key.prefix,
			email: `${expiresDays.toString()} days`,
		});

		return redirect('/machines', {
			headers: {
				'Set-Cookie': await commitSession(session, {
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
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const showOr = useMemo(() => data.oidc && data.apiKey, [data]);

	return (
		<div className="flex min-h-screen items-center justify-center">
			<Card className="max-w-sm m-4 sm:m-0 rounded-2xl">
				<Card.Title>Welcome to Headplane</Card.Title>
				{data.apiKey ? (
					<Form method="post">
						<Card.Text className="mb-8 text-sm">
							Enter an API key to authenticate with Headplane. You can generate
							one by running <Code>headscale apikeys create</Code> in your
							terminal.
						</Card.Text>

						{actionData?.error ? (
							<p className="text-red-500 text-sm mb-2">{actionData.error}</p>
						) : undefined}
						<TextField
							isRequired
							label="API Key"
							name="api-key"
							placeholder="API Key"
							type="password"
						/>
						<Button className="w-full mt-2.5" variant="heavy" type="submit">
							Login
						</Button>
					</Form>
				) : undefined}
				{showOr ? (
					<div className="flex items-center gap-x-1.5 py-1">
						<hr className="flex-1 border-ui-300 dark:border-ui-800" />
						<span className="text-gray-500 text-sm">or</span>
						<hr className="flex-1 border-ui-300 dark:border-ui-800" />
					</div>
				) : undefined}
				{data.oidc ? (
					<Form method="POST">
						<input type="hidden" name="oidc-start" value="true" />
						<Button className="w-full" variant="heavy" type="submit">
							Login with SSO
						</Button>
					</Form>
				) : undefined}
			</Card>
		</div>
	);
}
