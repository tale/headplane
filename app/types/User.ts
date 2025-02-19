export interface User {
	id: string;
	name: string;
	createdAt: string;
	displayName?: string;
	email?: string;
	providerId?: string;
	provider?: string;
	profilePicUrl?: string;
}
