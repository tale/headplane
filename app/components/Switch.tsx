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
					'flex h-[26px] w-[44px] p-[4px] shrink-0',
					'rounded-full outline-none group-focus-visible:ring-2',
					'bg-main-600/50 dark:bg-main-600/20 group-selected:bg-main-700',
					properties.isDisabled && 'opacity-50 cursor-not-allowed',
					properties.className
				)}
			>
				<span className={cn(
					'h-[18px] w-[18px] transform rounded-full',
					'bg-white transition duration-100 ease-in-out',
					'translate-x-0 group-selected:translate-x-[100%]'
				)}
				/>
			</div>
		</AriaSwitch>
	)
}
