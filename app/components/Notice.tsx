import {
	CircleAlert,
	CircleSlash2,
	LucideProps,
	TriangleAlert,
} from 'lucide-react';
import React from 'react';
import Card from '~/components/Card';
import cn from '~/utils/cn';

export interface NoticeProps {
	children: React.ReactNode;
	title?: string;
	variant?: 'default' | 'error' | 'warning';
	icon?: React.ReactElement<LucideProps>;
	className?: string;
	fullWidth?: boolean;
}

export default function Notice({
	children,
	title,
	variant,
	icon,
	className,
	fullWidth,
}: NoticeProps) {
	return (
		<Card
			className={cn(
				'my-6',
				fullWidth ? 'w-full max-w-none' : 'max-w-2xl',
				className,
			)}
			variant="flat"
		>
			<div className="flex items-center justify-between">
				{title ? (
					<Card.Title className="text-xl mb-0">{title}</Card.Title>
				) : undefined}
				{!variant && icon ? icon : iconForVariant(variant)}
			</div>
			<Card.Text className="mt-4">{children}</Card.Text>
		</Card>
	);
}

function iconForVariant(variant?: 'default' | 'error' | 'warning') {
	switch (variant) {
		case 'error':
			return <TriangleAlert className="text-red-500" />;
		case 'warning':
			return <CircleAlert className="text-yellow-500" />;
		default:
			return <CircleSlash2 />;
	}
}
