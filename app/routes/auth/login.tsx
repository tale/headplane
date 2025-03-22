import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	redirect,
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
	try {
		const session = await context.sessions.auth(request);
		if (session.has('api_key')) {
			return redirect('/machines');
		}
	} catch {}

	const disableApiKeyLogin = context.config.oidc?.disable_api_key_login;
	if (context.oidc && disableApiKeyLogin) {
		return redirect('/oidc/start');
	}

	return {
		oidc: context.oidc,
		disableApiKeyLogin,
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
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();

	return (
		<div className="flex min-h-screen items-center justify-center">
			<Card className="max-w-sm m-4 sm:m-0" variant="raised">
				<Card.Title>Welcome to Headplane</Card.Title>
				{!data.disableApiKeyLogin ? (
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
				{data.oidc ? (
					<Form method="POST">
						{data.disableApiKeyLogin ? (
							<Card.Text className="mb-6">
								Sign in with your authentication provider to continue. Your
								administrator has disabled API key login.
							</Card.Text>
						) : undefined}

						<input type="hidden" name="oidc-start" value="true" />
						<Button
							className="w-full mt-2"
							variant={data.disableApiKeyLogin ? 'heavy' : 'light'}
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
