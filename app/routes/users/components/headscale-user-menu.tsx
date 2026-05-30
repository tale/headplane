import { Ellipsis } from "lucide-react";
import { useState } from "react";

import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/menu";

import Delete from "../dialogs/delete-user";
import Rename from "../dialogs/rename-user";
import type { UnlinkedHeadscaleUser } from "../overview";

interface HeadscaleUserMenuProps {
  user: UnlinkedHeadscaleUser;
}

type Modal = "rename" | "delete" | null;

export default function HeadscaleUserMenu({ user }: HeadscaleUserMenuProps) {
  const [modal, setModal] = useState<Modal>(null);

  // Headscale-managed OIDC users cannot be renamed via the API.
  const canRename = user.provider !== "oidc";

  return (
    <>
      {modal === "rename" && canRename && (
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
          machines={user.machines}
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
          {canRename && <MenuItem onClick={() => setModal("rename")}>Rename</MenuItem>}
          {canRename && <MenuSeparator />}
          <MenuItem variant="danger" onClick={() => setModal("delete")}>
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>
    </>
  );
}
