import { ExternalLink } from 'lucide-react';
import cn from '~/utils/cn';

export interface LinkProps {
	to: string;
	name: string;
	children: string;
	className?: string;
}

export default function Link({
	to,
	name: alt,
	children,
	className,
}: LinkProps) {
	return (
		<a
			href={to}
			aria-label={alt}
			target="_blank"
			rel="noreferrer"
			className={cn(
				'inline-flex items-center gap-x-0.5',
				'text-blue-500 hover:text-blue-700',
				'dark:text-blue-400 dark:hover:text-blue-300',
				'focus:outline-hidden focus:ring-3 rounded-md',
				className,
			)}
		>
			{children}
			<ExternalLink className="w-3.5" />
		</a>
	);
}
