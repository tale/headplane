import { CircleX } from 'lucide-react';
import Link from '~/components/Link';
import cn from '~/utils/cn';

interface FooterProps {
	url: string;
	debug: boolean;
	healthy: boolean;
}

export default function Footer({ url, debug, healthy }: FooterProps) {
	return (
		<footer
			className={cn(
				'fixed w-full bottom-0 left-0 z-40 h-12',
				'flex items-center justify-center',
				'bg-headplane-50 dark:bg-headplane-950',
				'dark:border-t dark:border-headplane-800',
			)}
		>
			<div
				className={cn(
					'grid grid-rows-1 items-center container mx-auto',
					!healthy && 'md:grid-cols-[1fr_auto] grid-cols-1',
				)}
			>
				<div
					className={cn('text-xs leading-none', !healthy && 'hidden md:block')}
				>
					<p>
						Headplane is free. Please consider{' '}
						<Link
							to="https://github.com/sponsors/tale"
							name="Aarnav's GitHub Sponsors"
						>
							donating
						</Link>{' '}
						to support development.{' '}
					</p>
					<p className="opacity-75">
						Version: {__VERSION__}
						{' — '}
						Connecting to{' '}
						<button
							type="button"
							tabIndex={0} // Allows keyboard focus
							className={cn(
								'blur-sm hover:blur-none focus:blur-none transition',
								'focus:outline-hidden focus:ring-2 rounded-xs',
							)}
						>
							{url}
						</button>
						{debug && ' (Debug mode enabled)'}
					</p>
				</div>
				{!healthy ? (
					<div
						className={cn(
							'flex gap-1.5 items-center p-2 rounded-xl text-sm',
							'bg-red-500 text-white font-semibold',
						)}
					>
						<CircleX size={16} strokeWidth={3} />
						<p className="text-nowrap">Headscale is unreachable</p>
					</div>
				) : undefined}
			</div>
		</footer>
	);
}
