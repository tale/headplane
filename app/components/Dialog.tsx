import React, { Dispatch, ReactNode, SetStateAction } from 'react';
import Button, { ButtonProps } from '~/components/Button';
import Title from '~/components/Title';
import {
	Button as AriaButton,
	Dialog as AriaDialog,
	DialogTrigger,
	Heading as AriaHeading,
	Modal,
	ModalOverlay,
} from 'react-aria-components';
import { cn } from '~/utils/cn';

interface ActionProps extends ButtonProps {
	variant: 'cancel' | 'confirm';
}

function Action(props: ActionProps) {
	return (
		<Button
			{...props}
			type={props.variant === 'confirm' ? 'submit' : 'button'}
			variant={props.variant === 'cancel' ? 'light' : 'heavy'}
		/>
	);
}

function Text(props: React.HTMLProps<HTMLParagraphElement>) {
	return (
		<p {...props} className={cn('text-base leading-6 my-0', props.className)} />
	);
}

interface PanelProps {
	children: (close: () => void) => ReactNode;
	control?: [boolean, Dispatch<SetStateAction<boolean>>];
	className?: string;
}

function Panel({ children, control, className }: PanelProps) {
	return (
		<ModalOverlay
			aria-hidden="true"
			className={cn(
				'fixed inset-0 h-screen w-screen z-50 bg-black/30',
				'flex items-center justify-center dark:bg-black/70',
				'entering:animate-in exiting:animate-out',
				'entering:fade-in entering:duration-200 entering:ease-out',
				'exiting:fade-out exiting:duration-100 exiting:ease-in',
				className,
			)}
			isOpen={control ? control[0] : undefined}
			onOpenChange={control ? control[1] : undefined}
		>
			<Modal
				className={cn(
					'w-full max-w-md overflow-hidden rounded-2xl p-4',
					'bg-ui-50 dark:bg-ui-900 shadow-lg',
					'entering:animate-in exiting:animate-out',
					'dark:border dark:border-ui-700',
					'entering:zoom-in-95 entering:ease-out entering:duration-200',
					'exiting:zoom-out-95 exiting:ease-in exiting:duration-100',
				)}
			>
				<AriaDialog role="alertdialog" className="outline-none relative">
					{({ close }) => children(close)}
				</AriaDialog>
			</Modal>
		</ModalOverlay>
	);
}

interface DialogProps {
	children: ReactNode;
	control?: [boolean, Dispatch<SetStateAction<boolean>>];
}

function Dialog({ children, control }: DialogProps) {
	if (control) {
		return children;
	}

	return <DialogTrigger>{children}</DialogTrigger>;
}

export default Object.assign(Dialog, { Button, Title, Text, Panel, Action });
