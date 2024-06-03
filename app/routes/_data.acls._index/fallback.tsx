import Spinner from '~/components/Spinner'
import { cn } from '~/utils/cn'

interface FallbackProps {
	readonly acl: string
}

export default function Fallback({ acl }: FallbackProps) {
	return (
		<div className="inline-block relative w-full h-editor">
			<Spinner className="w-4 h-4 absolute p-2" />
			<textarea
				readOnly
				className={cn(
					'w-full h-editor font-mono resize-none',
					'text-sm text-gray-600 dark:text-gray-300',
					'bg-ui-100 dark:bg-ui-800',
					'pl-16 pr-8 pt-0.5 leading-snug',
				)}
				value={acl}
			/>
		</div>
	)
}
