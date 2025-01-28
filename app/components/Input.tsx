import { useRef } from 'react';
import { type AriaTextFieldProps, useId, useTextField } from 'react-aria';
import cn from '~/utils/cn';

export interface InputProps extends AriaTextFieldProps<HTMLInputElement> {
	isRequired?: boolean;
	className?: string;
}

export default function Input(props: InputProps) {
	const { label, className } = props;
	const ref = useRef<HTMLInputElement | null>(null);
	const id = useId(props.id);

	const {
		labelProps,
		inputProps,
		descriptionProps,
		errorMessageProps,
		isInvalid,
		validationErrors,
	} = useTextField(props, ref);

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
			<input
				{...inputProps}
				required={props.isRequired}
				ref={ref}
				id={id}
				className={cn(
					'rounded-xl px-3 py-2',
					'focus:outline-none focus:ring',
					'bg-white dark:bg-headplane-900',
					'border border-headplane-100 dark:border-headplane-800',
					className,
				)}
			/>
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
