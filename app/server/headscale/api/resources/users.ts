import type { User } from "~/types";

import type { Capabilities } from "../capabilities";
import type { Transport } from "../transport";

export interface CreateUserOptions {
  name: string;
  email?: string;
  displayName?: string;
  pictureUrl?: string;
}

export interface ListUsersFilter {
  id?: string;
  name?: string;
  email?: string;
}

export interface UserApi {
  list(filter?: ListUsersFilter): Promise<User[]>;
  create(opts: CreateUserOptions): Promise<User>;
  delete(id: string): Promise<void>;
  rename(id: string, newName: string): Promise<void>;
}

export function makeUserApi(
  transport: Transport,
  _capabilities: Capabilities,
  apiKey: string,
): UserApi {
  return {
    list: async (filter) => {
      const { id, name, email } = filter ?? {};
      const moreThanOneFilter = [id, name, email].filter((v) => v !== undefined).length > 1;
      if (moreThanOneFilter) {
        throw new Error("Only one of id, name, or email filters can be provided");
      }
      const { users } = await transport.request<{ users: User[] }>({
        method: "GET",
        path: "v1/user",
        apiKey,
        query: { id, name, email },
      });
      return users;
    },
    create: async ({ name, email, displayName, pictureUrl }) => {
      const { user } = await transport.request<{ user: User }>({
        method: "POST",
        path: "v1/user",
        apiKey,
        body: { name, email, displayName, pictureUrl },
      });
      return user;
    },
    delete: async (id) => {
      await transport.request({ method: "DELETE", path: `v1/user/${id}`, apiKey });
    },
    rename: async (id, newName) => {
      await transport.request({
        method: "POST",
        path: `v1/user/${id}/rename/${encodeURIComponent(newName)}`,
        apiKey,
      });
    },
  };
}
