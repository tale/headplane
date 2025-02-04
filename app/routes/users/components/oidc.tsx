import { OrganizationIcon, PasskeyFillIcon } from '@primer/octicons-react';

import Card from '~/components/Card';
import Link from '~/components/Link';
import type { HeadplaneContext } from '~/utils/config/headplane';

import Add from '../dialogs/add';

interface Props {
	readonly oidc: NonNullable<HeadplaneContext['oidc']>;
	readonly magic: string | undefined;
}

export default function Oidc({ oidc, magic }: Props) {
	return (
		<Card variant="flat" className="mb-8 w-full max-w-full p-0">
			<div className="flex flex-col md:flex-row">
				<div className="w-full p-4 border-b md:border-b-0 border-headplane-100 dark:border-headplane-800">
					<OrganizationIcon className="w-5 h-5 mb-2" />
					<h2 className="font-medium mb-1">OpenID Connect</h2>
					<p className="text-sm text-headplane-600 dark:text-headplane-300">
						Users are managed through your{' '}
						<Link to={oidc.issuer} name="OIDC Provider">
							OpenID Connect provider
						</Link>
						{'. '}
						Groups and user information do not automatically sync.{' '}
						<Link
							to="https://headscale.net/stable/ref/oidc"
							name="Headscale OIDC Documentation"
						>
							Learn more
						</Link>
					</p>
				</div>
				<div className="w-full p-4 md:border-l border-headplane-100 dark:border-headplane-800">
					<PasskeyFillIcon className="w-5 h-5 mb-2" />
					<h2 className="font-medium mb-1">User Management</h2>
					<p className="text-sm text-headplane-600 dark:text-headplane-300">
						You can still add users manually, however it is recommended that you
						manage users through your OIDC provider.
					</p>
					<div className="flex items-center gap-2 mt-4">
						<Add />
					</div>
				</div>
			</div>
		</Card>
	);
}
