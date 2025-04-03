export type Capabilities = (typeof Capabilities)[keyof typeof Capabilities];
export const Capabilities = {
	// Can access the admin console
	ui_access: 1 << 0,

	// Read tailnet policy file (unimplemented)
	read_policy: 1 << 1,

	// Write tailnet policy file (unimplemented)
	write_policy: 1 << 2,

	// Read network configurations
	read_network: 1 << 3,

	// Write network configurations, for example, enable MagicDNS, split DNS,
	// make subnet, or allow a node to be an exit node, enable HTTPS
	write_network: 1 << 4,

	// Read feature configuration (unimplemented)
	read_feature: 1 << 5,

	// Write feature configuration, for example, enable Taildrop (unimplemented)
	write_feature: 1 << 6,

	// Configure user & group provisioning (unimplemented)
	configure_iam: 1 << 7,

	// Read machines, for example, see machine names and status
	read_machines: 1 << 8,

	// Write machines, for example, approve, rename, and remove machines
	write_machines: 1 << 9,

	// Read users and user roles
	read_users: 1 << 10,

	// Write users and user roles, for example, remove users,
	// approve users, make Admin
	write_users: 1 << 11,

	// Can generate authkeys (unimplemented)
	generate_authkeys: 1 << 12,

	// Can use any tag (without being tag owner) (unimplemented)
	use_tags: 1 << 13,

	// Write tailnet name (unimplemented)
	write_tailnet: 1 << 14,

	// Owner flag
	owner: 1 << 15,
} as const;

export type Roles = [keyof typeof Roles];
export const Roles = {
	owner:
		Capabilities.ui_access |
		Capabilities.read_policy |
		Capabilities.write_policy |
		Capabilities.read_network |
		Capabilities.write_network |
		Capabilities.read_feature |
		Capabilities.write_feature |
		Capabilities.configure_iam |
		Capabilities.read_machines |
		Capabilities.write_machines |
		Capabilities.read_users |
		Capabilities.write_users |
		Capabilities.generate_authkeys |
		Capabilities.use_tags |
		Capabilities.write_tailnet |
		Capabilities.owner,

	admin:
		Capabilities.ui_access |
		Capabilities.read_policy |
		Capabilities.write_policy |
		Capabilities.read_network |
		Capabilities.write_network |
		Capabilities.read_feature |
		Capabilities.write_feature |
		Capabilities.configure_iam |
		Capabilities.read_machines |
		Capabilities.write_machines |
		Capabilities.read_users |
		Capabilities.write_users |
		Capabilities.generate_authkeys |
		Capabilities.use_tags |
		Capabilities.write_tailnet,

	network_admin:
		Capabilities.ui_access |
		Capabilities.read_policy |
		Capabilities.write_policy |
		Capabilities.read_network |
		Capabilities.write_network |
		Capabilities.read_feature |
		Capabilities.read_machines |
		Capabilities.read_users |
		Capabilities.generate_authkeys |
		Capabilities.use_tags |
		Capabilities.write_tailnet,

	it_admin:
		Capabilities.ui_access |
		Capabilities.read_policy |
		Capabilities.read_network |
		Capabilities.read_feature |
		Capabilities.write_feature |
		Capabilities.configure_iam |
		Capabilities.read_machines |
		Capabilities.write_machines |
		Capabilities.read_users |
		Capabilities.write_users |
		Capabilities.generate_authkeys,

	auditor:
		Capabilities.ui_access |
		Capabilities.read_policy |
		Capabilities.read_network |
		Capabilities.read_feature |
		Capabilities.read_machines |
		Capabilities.read_users,

	// Default role for new users with 0 capabilities on the UI side of things
	member: 0,
} as const;

export type Role = keyof typeof Roles;
export type Capability = keyof typeof Capabilities;
export function hasCapability(role: Role, capability: Capability): boolean {
	return (Roles[role] & Capabilities[capability]) !== 0;
}

export function getRoleFromCapabilities(capabilities: Capabilities): Role {
	const iterable = Roles as Record<string, Capabilities>;
	for (const role in iterable) {
		if (iterable[role] === capabilities) {
			return role as Role;
		}
	}

	return 'member';
}
