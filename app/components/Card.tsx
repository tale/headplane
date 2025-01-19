import React from 'react';
import Title from '~/components/Title';
import { cn } from '~/utils/cn';

function Text(props: React.HTMLProps<HTMLParagraphElement>) {
	return (
		<p {...props} className={cn('text-base leading-6 my-0', props.className)} />
	);
}

type Props = React.HTMLProps<HTMLDivElement> & {
	variant?: 'raised' | 'flat';
};

interface Props extends React.HTMLProps<HTMLDivElement> {
	variant?: 'raised' | 'flat';
}

function Card({ variant = 'raised', ...props }: Props) {
	return (
		<div
			{...props}
			className={cn(
				'w-full max-w-md overflow-hidden rounded-3xl p-5',
				variant === 'flat'
					? 'bg-transparent shadow-none'
					: 'bg-headplane-50/50 dark:bg-headplane-950/50 shadow-sm',
				'border border-headplane-100 dark:border-headplane-800',
				props.className,
			)}
		>
			{props.children}
		</div>
	);
}

export default Object.assign(Card, { Title, Text });
