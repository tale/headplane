import { AlertIcon } from '@primer/octicons-react';
import cn from '~/utils/cn';

import Card from '~/components/Card';
import Code from '~/components/Code';

interface Props {
	message: string;
}

export function ErrorView({ message }: Props) {
	return (
		<Card variant="flat" className="max-w-full mb-4">
			<div className="flex items-center justify-between">
				<Card.Title className="text-xl mb-0">Error</Card.Title>
				<AlertIcon className="w-8 h-8 text-red-500" />
			</div>
			<Card.Text className="mt-4">
				Could not apply changes to your ACL policy due to the following error:
				<br />
				<Code>{message}</Code>
			</Card.Text>
		</Card>
	);
}
