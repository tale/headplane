import { AlertCircle } from 'lucide-react';
import { isRouteErrorResponse } from 'react-router';
import {
	isApiError,
	isConnectionError,
} from '~/server/headscale/api/error-client';
import cn from '~/utils/cn';
import Card from './Card';
import Code from './Code';
import Link from './Link';

export function getErrorMessage(error: Error | unknown): {
	title: string;
	jsxMessage: React.ReactNode;
} {
	if (isRouteErrorResponse(error)) {
		if (isApiError(error.data)) {
			const { statusCode, rawData, data, requestUrl } = error.data;
			if (statusCode >= 500) {
				return {
					title: 'Cannot connect to Headscale API',
					jsxMessage: (
						<Card.Text>
							There was an error communicating with the Headscale API.
							<br />
							The server responded with a status code of{' '}
							<strong>{statusCode}</strong>, indicating a server-side issue.
							Please check the Headscale server status and try again later.
						</Card.Text>
					),
				};
			}

			const authError =
				error.data.statusCode === 401 || error.data.statusCode === 403;

			return {
				title: 'Invalid response from Headscale API',
				jsxMessage: (
					<>
						<Card.Text className="leading-snug">
							The Headscale API returned an unexpected response.
							{authError ? (
								<>
									{' '}
									The status code indicates an authentication error. Please
									verify your API key and Headplane configuration.
								</>
							) : (
								<>
									{' '}
									You may be using an unsupported version of Headscale or this
									may be a bug.
								</>
							)}
						</Card.Text>
						<ul className="list-disc list-inside mt-2">
							<li>
								Request URL: <Code>{requestUrl}</Code>
							</li>
							<li>
								Status Code:{' '}
								<Code>
									{/* @ts-expect-error */}
									{data === null ? (
										<>
											{statusCode} {rawData}
										</>
									) : (
										<>
											{statusCode} {error.statusText}
										</>
									)}
								</Code>
							</li>
						</ul>
						<Card.Text className="text-lg font-semibold mt-4">
							Error Details
						</Card.Text>
						<pre className="mt-2 p-2 bg-headplane-100 dark:bg-headplane-800 rounded-lg overflow-x-auto">
							<code>{JSON.stringify(error.data, null, 2)}</code>
						</pre>
					</>
				),
			};
		}

		if (isConnectionError(error.data)) {
			const { requestUrl, errorCode, errorMessage, extraData } = error.data;
			return {
				title: 'Cannot connect to Headscale API',
				jsxMessage: (
					<>
						<Card.Text className="leading-snug">
							Headplane was unable to reach the Headscale API. Please check your
							network setup and configuration to ensure Headplane is able to
							connect.
						</Card.Text>
						<Card.Text className="text-lg font-semibold mt-4">
							Error Details
						</Card.Text>
						<pre className="mt-2 p-2 bg-headplane-100 dark:bg-headplane-800 rounded-lg overflow-x-auto">
							{requestUrl}
							<br />
							{errorCode}: {errorMessage}
							{extraData != null && (
								<>
									<br />
									<br />
									<code>{JSON.stringify(extraData, null, 2)}</code>
								</>
							)}
						</pre>
					</>
				),
			};
		}

		return {
			title: `Error ${error.status}`,
			jsxMessage: (
				<>
					There was an error processing your request.
					<br />
					Status Code: <strong>{error.status}</strong>
					<br />
					Status Text: <strong>{error.statusText}</strong>
				</>
			),
		};
	}

	if (!(error instanceof Error)) {
		return {
			title: 'Unexpected Error',
			jsxMessage: (
				<>
					<Card.Text>
						An unexpected error occurred which is most likely a bug. Please
						consider reporting filing an issue on the{' '}
						<Link
							name="Headplane GitHub"
							to="https://github.com/tale/headplane/issues"
						>
							Headplane GitHub
						</Link>{' '}
						repository with the details below.
					</Card.Text>
					<Card.Text className="text-lg font-semibold mt-4">
						Error Details
					</Card.Text>
					<pre className="mt-2 p-2 bg-headplane-100 dark:bg-headplane-800 rounded-lg overflow-x-auto">
						<code>{JSON.stringify(error, null, 2)}</code>
					</pre>
				</>
			),
		};
	}

	// Traverse the error chain to find the root cause
	let rootError = error;
	console.log('error', error.cause != null);
	if (error.cause != null) {
		rootError = error.cause as Error;
		while (rootError.cause != null) {
			rootError = rootError.cause as Error;
			console.log('setting rootError', rootError.message);
		}
	}

	// TODO: If we are aggregate, concat into a single message
	if (rootError instanceof AggregateError) {
		throw new Error('AggregateError handling not implemented yet');
	}

	return {
		title:
			rootError.name.length > 0 && rootError.name !== 'Error'
				? `Error: ${rootError.name}`
				: 'Error',
		jsxMessage: rootError.message,
	};
}

interface ErrorBannerProps {
	error: unknown;
	className?: string;
}

export function ErrorBanner({ error, className }: ErrorBannerProps) {
	const { title, jsxMessage } = getErrorMessage(error);

	return (
		<Card className={cn('w-screen', className)} variant="flat">
			<div className="flex items-center justify-between gap-4">
				<Card.Title>{title}</Card.Title>
				<AlertCircle className="w-6 h-6 mb-2 text-red-500" />
			</div>
			{jsxMessage}
		</Card>
	);
}
