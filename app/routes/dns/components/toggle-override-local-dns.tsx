import Dialog from '~/components/Dialog';

interface Props {
    isEnabled: boolean;
    isDisabled: boolean;
}

export default function Modal({ isEnabled, isDisabled }: Props) {
    return (
        <Dialog>
            <Dialog.Button
                isDisabled={isDisabled}
                className={isEnabled ? "text-red-500 border-red-500" : ""}
                >
                {isEnabled ? 'Disable' : 'Enable'} Local DNS Override
            </Dialog.Button>
            <Dialog.Panel isDisabled={isDisabled}>
                <Dialog.Title>
                    {isEnabled ? 'Disable' : 'Enable'} Local DNS Override
                </Dialog.Title>
                <Dialog.Text>
                    {isEnabled 
                        ? 'Devices will no longer have their local DNS settings overridden by Headscale.' 
                        : 'Headscale will override local DNS settings on connected devices, forcing them to use the server\'s DNS configuration.'
                    }
                </Dialog.Text>
                <input type="hidden" name="action_id" value="toggle_override_local_dns" />
                <input
                    type="hidden"
                    name="new_state"
                    value={isEnabled ? 'disabled' : 'enabled'}
                />
            </Dialog.Panel>
        </Dialog>
    );
}