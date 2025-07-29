import Dialog from '~/components/Dialog';
import type { Machine } from '~/types';

interface ExpireProps {
	machine: Machine;
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
}

export default function Expire({ machine, isOpen, setIsOpen }: ExpireProps) {
	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel variant="destructive">
				<Dialog.Title>Expire {machine.givenName}</Dialog.Title>
				<Dialog.Text>
					This will disconnect the machine from your Tailnet. In order to
					reconnect, you will need to re-authenticate from the device.
				</Dialog.Text>
				<input type="hidden" name="action_id" value="expire" />
				<input type="hidden" name="node_id" value={machine.id} />
			</Dialog.Panel>
		</Dialog>
	);
}
