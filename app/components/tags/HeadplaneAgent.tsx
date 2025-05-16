import cn from '~/utils/cn';
import Chip from '../Chip';
import Tooltip from '../Tooltip';

export function HeadplaneAgentTag() {
	return (
		<Tooltip>
			<Chip
				text="Headplane Agent"
				className={cn(
					'bg-purple-300 text-purple-900 dark:bg-purple-900 dark:text-purple-300',
				)}
			/>
			<Tooltip.Body>
				This machine is running the Headplane agent, which allows it to provide
				host information in the web UI.
			</Tooltip.Body>
		</Tooltip>
	);
}
