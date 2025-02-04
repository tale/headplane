import React from 'react';
import cn from '~/utils/cn';

export interface TitleProps {
	children: React.ReactNode;
	className?: string;
}

export default function Title({ children, className }: TitleProps) {
	return (
		<h3 className={cn('text-2xl font-bold mb-2', className)}>{children}</h3>
	);
}
