import { Dispatch, SetStateAction } from 'react';
import { Input, TextField as AriaTextField } from 'react-aria-components';
import { cn } from '~/utils/cn';

type TextFieldProps = Parameters<typeof AriaTextField>[0] & {
	readonly label: string;
	readonly placeholder: string;
	readonly state?: [string, Dispatch<SetStateAction<string>>];
};

export default function TextField(props: TextFieldProps) {
	return (
		<AriaTextField {...props} aria-label={props.label} className="w-full">
			<Input
				placeholder={props.placeholder}
				value={props.state?.[0]}
				name={props.name}
				className={cn(
					'block px-2.5 py-1.5 w-full rounded-lg my-1',
					'border border-ui-200 dark:border-ui-600',
					'dark:bg-ui-800 dark:text-ui-300',
					props.className,
				)}
				onChange={(event) => {
					props.state?.[1](event.target.value);
				}}
			/>
		</AriaTextField>
	);
}
