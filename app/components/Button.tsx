import type { Dispatch, SetStateAction } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { cn } from '~/utils/cn';

type Props = Parameters<typeof AriaButton>[0] & {
	readonly control?: [boolean, Dispatch<SetStateAction<boolean>>];
	readonly variant?: 'heavy' | 'light';
};

export default function Button(props: Props) {
	return (
		<AriaButton
			{...props}
			className={cn(
				'w-fit text-sm rounded-lg px-4 py-2',
				props.variant === 'heavy'
					? 'bg-main-700 dark:bg-main-800'
					: 'bg-main-200 dark:bg-main-700/30',
				props.variant === 'heavy'
					? 'hover:bg-main-800 dark:hover:bg-main-700'
					: 'hover:bg-main-300 dark:hover:bg-main-600/30',
				props.variant === 'heavy'
					? 'text-white'
					: 'text-ui-700 dark:text-ui-300',
				props.isDisabled && 'opacity-50 cursor-not-allowed',
				props.className,
			)}
			// If control is passed, set the state value
			onPress={
				props.control
					? () => {
							props.control?.[1](true);
						}
					: props.onPress
			}
		/>
	);
}
