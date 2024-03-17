import type { User } from "./User";

export type Machine = {
	id: string;
	machineKey: string;
	nodeKey: string;
	discoKey: string;
	ipAddresses: string[];
	name: string;

	user: User;
	lastSeen: Date;
	expiry: Date;


	preAuthKey?: unknown; // TODO

	createdAt: Date;
	registerMethod: 'REGISTER_METHOD_UNSPECIFIED'
		| 'REGISTER_METHOD_AUTH_KEY'
		| 'REGISTER_METHOD_CLI'
		| 'REGISTER_METHOD_OIDC'

	forcedTags: string[];
	invalidTags: string[];
	validTags: string[];
	givenName: string;
	online: boolean
}
