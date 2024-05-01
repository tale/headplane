import { type Dispatch, type SetStateAction } from 'react'
import {
	Input,
	TextField as AriaTextField
} from 'react-aria-components'

import { cn } from '~/utils/cn'

type TextFieldProperties = Parameters<typeof AriaTextField>[0] & {
	readonly label: string;
	readonly placeholder: string;
	readonly state: [string, Dispatch<SetStateAction<string>>];
}

export default function TextField(properties: TextFieldProperties) {
	return (
		<AriaTextField
			{...properties}
			aria-label={properties.label}
			className='w-full'
		>
			<Input
				placeholder={properties.placeholder}
				value={properties.state[0]}
				name={properties.name}
				className={cn(
					'block px-2.5 py-1.5 w-full rounded-lg my-1',
					'border border-ui-200 dark:border-ui-600',
					'dark:bg-ui-800 dark:text-ui-300',
					properties.className
				)}
				onChange={event => {
					properties.state[1](event.target.value)
				}}
			/>
		</AriaTextField>
	)
}
