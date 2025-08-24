import cn from '~/utils/cn';
import Chip from '../Chip';
import Tooltip from '../Tooltip';

export function TailscaleSSHTag() {
	return (
		<Tooltip>
			<Chip
				text="Tailscale SSH"
				className={cn(
					'bg-lime-500 text-lime-900 dark:bg-lime-900 dark:text-lime-500',
				)}
			/>
			<Tooltip.Body>
				This machine advertises Tailscale SSH, which allows you to authenticate
				SSH credentials using your Tailscale account and via the Headplane web
				UI.
			</Tooltip.Body>
		</Tooltip>
	);
}
