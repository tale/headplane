import { ArrowRightIcon } from '@primer/octicons-react';
import { Link as RemixLink } from 'react-router';
import Button from '~/components/Button';
import Link from '~/components/Link';
import cn from '~/utils/cn';

import AgentSection from './components/agent';

export default function Page() {
	return (
		<div className="flex flex-col gap-8 max-w-screen-lg">
			<div className="flex flex-col w-2/3">
				<h1 className="text-2xl font-medium mb-4">Settings</h1>
				<p className="text-gray-700 dark:text-gray-300">
					The settings page is still under construction. As I'm able to add more
					features, I'll be adding them here. If you require any features, feel
					free to open an issue on the GitHub repository.
				</p>
			</div>
			<div className="flex flex-col w-2/3">
				<h1 className="text-2xl font-medium mb-4">Pre-Auth Keys</h1>
				<p className="text-gray-700 dark:text-gray-300">
					Headscale fully supports pre-authentication keys in order to easily
					add devices to your Tailnet. To learn more about using
					pre-authentication keys, visit the{' '}
					<Link
						to="https://tailscale.com/kb/1085/auth-keys/"
						name="Tailscale Auth Keys documentation"
					>
						Tailscale documentation
					</Link>
				</p>
			</div>
			<RemixLink to="/settings/auth-keys">
				<div
					className={cn(
						'text-lg font-medium flex items-center',
						'text-gray-700 dark:text-gray-300',
					)}
				>
					Manage Auth Keys
					<ArrowRightIcon className="w-5 h-5 ml-2" />
				</div>
			</RemixLink>
			{/**<AgentSection />**/}
		</div>
	);
}
