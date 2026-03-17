import { Cog, Ellipsis, SquareTerminal } from "lucide-react";
import { useState } from "react";

import Button from "~/components/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/menu";
import type { User } from "~/types";
import cn from "~/utils/cn";
import { PopulatedNode } from "~/utils/node-info";

import Delete from "../dialogs/delete";
import Expire from "../dialogs/expire";
import Move from "../dialogs/move";
import Rename from "../dialogs/rename";
import Routes from "../dialogs/routes";
import Tags from "../dialogs/tags";

interface MenuProps {
  node: PopulatedNode;
  users: User[];
  magic?: string;
  isFullButton?: boolean;
  isDisabled?: boolean;
  existingTags?: string[];
  supportsNodeOwnerChange: boolean;
}

type Modal = "rename" | "expire" | "remove" | "routes" | "move" | "tags" | null;

export default function MachineMenu({
  node,
  magic,
  users,
  isFullButton,
  isDisabled,
  existingTags,
  supportsNodeOwnerChange,
}: MenuProps) {
  const [modal, setModal] = useState<Modal>(null);
  const supportsTailscaleSSH = node.hostInfo?.sshHostKeys && node.hostInfo?.sshHostKeys.length > 0;

  return (
    <div className="flex items-center justify-end gap-1.5 px-4">
      {modal === "remove" && (
        <Delete
          isOpen={modal === "remove"}
          machine={node}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
        />
      )}
      {modal === "move" && (
        <Move
          isOpen={modal === "move"}
          machine={node}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
          users={users}
        />
      )}
      {modal === "rename" && (
        <Rename
          isOpen={modal === "rename"}
          machine={node}
          magic={magic}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
        />
      )}
      {modal === "routes" && (
        <Routes
          isOpen={modal === "routes"}
          node={node}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
        />
      )}
      {modal === "tags" && (
        <Tags
          existingTags={existingTags}
          isOpen={modal === "tags"}
          machine={node}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
        />
      )}
      {node.expired && modal === "expire" ? undefined : (
        <Expire
          isOpen={modal === "expire"}
          machine={node}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
        />
      )}

      {supportsTailscaleSSH ? (
        isFullButton ? (
          <Button
            className="flex items-center gap-x-2"
            onClick={() => {
              // We need to use JS to open the SSH URL
              // in a new WINDOW since href can only
              // do a new TAB.
              window.open(
                `${__PREFIX__}/ssh?hostname=${node.givenName}`,
                "_blank",
                "noopener,noreferrer,width=800,height=600",
              );
            }}
            variant="heavy"
          >
            <SquareTerminal className="h-5" />
            <p>SSH</p>
          </Button>
        ) : (
          <Button
            className={cn(
              "py-0.5",
              "opacity-0 pointer-events-none group-hover:opacity-100",
              "group-hover:pointer-events-auto",
            )}
            variant="ghost"
            onClick={() => {
              // We need to use JS to open the SSH URL
              // in a new WINDOW since href can only
              // do a new TAB.
              window.open(
                `${__PREFIX__}/ssh?hostname=${node.givenName}`,
                "_blank",
                "noopener,noreferrer,width=800,height=600",
              );
            }}
          >
            SSH
          </Button>
        )
      ) : undefined}
      <Menu disabled={isDisabled}>
        <MenuTrigger
          className={
            isFullButton
              ? "gap-x-2 rounded-md border border-mist-200 bg-white px-3.5 py-2 text-sm font-medium hover:bg-mist-50 dark:border-mist-700 dark:bg-mist-800/50 dark:hover:bg-mist-700/50"
              : "w-10 rounded-full bg-transparent p-1 hover:bg-mist-100 dark:hover:bg-mist-800"
          }
        >
          {isFullButton ? (
            <>
              <Cog className="h-5" />
              <p>Machine Settings</p>
            </>
          ) : (
            <Ellipsis className="h-5" />
          )}
        </MenuTrigger>
        <MenuContent>
          <MenuItem onClick={() => setModal("rename")}>Edit machine name</MenuItem>
          <MenuItem onClick={() => setModal("routes")}>Edit route settings</MenuItem>
          <MenuItem onClick={() => setModal("tags")}>Edit ACL tags</MenuItem>
          {supportsNodeOwnerChange && (
            <MenuItem onClick={() => setModal("move")}>Change owner</MenuItem>
          )}
          <MenuSeparator />
          <MenuItem variant="danger" disabled={node.expired} onClick={() => setModal("expire")}>
            Expire
          </MenuItem>
          <MenuItem variant="danger" onClick={() => setModal("remove")}>
            Remove
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
