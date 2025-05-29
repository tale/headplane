import {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	Link as RemixLink,
	data,
	useLoaderData,
} from 'react-router';
import Link from '~/components/Link';
import Notice from '~/components/Notice';
import { LoadContext } from '~/server';
import { Capabilities } from '~/server/web/roles';
import { restrictionAction } from './actions';
import AddDomain from './dialogs/add-domain';
import AddGroup from './dialogs/add-group';
import AddUser from './dialogs/add-user';
import RestrictionTable from './table';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const check = await context.sessions.check(request, Capabilities.read_users);
	if (!check) {
		throw data('You do not have permission to view IAM settings.', {
			status: 403,
		});
	}

	if (!context.hs.c?.oidc) {
		throw data('OIDC is not configured on this Headscale instance.', {
			status: 501,
		});
	}

	return {
		access: await context.sessions.check(request, Capabilities.configure_iam),
		writable: context.hs.writable(),
		settings: {
			domains: [...new Set(context.hs.c.oidc.allowed_domains)],
			groups: [...new Set(context.hs.c.oidc.allowed_groups)],
			users: [...new Set(context.hs.c.oidc.allowed_users)],
		},
	};
}

export async function action(request: ActionFunctionArgs) {
	return restrictionAction(request);
}

export default function Page() {
	const { access, writable, settings } = useLoaderData<typeof loader>();
	const isDisabled = writable ? !access : true;

	return (
		<div className="flex flex-col gap-4 max-w-(--breakpoint-lg)">
			<div className="flex flex-col w-2/3">
				<p className="mb-4 text-md">
					<RemixLink to="/settings" className="font-medium">
						Settings
					</RemixLink>
					<span className="mx-2">/</span> Authentication Restrictions
				</p>
				{!access ? (
					<Notice
						title="Authentication permissions restricted"
						variant="warning"
					>
						You do not have the necessary permissions to edit the Authentication
						Restrictions settings. Please contact your administrator to request
						access or to make changes to these settings.
					</Notice>
				) : !writable ? (
					<Notice title="Configuration Locked" variant="error">
						The Headscale configuration file is not editable through the web
						interface. Please ensure that you have correctly given Headplane
						write access to the file.
					</Notice>
				) : undefined}
				<h1 className="text-2xl font-medium mb-2 mt-4">
					Authentication Restrictions
				</h1>
				<p>
					Headscale supports restricting OIDC authentication to only allow
					certain email domains, groups, or users to authenticate. This can be
					used to limit access to your Tailnet to only certain users or groups
					and Headplane will also respect these settings when authenticating.{' '}
					<Link
						to="https://headscale.net/stable/ref/oidc/#basic-configuration"
						name="Headscale OIDC documentation"
					>
						Learn More
					</Link>
				</p>
			</div>
			<RestrictionTable
				type="domain"
				values={settings.domains}
				isDisabled={isDisabled}
			>
				<AddDomain domains={settings.domains} isDisabled={isDisabled} />
			</RestrictionTable>
			<RestrictionTable
				type="group"
				values={settings.groups}
				isDisabled={isDisabled}
			>
				<AddGroup groups={settings.groups} isDisabled={isDisabled} />
			</RestrictionTable>
			<RestrictionTable
				type="user"
				values={settings.users}
				isDisabled={isDisabled}
			>
				<AddUser users={settings.users} isDisabled={isDisabled} />
			</RestrictionTable>
		</div>
	);
}
