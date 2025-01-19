import React from 'react';

export interface TitleProps {
	children: React.ReactNode;
}

export default function Title({ children }: TitleProps) {
	return (
		<h3 className="text-2xl font-bold mb-6">
			{children}
		</h3>
	);
}
