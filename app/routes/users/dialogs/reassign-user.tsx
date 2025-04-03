import Dialog from '~/components/Dialog';
import Link from '~/components/Link';
import Notice from '~/components/Notice';
import RadioGroup from '~/components/RadioGroup';
import { Roles } from '~/server/web/roles';
import { User } from '~/types';

interface ReassignProps {
	user: User & { headplaneRole: string };
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
}

export default function ReassignUser({
	user,
	isOpen,
	setIsOpen,
}: ReassignProps) {
	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel
				variant={user.headplaneRole === 'owner' ? 'unactionable' : 'normal'}
			>
				<Dialog.Title>Change role for {user.name}?</Dialog.Title>
				<Dialog.Text className="mb-6">
					Most roles are carried straight from Tailscale. However, keep in mind
					that I have not fully implemented permissions yet and some things may
					be accessible to everyone. The only fully completed role is Member.{' '}
					<Link
						to="https://tailscale.com/kb/1138/user-roles"
						name="Tailscale User Roles documentation"
					>
						Learn More
					</Link>
				</Dialog.Text>
				{user.headplaneRole === 'owner' ? (
					<Notice>The Tailnet owner cannot be reassigned.</Notice>
				) : (
					<>
						<input type="hidden" name="action_id" value="reassign_user" />
						<input type="hidden" name="user_id" value={user.id} />
						<RadioGroup
							isRequired
							name="new_role"
							label="Role"
							className="gap-4"
							defaultValue={user.headplaneRole}
						>
							{Object.keys(Roles)
								.filter((role) => role !== 'owner')
								.map((role) => {
									const { name, desc } = mapRoleToName(role);
									return (
										<RadioGroup.Radio key={role} value={role} label={name}>
											<div className="block">
												<p className="font-bold">{name}</p>
												<p className="opacity-70">{desc}</p>
											</div>
										</RadioGroup.Radio>
									);
								})}
						</RadioGroup>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	);
}

function mapRoleToName(role: string) {
	switch (role) {
		case 'admin':
			return {
				name: 'Admin',
				desc: 'Can view the admin console, manage network, machine, and user settings.',
			};
		case 'network_admin':
			return {
				name: 'Network Admin',
				desc: 'Can view the admin console and manage ACLs and network settings. Cannot manage machines or users.',
			};
		case 'it_admin':
			return {
				name: 'IT Admin',
				desc: 'Can view the admin console and manage machines and users. Cannot manage ACLs or network settings.',
			};
		case 'auditor':
			return {
				name: 'Auditor',
				desc: 'Can view the admin console.',
			};
		case 'member':
			return {
				name: 'Member',
				desc: 'Cannot view the admin console.',
			};
		default:
			return {
				name: 'Unknown',
				desc: 'Unknown',
			};
	}
}
