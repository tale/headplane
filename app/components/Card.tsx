import React from 'react';
import Text from '~/components/Text';
import Title from '~/components/Title';
import cn from '~/utils/cn';

interface Props extends React.HTMLProps<HTMLDivElement> {
	variant?: 'raised' | 'flat';
}

function Card({ variant = 'raised', ...props }: Props) {
	return (
		<div
			{...props}
			className={cn(
				'w-full max-w-md rounded-3xl p-5',
				variant === 'flat'
					? 'bg-transparent shadow-none'
					: 'bg-headplane-50/50 dark:bg-headplane-950/50 shadow-xs',
				'border border-headplane-100 dark:border-headplane-800',
				props.className,
			)}
		>
			{props.children}
		</div>
	);
}

export default Object.assign(Card, { Title, Text });
