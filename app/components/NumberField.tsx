import { PlusIcon, DashIcon } from '@primer/octicons-react'
import { Dispatch, SetStateAction } from 'react'
import {
	Button,
	Group,
	Input,
	NumberField as AriaNumberField
} from 'react-aria-components'

import { cn } from '~/utils/cn'

type NumberFieldProps = Parameters<typeof AriaNumberField>[0] & {
	label: string;
	state?: [number, Dispatch<SetStateAction<number>>];
}

export default function NumberField(props: NumberFieldProps) {
	return (
		<AriaNumberField
			{...props}
			aria-label={props.label}
			className="w-full"
			value={props.state?.[0]}
			onChange={value => {
				props.state?.[1](value)
			}}
		>
			<Group className={cn(
				'flex px-2.5 py-1.5 w-full rounded-lg my-1',
				'border border-ui-200 dark:border-ui-600',
				'dark:bg-ui-800 dark:text-ui-300 gap-2',
				'focus-within:ring-2 focus-within:ring-blue-600',
				props.className
			)}>
				<Input
					className="w-full bg-transparent focus:outline-none"
					name={props.name}
				/>
				<Button slot="decrement">
					<DashIcon className="w-4 h-4" />
				</Button>
				<Button slot="increment">
					<PlusIcon className="w-4 h-4" />
				</Button>
			</Group>
		</AriaNumberField>
	)
}
