import { CircleUser } from 'lucide-react';
import StatusCircle from '~/components/StatusCircle';
import { Machine, User } from '~/types';
import cn from '~/utils/cn';
import MenuOptions from './menu';

interface UserRowProps {
	role: string;
	user: User & { machines: Machine[] };
}

export default function UserRow({ user, role }: UserRowProps) {
	const isOnline = user.machines.some((machine) => machine.online);
	const lastSeen = user.machines.reduce(
		(acc, machine) => Math.max(acc, new Date(machine.lastSeen).getTime()),
		0,
	);

	return (
		<tr
			key={user.id}
			className="group hover:bg-headplane-50 dark:hover:bg-headplane-950"
		>
			<td className="pl-0.5 py-2">
				<div className="flex items-center">
					{user.profilePicUrl ? (
						<img
							src={user.profilePicUrl}
							alt={user.name || user.displayName}
							className="w-10 h-10 rounded-full"
						/>
					) : (
						<CircleUser className="w-10 h-10" />
					)}
					<div className="ml-4">
						<p className={cn('font-semibold leading-snug')}>{user.name || user.displayName}</p>
						<p className="text-sm opacity-50">{user.email}</p>
					</div>
				</div>
			</td>
			<td className="pl-0.5 py-2">
				<p>{mapRoleToName(role)}</p>
			</td>
			<td className="pl-0.5 py-2">
				<p
					suppressHydrationWarning
					className="text-sm text-headplane-600 dark:text-headplane-300"
				>
					{new Date(user.createdAt).toLocaleDateString()}
				</p>
			</td>
			<td className="pl-0.5 py-2">
				<span
					className={cn(
						'flex items-center gap-x-1 text-sm',
						'text-headplane-600 dark:text-headplane-300',
					)}
				>
					<StatusCircle isOnline={isOnline} className="w-4 h-4" />
					<p suppressHydrationWarning>
						{isOnline ? 'Connected' : new Date(lastSeen).toLocaleString()}
					</p>
				</span>
			</td>
			<td className="py-2 pr-0.5">
				<MenuOptions user={{ ...user, headplaneRole: role }} />
			</td>
		</tr>
	);
}

function mapRoleToName(role: string) {
	switch (role) {
		case 'no-oidc':
			return <p className="opacity-50">Unmanaged</p>;
		case 'invalid-oidc':
			return <p className="opacity-50">Invalid</p>;
		case 'no-role':
			return <p className="opacity-50">Unregistered</p>;
		case 'owner':
			return 'Owner';
		case 'admin':
			return 'Admin';
		case 'network_admin':
			return 'Network Admin';
		case 'it_admin':
			return 'IT Admin';
		case 'auditor':
			return 'Auditor';
		case 'member':
			return 'Member';
		default:
			return 'Unknown';
	}
}
