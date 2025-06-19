import { Info } from 'lucide-react';
import cn from '~/utils/cn';
import Chip from '../Chip';
import Tooltip from '../Tooltip';

export interface ExitNodeTagProps {
	isEnabled?: boolean;
}

export function ExitNodeTag({ isEnabled }: ExitNodeTagProps) {
	return (
		<Tooltip>
			<Chip
				text="Exit Node"
				className={cn(
					'bg-blue-300 text-blue-900 dark:bg-blue-900 dark:text-blue-300',
				)}
				rightIcon={isEnabled ? undefined : <Info className="h-full w-fit" />}
			/>
			<Tooltip.Body>
				{isEnabled ? (
					<>This machine is acting as an exit node.</>
				) : (
					<>
						This machine is requesting to be used as an exit node. Review this
						from the "Edit route settings..." option in the machine's menu.
					</>
				)}
			</Tooltip.Body>
		</Tooltip>
	);
}
