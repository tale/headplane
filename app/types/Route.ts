import type { Machine } from './Machine';

export interface Route {
	id: string;
	node: Machine;
	prefix: string;
	advertised: boolean;
	enabled: boolean;
	isPrimary: boolean;
	createdAt: string;
	updatedAt: string;
	deletedAt: string;
}
