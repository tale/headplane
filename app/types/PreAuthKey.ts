import type { User } from './User';

export interface PreAuthKey {
	id: string;
	key: string;
	user: User;
	reusable: boolean;
	ephemeral: boolean;
	used: boolean;
	expiration: string;
	createdAt: string;
	aclTags: string[];
}
