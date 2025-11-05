import { Building2, House, Key } from 'lucide-react';
import Card from '~/components/Card';
import Link from '~/components/Link';
import CreateUser from '../dialogs/create-user';

interface ManageBannerProps {
	oidc?: { issuer: string };
	isDisabled?: boolean;
}

export default function ManageBanner({ oidc, isDisabled }: ManageBannerProps) {
	return (
		<Card className="mb-8 w-full max-w-full p-0" variant="flat">
			<div className="flex flex-col md:flex-row">
				<div className="w-full p-4 border-b md:border-b-0 border-headplane-100 dark:border-headplane-800">
					{oidc ? (
						<Building2 className="w-5 h-5 mb-2" />
					) : (
						<House className="w-5 h-5 mb-2" />
					)}
					<h2 className="font-medium mb-1">
						{oidc ? 'OpenID Connect' : 'User Authentication'}
					</h2>
					<p className="text-sm text-headplane-600 dark:text-headplane-300">
						{oidc ? (
							<>
								Users are managed through your{' '}
								<Link name="OIDC Provider" to={oidc.issuer}>
									OpenID Connect provider
								</Link>
								{'. '}
								Groups and user information do not automatically sync.{' '}
								<Link
									name="Headscale OIDC Documentation"
									to="https://headscale.net/stable/ref/oidc"
								>
									Learn more
								</Link>
							</>
						) : (
							<>
								Users are not managed externally. Using OpenID Connect can
								create a better experience when using Headscale.{' '}
								<Link
									name="Headscale OIDC Documentation"
									to="https://headscale.net/stable/ref/oidc"
								>
									Learn more
								</Link>
							</>
						)}
					</p>
				</div>
				<div className="w-full p-4 md:border-l border-headplane-100 dark:border-headplane-800">
					<Key className="w-5 h-5 mb-2" />
					<h2 className="font-medium mb-1">User Management</h2>
					<p className="text-sm text-headplane-600 dark:text-headplane-300">
						{oidc
							? 'You can still add users manually, however it is recommended that you manage users through your OIDC provider.'
							: 'You can add, remove, and rename users here.'}
					</p>
					<div className="flex items-center gap-2 mt-4">
						<CreateUser isDisabled={isDisabled} isOidc={oidc !== undefined} />
					</div>
				</div>
			</div>
		</Card>
	);
}
