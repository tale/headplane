import { Ellipsis } from "lucide-react";
import { useState } from "react";

import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/menu";
import type { Machine, User } from "~/types";

import Delete from "../dialogs/delete-user";
import LinkUser from "../dialogs/link-user";
import Reassign from "../dialogs/reassign-user";
import Rename from "../dialogs/rename-user";

interface MenuProps {
  user: User & {
    headplaneRole: string;
    machines: Machine[];
  };
  headscaleUsers: { id: string; name: string; claimed: boolean }[];
  currentLink?: string;
}

type Modal = "rename" | "delete" | "reassign" | "link" | null;

export default function UserMenu({ user, headscaleUsers, currentLink }: MenuProps) {
  const [modal, setModal] = useState<Modal>(null);

  const disabledKeys: string[] = [];
  if (user.provider === "oidc") {
    disabledKeys.push("rename");
  } else {
    disabledKeys.push("reassign", "link");
  }

  // Filter linkable users: unclaimed, or the one currently linked to this user
  const linkableUsers = headscaleUsers.filter((u) => !u.claimed || u.id === currentLink);

  return (
    <>
      {modal === "rename" && (
        <Rename
          isOpen={modal === "rename"}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
          user={user}
        />
      )}
      {modal === "delete" && (
        <Delete
          isOpen={modal === "delete"}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
          user={user}
        />
      )}
      {modal === "reassign" && (
        <Reassign
          isOpen={modal === "reassign"}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
          user={user}
        />
      )}
      {modal === "link" && (
        <LinkUser
          currentLink={currentLink}
          headscaleUsers={linkableUsers}
          isOpen={modal === "link"}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
          user={user}
        />
      )}

      <Menu>
        <MenuTrigger className="w-10 rounded-full bg-transparent p-1 py-0.5 hover:bg-mist-100 dark:hover:bg-mist-800">
          <Ellipsis className="h-5" />
        </MenuTrigger>
        <MenuContent>
          <MenuItem disabled={disabledKeys.includes("rename")} onClick={() => setModal("rename")}>
            Rename user
          </MenuItem>
          <MenuItem
            disabled={disabledKeys.includes("reassign")}
            onClick={() => setModal("reassign")}
          >
            Change role
          </MenuItem>
          <MenuItem disabled={disabledKeys.includes("link")} onClick={() => setModal("link")}>
            Link Headscale user
          </MenuItem>
          <MenuSeparator />
          <MenuItem variant="danger" onClick={() => setModal("delete")}>
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>
    </>
  );
}
