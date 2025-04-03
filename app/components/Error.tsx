import { AlertIcon } from '@primer/octicons-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import ResponseError from '~/server/headscale/api-error';
import cn from '~/utils/cn';
import Card from './Card';

interface Props {
	type?: 'full' | 'embedded';
}

function getMessage(error: Error | unknown): {
	title: string;
	message: string;
} {
	if (error instanceof ResponseError) {
		if (error.responseObject?.message) {
			return {
				title: 'Headscale Error',
				message: String(error.responseObject.message),
			};
		}

		return {
			title: 'Headscale Error',
			message: error.response,
		};
	}

	if (!(error instanceof Error)) {
		return {
			title: 'Unknown Error',
			message: String(error),
		};
	}

	let rootError = error;

	// Traverse the error chain to find the root cause
	if (error.cause) {
		rootError = error.cause as Error;
		while (rootError.cause) {
			rootError = rootError.cause as Error;
		}
	}

	// If we are aggregate, concat into a single message
	if (rootError instanceof AggregateError) {
		return {
			title: 'Errors',
			message: rootError.errors.map((error) => error.message).join('\n'),
		};
	}

	return {
		title: 'Error',
		message: rootError.message,
	};
}

export function ErrorPopup({ type = 'full' }: Props) {
	const error = useRouteError();
	const routing = isRouteErrorResponse(error);
	const { title, message } = getMessage(error);

	return (
		<div
			className={cn(
				'flex items-center justify-center',
				type === 'embedded'
					? 'pointer-events-none mt-24'
					: 'fixed inset-0 h-screen w-screen z-50',
			)}
		>
			<Card>
				<div className="flex items-center justify-between">
					<Card.Title className="text-3xl mb-0">
						{routing ? error.status : title}
					</Card.Title>
					<AlertIcon className="w-12 h-12 text-red-500" />
				</div>
				<Card.Text
					className={cn('mt-4 text-lg', routing ? 'font-normal' : 'font-mono')}
				>
					{routing ? error.data.message : message}
				</Card.Text>
			</Card>
		</div>
	);
}
