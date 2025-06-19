import { Check, Copy } from 'lucide-react';
import { HTMLProps } from 'react';
import cn from '~/utils/cn';
import toast from '~/utils/toast';

export interface CodeProps extends HTMLProps<HTMLSpanElement> {
	isCopyable?: boolean;
	children: string | string[];
}

export default function Code({ isCopyable, children, className }: CodeProps) {
	return (
		<code
			className={cn(
				'bg-headplane-100 dark:bg-headplane-800 px-1 py-0.5 font-mono',
				'rounded-lg focus-within:outline-hidden focus-within:ring-2',
				isCopyable && 'relative pr-7',
				className,
			)}
		>
			{children}
			{isCopyable && (
				<button
					type="button"
					className="bottom-0 right-0 absolute"
					onClick={async (event) => {
						const text = Array.isArray(children) ? children.join('') : children;

						const svgs = event.currentTarget.querySelectorAll('svg');
						for (const svg of svgs) {
							svg.toggleAttribute('data-copied', true);
						}

						await navigator.clipboard.writeText(text);
						toast('Copied to clipboard');

						setTimeout(() => {
							for (const svg of svgs) {
								svg.toggleAttribute('data-copied', false);
							}
						}, 1000);
					}}
				>
					<Check className="h-4.5 w-4.5 p-1 hidden data-copied:block" />
					<Copy className="h-4.5 w-4.5 p-1 block data-copied:hidden" />
				</button>
			)}
		</code>
	);
}
