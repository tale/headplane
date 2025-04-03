import cn from '~/utils/cn';

interface Props {
	readonly acl: string;
}

export default function Fallback({ acl }: Props) {
	return (
		<div className="relative w-full h-editor flex">
			<div
				className={cn(
					'h-full w-8 flex justify-center p-1',
					'border-r border-headscale-400 dark:border-headscale-800',
				)}
			>
				<div
					aria-hidden
					className={cn(
						'h-5 w-5 animate-spin rounded-full',
						'border-headplane-900 dark:border-headplane-100',
						'border-2 border-t-transparent dark:border-t-transparent',
					)}
				/>
			</div>
			<textarea
				readOnly
				className={cn(
					'w-full h-editor font-mono resize-none text-sm',
					'bg-headplane-50 dark:bg-headplane-950 opacity-60',
					'pl-1 pt-1 leading-snug',
				)}
				value={acl}
			/>
		</div>
	);
}
