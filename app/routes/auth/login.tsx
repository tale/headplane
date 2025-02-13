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
import type { Key } from '~/types';
import { pull } from '~/utils/headscale';
import { commitSession, getSession } from '~/utils/sessions.server';
import { hp_getConfig } from '~/utils/state';

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	if (session.has('hsApiKey')) {
		return redirect('/machines', {
			headers: {
				'Set-Cookie': await commitSession(session),
			},
		});
	}

	const context = hp_getConfig();

	// Only set if OIDC is properly enabled anyways
	if (context.oidc?.disable_api_key_login) {
		return redirect('/oidc/start');
	}

	return {
		oidc: context.oidc?.issuer,
		apiKey: !context.oidc?.disable_api_key_login,
	};
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const oidcStart = formData.get('oidc-start');
	const session = await getSession(request.headers.get('Cookie'));

	if (oidcStart) {
		const context = hp_getConfig();

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

	return (
		<div className="flex min-h-screen items-center justify-center">
			<Card className="max-w-sm m-4 sm:m-0" variant="raised">
				<Card.Title>Welcome to Headplane</Card.Title>
				{data.apiKey ? (
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
						{!data.apiKey ? (
							<Card.Text className="mb-6">
								Sign in with your authentication provider to continue. Your
								administrator has disabled API key login.
							</Card.Text>
						) : undefined}

						<input type="hidden" name="oidc-start" value="true" />
						<Button
							className="w-full mt-2"
							variant={data.apiKey ? 'light' : 'heavy'}
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
