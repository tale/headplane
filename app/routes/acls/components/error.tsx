import { AlertIcon } from '@primer/octicons-react';
import React from 'react';
import Card from '~/components/Card';

interface NoticeViewProps {
	title: string;
	children: React.ReactNode;
}

export function NoticeView({ children, title }: NoticeViewProps) {
	return (
		<Card variant="flat" className="max-w-2xl my-8">
			<div className="flex items-center justify-between">
				<Card.Title className="text-xl mb-0">{title}</Card.Title>
				<AlertIcon className="w-8 h-8 text-yellow-500" />
			</div>
			<Card.Text className="mt-4">{children}</Card.Text>
		</Card>
	);
}

interface ErrorViewProps {
	children: string;
}

export function ErrorView({ children }: ErrorViewProps) {
	const [title, ...rest] = children.split(':');
	const formattedMessage = rest.length > 0 ? rest.join(':').trim() : children;

	return (
		<Card variant="flat" className="max-w-2xl mb-4">
			<div className="flex items-center justify-between">
				<Card.Title className="text-xl mb-0">
					{title.trim() ?? 'Error'}
				</Card.Title>
				<AlertIcon className="w-8 h-8 text-red-500" />
			</div>
			<Card.Text className="mt-4">
				Could not apply changes to the ACL policy:
				<br />
				<span className="font-mono">{formattedMessage}</span>
			</Card.Text>
		</Card>
	);
}
