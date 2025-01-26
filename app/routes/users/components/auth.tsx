import { HomeIcon, PasskeyFillIcon } from '@primer/octicons-react';

import Card from '~/components/Card';
import Link from '~/components/Link';

import Add from '../dialogs/add';

interface Props {
	readonly magic: string | undefined;
}

export default function Auth({ magic }: Props) {
	return (
		<Card variant="flat" className="mb-8 w-full max-w-full p-0">
			<div className="flex flex-col md:flex-row">
				<div className="w-full p-4 border-b md:border-b-0 border-ui-200 dark:border-ui-700">
					<HomeIcon className="w-5 h-5 mb-2" />
					<h2 className="font-medium mb-1">Basic Authentication</h2>
					<p className="text-sm text-ui-600 dark:text-ui-300">
						Users are not managed externally. Using OpenID Connect can create a
						better experience when using Headscale.{' '}
						<Link
							to="https://headscale.net/stable/ref/oidc"
							name="Headscale OIDC Documentation"
						>
							Learn more
						</Link>
					</p>
				</div>
				<div className="w-full p-4 md:border-l border-ui-200 dark:border-ui-700">
					<PasskeyFillIcon className="w-5 h-5 mb-2" />
					<h2 className="font-medium mb-1">User Management</h2>
					<p className="text-sm text-ui-600 dark:text-ui-300">
						You can add, remove, and rename users here.
					</p>
					<div className="flex items-center gap-2 mt-4">
						<Add />
					</div>
				</div>
			</div>
		</Card>
	);
}
