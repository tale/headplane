import type { PreAuthKey } from "./PreAuthKey";
import type { User } from "./User";

export interface Machine {
  id: string;
  machineKey: string;
  nodeKey: string;
  discoKey: string;
  ipAddresses: string[];
  name: string;

  user: User;
  lastSeen: string;
  expiry: string | null;

  preAuthKey?: PreAuthKey;

  createdAt: string;
  registerMethod:
    | "REGISTER_METHOD_UNSPECIFIED"
    | "REGISTER_METHOD_AUTH_KEY"
    | "REGISTER_METHOD_CLI"
    | "REGISTER_METHOD_OIDC";

  tags: string[];
  givenName: string;
  online: boolean;

  // Added in Headscale 0.26+
  approvedRoutes: string[];
  availableRoutes: string[];
  subnetRoutes: string[];
}
