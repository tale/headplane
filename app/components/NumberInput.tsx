import { Minus, Plus } from 'lucide-react';
import { useRef } from 'react';
import {
	type AriaNumberFieldProps,
	useId,
	useLocale,
	useNumberField,
} from 'react-aria';
import { useNumberFieldState } from 'react-stately';
import IconButton from '~/components/IconButton';
import cn from '~/utils/cn';

export interface InputProps extends AriaNumberFieldProps {
	isRequired?: boolean;
	name?: string;
}

export default function NumberInput(props: InputProps) {
	const { label, name } = props;
	const { locale } = useLocale();
	const state = useNumberFieldState({ ...props, locale });
	const ref = useRef<HTMLInputElement | null>(null);
	const id = useId(props.id);

	const {
		labelProps,
		inputProps,
		groupProps,
		incrementButtonProps,
		decrementButtonProps,
		descriptionProps,
		errorMessageProps,
		isInvalid,
		validationErrors,
	} = useNumberField(props, state, ref);

	return (
		<div className="flex flex-col">
			<label
				{...labelProps}
				htmlFor={id}
				className={cn(
					'text-xs font-medium px-3 mb-0.5',
					'text-headplane-700 dark:text-headplane-100',
				)}
			>
				{label}
			</label>
			<div
				{...groupProps}
				className={cn(
					'flex items-center gap-1 rounded-xl pr-1',
					'focus-within:outline-hidden focus-within:ring-3',
					'bg-white dark:bg-headplane-900',
					'border border-headplane-100 dark:border-headplane-800',
				)}
			>
				<input
					{...inputProps}
					required={props.isRequired}
					ref={ref}
					id={id}
					className="w-full pl-3 py-2 rounded-l-xl bg-transparent focus:outline-hidden"
				/>
				<input type="hidden" name={name} value={state.numberValue} />
				<IconButton
					{...decrementButtonProps}
					label="Decrement"
					className="w-7.5 h-7.5 rounded-lg"
				>
					<Minus className="p-1" />
				</IconButton>
				<IconButton
					{...incrementButtonProps}
					label="Increment"
					className="w-7.5 h-7.5 rounded-lg"
				>
					<Plus className="p-1" />
				</IconButton>
			</div>
			{props.description && (
				<div
					{...descriptionProps}
					className={cn(
						'text-xs px-3 mt-1',
						'text-headplane-500 dark:text-headplane-400',
					)}
				>
					{props.description}
				</div>
			)}
			{isInvalid && (
				<div
					{...errorMessageProps}
					className={cn('text-xs px-3 mt-1', 'text-red-500 dark:text-red-400')}
				>
					{validationErrors.join(' ')}
				</div>
			)}
		</div>
	);
}
