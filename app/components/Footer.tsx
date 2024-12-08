import { cn } from '~/utils/cn'
import Link from '~/components/Link'

interface FooterProps {
	url: string
	debug: boolean
}

export default function Footer({ url, debug, integration }: FooterProps) {
	return (
		<footer className={cn(
			'fixed bottom-0 left-0 z-50 w-full h-14',
			'bg-ui-100 dark:bg-ui-900 text-ui-500',
			'flex flex-col justify-center gap-1',
			'border-t border-ui-200 dark:border-ui-800',
		)}>
			<p className="container text-xs">
				Headplane is entirely free to use.
				{' '}
				If you find it useful, consider
				{' '}
				<Link
					to="https://github.com/sponsors/tale"
					name="Aarnav's GitHub Sponsors"
				>
					donating
				</Link>
				{' '}
				to support development.
				{' '}
			</p>
			<p className="container text-xs opacity-75">
				Version: {__VERSION__}
				{' | '}
				Connecting to
				{' '}
				<strong>{url}</strong>
				{' '}
				{debug && '(Debug mode enabled)'}
			</p>
		</footer>
	)
}

