import { CircleSlash2 } from 'lucide-react';
import React from 'react';
import Card from '~/components/Card';

export interface NoticeProps {
	children: React.ReactNode;
}

export default function Notice({ children }: NoticeProps) {
	return (
		<Card className="flex w-full max-w-full gap-4 font-semibold">
			<CircleSlash2 />
			{children}
		</Card>
	);
}
