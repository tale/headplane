import React from 'react';
import { cn } from '~/utils/cn';

export interface TextProps {
	children: React.ReactNode;
	className?: string;
}

export default function Text({ children, className }: TextProps) {
	return (
		<p className={cn('text-md my-0', className)}>
			{children}
		</p>
	);
}
