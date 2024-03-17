import type { Machine } from "./Machine";

export type Route = {
	id: string;
	node: Machine;
	prefix: string;
	advertised: boolean;
	enabled: boolean;
	isPrimary: boolean;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date;
}
