import { FlaskConical } from 'lucide-react';
import Button from '~/components/Button';

interface Props {
	isLoading: boolean;
	disabled: boolean;
	hasChanges: boolean;
	hasPolicy: boolean;
	onSave: () => void;
	onRunTests: () => void;
	onDiscard: () => void;
}

export function ActionButtons({
	isLoading,
	disabled,
	hasChanges,
	hasPolicy,
	onSave,
	onRunTests,
	onDiscard,
}: Props) {
	return (
		<div className="flex gap-2 flex-wrap">
			<Button
				isDisabled={disabled || isLoading || !hasPolicy || !hasChanges}
				onPress={onSave}
				variant="heavy"
			>
				Save
			</Button>
			<Button isDisabled={isLoading || !hasPolicy} onPress={onRunTests}>
				<span className="flex items-center gap-1.5">
					<FlaskConical className="w-4 h-4" />
					Run Tests
				</span>
			</Button>
			<Button
				isDisabled={disabled || isLoading || !hasChanges}
				onPress={onDiscard}
			>
				Discard Changes
			</Button>
		</div>
	);
}
