import { Ellipsis } from "lucide-react";
import { useState } from "react";

import Menu from "~/components/Menu";
import type { Machine, User } from "~/types";
import cn from "~/utils/cn";

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

      <Menu disabledKeys={disabledKeys}>
        <Menu.IconButton
          className={cn(
            "w-10 border-transparent bg-transparent py-0.5",
            "border group-hover:border-headplane-200",
            "dark:group-hover:border-headplane-700",
          )}
          label="User Options"
        >
          <Ellipsis className="h-5" />
        </Menu.IconButton>
        <Menu.Panel onAction={(key) => setModal(key as Modal)}>
          <Menu.Section>
            <Menu.Item key="rename">Rename user</Menu.Item>
            <Menu.Item key="reassign">Change role</Menu.Item>
            <Menu.Item key="link">Link Headscale user</Menu.Item>
            <Menu.Item key="delete" textValue="Delete">
              <p className="text-red-500 dark:text-red-400">Delete</p>
            </Menu.Item>
          </Menu.Section>
        </Menu.Panel>
      </Menu>
    </>
  );
}
