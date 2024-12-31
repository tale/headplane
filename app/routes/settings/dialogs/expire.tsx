import { useFetcher } from 'react-router';
import type { PreAuthKey } from '~/types';
import { cn } from '~/utils/cn';

import Dialog from '~/components/Dialog';
import Spinner from '~/components/Spinner';

interface Props {
	authKey: PreAuthKey;
}

export default function ExpireKey({ authKey }: Props) {
	const fetcher = useFetcher();

	return (
		<Dialog>
			<Dialog.Button className="my-4">Expire Key</Dialog.Button>
			<Dialog.Panel>
				{(close) => (
					<>
						<Dialog.Title>Expire auth key?</Dialog.Title>
						<fetcher.Form
							method="DELETE"
							onSubmit={(e) => {
								fetcher.submit(e.currentTarget);
								close();
							}}
						>
							<input type="hidden" name="user" value={authKey.user} />
							<input type="hidden" name="key" value={authKey.key} />
							<Dialog.Text>
								Expiring this authentication key will immediately prevent it
								from being used to authenticate new devices. This action cannot
								be undone.
							</Dialog.Text>
							<div className="mt-6 flex justify-end gap-2 mt-6">
								<Dialog.Action variant="cancel" onPress={close}>
									Cancel
								</Dialog.Action>
								<Dialog.Action
									variant="confirm"
									className={cn(
										'bg-red-500 hover:border-red-700',
										'dark:bg-red-600 dark:hover:border-red-700',
										'pressed:bg-red-600 hover:bg-red-600',
										'text-white dark:text-white',
									)}
									onPress={close}
								>
									{fetcher.state === 'idle' ? undefined : (
										<Spinner className="w-3 h-3" />
									)}
									Expire
								</Dialog.Action>
							</div>
						</fetcher.Form>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	);
}
