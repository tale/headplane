import { Ellipsis } from "lucide-react";
import { useState } from "react";

import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/menu";

import Delete from "../dialogs/delete-user";
import LinkUser from "../dialogs/link-user";
import Reassign from "../dialogs/reassign-user";
import type { HeadplaneUserData } from "../overview";

interface MenuProps {
  user: HeadplaneUserData;
  headscaleUsers: { id: string; name: string; claimed: boolean }[];
  currentLink?: string;
}

type Modal = "delete" | "reassign" | "link" | null;

export default function UserMenu({ user, headscaleUsers, currentLink }: MenuProps) {
  const [modal, setModal] = useState<Modal>(null);

  const isLinked = currentLink !== undefined;
  const disabledKeys: string[] = [];
  if (!isLinked) {
    disabledKeys.push("reassign");
  }

  // Filter linkable users: unclaimed, or the one currently linked to this user
  const linkableUsers = headscaleUsers.filter((u) => !u.claimed || u.id === currentLink);

  const displayName = user.linkedHeadscaleUser?.displayName || user.name || user.email || user.sub;

  return (
    <>
      {modal === "delete" && user.linkedHeadscaleUser && (
        <Delete
          isOpen={modal === "delete"}
          machines={user.machines}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
          user={user.linkedHeadscaleUser}
        />
      )}
      {modal === "reassign" && (
        <Reassign
          displayName={displayName}
          isOpen={modal === "reassign"}
          role={user.role}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
          userId={user.linkedHeadscaleUser?.id ?? user.id}
        />
      )}
      {modal === "link" && (
        <LinkUser
          currentLink={currentLink}
          displayName={displayName}
          headscaleUsers={linkableUsers}
          isOpen={modal === "link"}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
          userId={user.linkedHeadscaleUser?.id ?? user.id}
        />
      )}

      <Menu>
        <MenuTrigger className="w-10 rounded-full bg-transparent p-1 py-0.5 hover:bg-mist-100 dark:hover:bg-mist-800">
          <Ellipsis className="h-5" />
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            disabled={disabledKeys.includes("reassign")}
            onClick={() => setModal("reassign")}
          >
            Change role
          </MenuItem>
          <MenuItem onClick={() => setModal("link")}>
            {isLinked ? "Change linked user" : "Link Headscale user"}
          </MenuItem>
          {user.linkedHeadscaleUser && (
            <>
              <MenuSeparator />
              <MenuItem variant="danger" onClick={() => setModal("delete")}>
                Delete
              </MenuItem>
            </>
          )}
        </MenuContent>
      </Menu>
    </>
  );
}
