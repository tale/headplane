import type { HTMLProps } from 'react';
import { Heading as AriaHeading } from 'react-aria-components';
import { cn } from '~/utils/cn';

function Title(props: Parameters<typeof AriaHeading>[0]) {
	return (
		<AriaHeading
			{...props}
			slot="title"
			className={cn('text-lg font-semibold leading-6 mb-5', props.className)}
		/>
	);
}

function Text(props: React.HTMLProps<HTMLParagraphElement>) {
	return (
		<p {...props} className={cn('text-base leading-6 my-0', props.className)} />
	);
}

type Props = HTMLProps<HTMLDivElement> & {
	variant?: 'raised' | 'flat';
};

function Card(props: Props) {
	return (
		<div
			{...props}
			className={cn(
				'w-full max-w-md overflow-hidden rounded-xl p-4',
				props.variant === 'flat'
					? 'bg-transparent shadow-none'
					: 'bg-ui-50 dark:bg-ui-900 shadow-sm',
				'border border-ui-200 dark:border-ui-700',
				props.className,
			)}
		>
			{props.children}
		</div>
	);
}

export default Object.assign(Card, { Title, Text });
