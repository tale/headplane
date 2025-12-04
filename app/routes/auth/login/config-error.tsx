import { AlertCircle } from 'lucide-react';
import Card from '~/components/Card';
import Code from '~/components/Code';
import Link from '~/components/Link';
import { OidcConnectorError } from '~/server/web/oidc-connector';

export function OidcConfigErrorNotice({
	errors,
}: {
	errors: OidcConnectorError[];
}) {
	return (
		<Card className="max-w-md m-4 sm:m-0 mb-4 sm:mb-4 border border-red-500">
			<div className="flex items-center justify-between gap-4">
				<Card.Title className="text-red-500">Authentication Error</Card.Title>
				<AlertCircle className="w-6 h-6 mb-2 text-red-500" />
			</div>
			<Card.Text className="text-sm">
				The OpenID Connect (OIDC) Single Sign-On (SSO) configuration has issues:{' '}
				<ul className="list-disc list-inside mt-2 mb-1">
					{mapOidcErrorsToMessages(errors).map((code) => (
						<li key={code.key}>{code.node}</li>
					))}
				</ul>{' '}
				<Link
					name="Headplane OIDC Issues"
					to="https://headplane.net/configuration/sso#help"
				>
					Learn more
				</Link>
			</Card.Text>
		</Card>
	);
}

function mapOidcErrorsToMessages(errors: OidcConnectorError[]) {
	const messages: {
		key: string;
		node: React.ReactNode;
	}[] = [];

	for (const error of errors) {
		switch (error) {
			case 'INVALID_API_KEY':
				messages.push({
					key: error,
					node: (
						<Card.Text className="inline">
							The provided API key for OIDC authentication is invalid. Ensure
							that <Code>oidc.headscale_api_key</Code> is a valid API key.
						</Card.Text>
					),
				});
				break;

			case 'MISSING_AUTHORIZATION_ENDPOINT':
				messages.push({
					key: error,
					node: (
						<Card.Text className="inline">
							The OIDC provided does not have a configured{' '}
							<Code>authorization_endpoint</Code>. Ensure discovery URL or
							manual configuration is correct.
						</Card.Text>
					),
				});
				break;

			case 'MISSING_TOKEN_ENDPOINT':
				messages.push({
					key: error,
					node: (
						<Card.Text className="inline">
							The OIDC provided does not have a configured{' '}
							<Code>token_endpoint</Code>. Ensure discovery URL or manual
							configuration is correct.
						</Card.Text>
					),
				});
				break;

			case 'MISSING_USERINFO_ENDPOINT':
				messages.push({
					key: error,
					node: (
						<Card.Text className="inline">
							The OIDC provided does not have a configured{' '}
							<Code>user_endpoint</Code>. Ensure discovery URL or manual
							configuration is correct.
						</Card.Text>
					),
				});
				break;

			case 'MISSING_REQUIRED_CLAIMS':
				messages.push({
					key: error,
					node: (
						<Card.Text className="inline">
							The OIDC provider does not support the <Code>sub</Code> claim,
							which is required for authentication. Your OIDC provider may be
							misconfigured.
						</Card.Text>
					),
				});
				break;

			case 'UNKNOWN_ERROR':
				messages.push({
					key: error,
					node: (
						<Card.Text className="inline">
							An unknown error occurred during OIDC configuration. Please check
							the Headplane logs for more information.
						</Card.Text>
					),
				});
				break;
		}
	}

	return messages;
}
