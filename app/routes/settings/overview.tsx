import { ArrowRightIcon } from '@primer/octicons-react';
import {
	LoaderFunctionArgs,
	Link as RemixLink,
	useLoaderData,
} from 'react-router';
import Link from '~/components/Link';
import { LoadContext } from '~/server';

export async function loader({ context }: LoaderFunctionArgs<LoadContext>) {
	return {
		config: context.hs.writable(),
		oidc: context.oidc,
	};
}

export default function Page() {
	const { config, oidc } = useLoaderData<typeof loader>();

	return (
		<div className="flex flex-col gap-8 max-w-(--breakpoint-lg)">
			<div className="flex flex-col w-2/3">
				<h1 className="text-2xl font-medium mb-4">Settings</h1>
				<p>
					The settings page is still under construction. As I'm able to add more
					features, I'll be adding them here. If you require any features, feel
					free to open an issue on the GitHub repository.
				</p>
			</div>
			<div className="flex flex-col w-2/3">
				<h1 className="text-2xl font-medium mb-4">Pre-Auth Keys</h1>
				<p>
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
				<div className="text-lg font-medium flex items-center">
					Manage Auth Keys
					<ArrowRightIcon className="w-5 h-5 ml-2" />
				</div>
			</RemixLink>
			{config && oidc ? (
				<>
					<div className="flex flex-col w-2/3">
						<h1 className="text-2xl font-medium mb-4">
							Authentication Restrictions
						</h1>
						<p>
							Headscale supports restricting OIDC authentication to only allow
							certain email domains, groups, or users to authenticate. This can
							be used to limit access to your Tailnet to only certain users or
							groups and Headplane will also respect these settings when
							authenticating.{' '}
							<Link
								to="https://headscale.net/stable/ref/oidc/#basic-configuration"
								name="Headscale OIDC documentation"
							>
								Learn More
							</Link>
						</p>
					</div>
					<RemixLink to="/settings/restrictions">
						<div className="text-lg font-medium flex items-center">
							Manage Restrictions
							<ArrowRightIcon className="w-5 h-5 ml-2" />
						</div>
					</RemixLink>
				</>
			) : undefined}
		</div>
	);
}
