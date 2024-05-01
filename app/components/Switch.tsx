import { Switch as AriaSwitch } from 'react-aria-components'

import { cn } from '~/utils/cn'

type SwitchProperties = Parameters<typeof AriaSwitch>[0] & {
	readonly label: string;
}

export default function Switch(properties: SwitchProperties) {
	return (
		<AriaSwitch
			{...properties}
			aria-label={properties.label}
			className='group flex gap-2 items-center'
		>
			<div
				className={cn(
					'flex h-[26px] w-[44px] shrink-0 cursor-default',
					'rounded-full shadow-inner bg-clip-padding',
					'border border-solid border-white/30 p-[3px]',
					'box-border transition duration-100 ease-in-out',
					'outline-none group-focus-visible:ring-2 ring-black',

					'bg-main-700 dark:bg-main-800',
					'group-pressed:bg-main-800 dark:group-pressed:bg-main-900',
					'group-selected:bg-main-900 group-selected:group-pressed:bg-main-900',
					properties.isDisabled && 'opacity-50 cursor-not-allowed',
					properties.className
				)}
			>
				<span className={cn(
					'h-[18px] w-[18px] transform rounded-full',
					'bg-white shadow transition duration-100',
					'ease-in-out translate-x-0 group-selected:translate-x-[100%]'
				)}
				/>
			</div>
		</AriaSwitch>
	)
}
