import { Asterisk } from 'lucide-react';
import { useRef } from 'react';
import { type AriaTextFieldProps, useId, useTextField } from 'react-aria';
import cn from '~/utils/cn';

export interface InputProps extends AriaTextFieldProps<HTMLInputElement> {
	label: string;
	labelHidden?: boolean;
	isRequired?: boolean;
	className?: string;
	isInvalid?: boolean;
	errorMessage?: string;
}

export default function Input(props: InputProps) {
	const {
		label,
		labelHidden,
		className,
		isInvalid: customIsInvalid,
		errorMessage,
	} = props;
	const ref = useRef<HTMLInputElement | null>(null);
	const id = useId(props.id);

	const {
		labelProps,
		inputProps,
		descriptionProps,
		errorMessageProps,
		isInvalid: ariaIsInvalid,
		validationErrors,
	} = useTextField(
		{
			...props,
			label,
			'aria-label': label,
		},
		ref,
	);

	const isInvalid = customIsInvalid ?? ariaIsInvalid;

	return (
		<div className="flex flex-col w-full">
			<label
				{...labelProps}
				className={cn(
					'text-xs font-medium px-3 mb-0.5',
					'text-headplane-700 dark:text-headplane-100',
					labelHidden && 'sr-only',
				)}
				htmlFor={id}
			>
				{label}
				{props.isRequired && (
					<Asterisk className="inline w-3.5 text-red-500 pb-1 ml-0.5" />
				)}
			</label>
			<input
				{...inputProps}
				className={cn(
					'rounded-xl px-3 py-2',
					'focus:outline-hidden focus:ring-3',
					'bg-white dark:bg-headplane-900',
					'border border-headplane-100 dark:border-headplane-800',
					className,
				)}
				ref={ref}
				required={props.isRequired}
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
			{isInvalid ? (
				<div
					{...errorMessageProps}
					className={cn('text-xs px-3 mt-1', 'text-red-500 dark:text-red-400')}
				>
					{errorMessage ?? validationErrors.join(' ')}
				</div>
			) : null}
		</div>
	);
}
