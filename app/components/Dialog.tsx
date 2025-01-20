import React, { Dispatch, ReactNode, SetStateAction } from 'react';
import Button, { ButtonProps } from '~/components/Button';
import Title from '~/components/Title';
import Text from '~/components/Text';
import Card from '~/components/Card';
import {
	Dialog as AriaDialog,
	DialogTrigger,
	Modal,
	ModalOverlay,
} from 'react-aria-components';
import { cn } from '~/utils/cn';

interface ActionProps extends Omit<ButtonProps, 'variant'> {
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

interface GutterProps {
	children: ReactNode;
}

function Gutter({ children }: GutterProps) {
	return (
		<div className="mt-6 flex justify-end gap-4 mt-6">
			{children}
		</div>
	)
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
				'fixed inset-0 h-screen w-screen z-50',
				'flex items-center justify-center',
				'bg-headplane-900/15 dark:bg-headplane-900/30',
				'entering:animate-in exiting:animate-out',
				'entering:fade-in entering:duration-100 entering:ease-out',
				'exiting:fade-out exiting:duration-50 exiting:ease-in',
				className,
			)}
			isOpen={control ? control[0] : undefined}
			onOpenChange={control ? control[1] : undefined}
		>
			<Modal className={cn(
				'bg-white dark:bg-headplane-900 rounded-3xl w-full max-w-lg',
				'entering:animate-in exiting:animate-out',
				'entering:zoom-in-95 entering:ease-out entering:duration-100',
				'exiting:zoom-out-95 exiting:ease-in exiting:duration-50',
			)}>
				<Card variant="flat" className="w-full max-w-lg">
					<AriaDialog role="alertdialog" className="outline-none">
						{({ close }) => children(close)}
					</AriaDialog>
				</Card>
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

export default Object.assign(Dialog, {
	Action,
	Button,
	Gutter,
	Panel,
	Title,
	Text,
});
