import Chip from '../Chip';
import Tooltip from '../Tooltip';

export interface ExpiryTagProps {
	variant: 'expired' | 'no-expiry';
	expiry?: string;
}

export function ExpiryTag({ variant, expiry }: ExpiryTagProps) {
	const formatter = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});

	return (
		<Tooltip>
			<Chip
				text={
					variant === 'expired'
						? `Expired ${formatter.format(new Date(expiry!))}`
						: 'No expiry'
				}
				className="bg-headplane-200 text-headplane-800 dark:bg-headplane-800 dark:text-headplane-200"
			/>
			<Tooltip.Body>
				{variant === 'expired' ? (
					<>
						This machine is expired and will not be able to connect to the
						network. Re-authenticate with Tailscale on the machine to re-enable
						it.
					</>
				) : (
					<>
						This machine has key expiry disabled and will never need to
						re-authenticate.
					</>
				)}
			</Tooltip.Body>
		</Tooltip>
	);
}
