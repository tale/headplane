import { AlertIcon } from '@primer/octicons-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { cn } from '~/utils/cn';
import Card from './Card';
import Code from './Code';

interface Props {
	type?: 'full' | 'embedded';
}

export function ErrorPopup({ type = 'full' }: Props) {
	const error = useRouteError();
	const routing = isRouteErrorResponse(error);
	const message =
		error instanceof Error ? error.message : 'An unexpected error occurred';

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
						{routing ? error.status : 'Error'}
					</Card.Title>
					<AlertIcon className="w-12 h-12 text-red-500" />
				</div>
				<Card.Text className="mt-4 text-lg">
					{routing ? error.statusText : <Code>{message}</Code>}
				</Card.Text>
			</Card>
		</div>
	);
}
