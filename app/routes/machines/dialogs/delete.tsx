import { useNavigate } from 'react-router';
import Dialog from '~/components/Dialog';
import type { Machine } from '~/types';

interface DeleteProps {
	machine: Machine;
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
}

export default function Delete({ machine, isOpen, setIsOpen }: DeleteProps) {
	const navigate = useNavigate();

	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel
				variant="destructive"
				onSubmit={() => navigate('/machines')}
			>
				<Dialog.Title>Remove {machine.givenName}</Dialog.Title>
				<Dialog.Text>
					This machine will be permanently removed from your network. To re-add
					it, you will need to reauthenticate to your tailnet from the device.
				</Dialog.Text>
				<input type="hidden" name="_method" value="delete" />
				<input type="hidden" name="id" value={machine.id} />
			</Dialog.Panel>
		</Dialog>
	);
}
