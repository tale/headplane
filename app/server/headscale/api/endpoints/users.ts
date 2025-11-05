import type { User } from '~/types';
import { defineApiEndpoints } from '../factory';

export interface UserEndpoints {
	/**
	 * Retrieves users from the Headscale instance, optionally filtering by ID, name, or email.
	 *
	 * @param id Optional ID of the user to retrieve.
	 * @param name Optional name of the user to retrieve.
	 * @param email Optional email of the user to retrieve.
	 * @returns An array of `User` objects representing the users.
	 */
	getUsers(id?: string, name?: string, email?: string): Promise<User[]>;

	/**
	 * Creates a new user in the Headscale instance.
	 *
	 * @param username The username of the new user.
	 * @param email Optional email of the new user.
	 * @param displayName Optional display name of the new user.
	 * @param pictureUrl Optional picture URL of the new user.
	 * @returns A `User` object representing the newly created user.
	 */
	createUser(
		username: string,
		email?: string,
		displayName?: string,
		pictureUrl?: string,
	): Promise<User>;

	/**
	 * Deletes a specific user by its ID.
	 *
	 * @param id The ID of the user to delete.
	 */
	deleteUser(id: string): Promise<void>;

	/**
	 * Renames a specific user by its ID.
	 *
	 * @param id The ID of the user to rename.
	 * @param newName The new name for the user.
	 */
	renameUser(id: string, newName: string): Promise<void>;
}

export default defineApiEndpoints<UserEndpoints>((client, apiKey) => ({
	getUsers: async (id, name, email) => {
		const moreThanOneFilter =
			[id, name, email].filter((v) => v !== undefined).length > 1;

		if (moreThanOneFilter) {
			throw new Error('Only one of id, name, or email filters can be provided');
		}

		const { users } = await client.apiFetch<{ users: User[] }>(
			'GET',
			'v1/user',
			apiKey,
			{ id, name, email },
		);

		return users;
	},

	createUser: async (username, email, displayName, pictureUrl) => {
		const { user } = await client.apiFetch<{ user: User }>(
			'POST',
			'v1/user',
			apiKey,
			{ name: username, email, displayName, pictureUrl },
		);

		return user;
	},

	deleteUser: async (id) => {
		await client.apiFetch<void>('DELETE', `v1/user/${id}`, apiKey);
	},

	renameUser: async (oldId, newName) => {
		await client.apiFetch<void>(
			'POST',
			`v1/user/${oldId}/rename/${newName}`,
			apiKey,
		);
	},
}));
