import { AlertCircle } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import ResponseError from '~/server/headscale/api/response-error';
import cn from '~/utils/cn';
import Card from './Card';
import Code from './Code';

interface Props {
	type?: 'full' | 'embedded';
}

export function getErrorMessage(error: Error | unknown): {
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
		throw new Error('Unhandled AggregateError');
	}

	return {
		title: 'Error',
		message: rootError.message,
	};
}

export function ErrorPopup({ type = 'full' }: Props) {
	const error = useRouteError();
	const routing = isRouteErrorResponse(error);
	const { title, message } = getErrorMessage(error);

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
				<div className="flex items-center gap-4">
					<AlertCircle className="w-8 h-8 text-red-500" />
					<div className="flex justify-between items-center gap-2 w-full">
						<Card.Title className="text-3xl mb-0">{title}</Card.Title>
						{routing && <Code className="text-2xl">{`${error.status}`}</Code>}
					</div>
				</div>
				<hr className="my-4 text-headplane-100 dark:text-headplane-800" />
				<Card.Text
					className={cn('py-4 text-lg', routing ? 'font-normal' : 'font-mono')}
				>
					{routing ? error.data : message}
				</Card.Text>
			</Card>
		</div>
	);
}
