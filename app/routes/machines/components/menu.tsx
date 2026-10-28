import { ChevronDown, Ellipsis, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { useHref } from "react-router";

import Button from "~/components/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/menu";
import type { User } from "~/types";
import cn from "~/utils/cn";
import { isNoExpiry, type PopulatedNode } from "~/utils/node-info";

import Delete from "../dialogs/delete";
import Expire from "../dialogs/expire";
import KeyExpiry from "../dialogs/key-expiry";
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
  policyTags?: string[];
  supportsNodeOwnerChange: boolean;
  supportsDisablingKeyExpiry: boolean;
}

type Modal = "rename" | "expire" | "remove" | "routes" | "move" | "tags" | "key-expiry" | null;

export default function MachineMenu({
  node,
  magic,
  users,
  isFullButton,
  isDisabled,
  existingTags,
  policyTags,
  supportsNodeOwnerChange,
  supportsDisablingKeyExpiry,
}: MenuProps) {
  const [modal, setModal] = useState<Modal>(null);
  const sshUrl = useHref(`/ssh/${node.givenName}`);
  const supportsTailscaleSSH = node.hostInfo?.sshHostKeys && node.hostInfo?.sshHostKeys.length > 0;

  return (
    <div className="flex items-center justify-end gap-1.5">
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
      {modal === "key-expiry" && (
        <KeyExpiry
          isOpen
          machine={node}
          setIsOpen={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
        />
      )}
      {modal === "tags" && (
        <Tags
          existingTags={existingTags}
          policyTags={policyTags}
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
            onClick={() => {
              // We need to use JS to open the SSH URL
              // in a new WINDOW since href can only
              // do a new TAB.
              window.open(sshUrl, "_blank", "noopener,noreferrer,width=800,height=600");
            }}
            variant="primary"
          >
            <SquareTerminal className="size-3.5" />
            SSH
          </Button>
        ) : (
          <Button
            className={cn(
              "opacity-0 pointer-events-none group-hover:opacity-100",
              "group-hover:pointer-events-auto",
            )}
            size="sm"

            onClick={() => {
              window.open(sshUrl, "_blank", "noopener,noreferrer,width=800,height=600");
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
              ? "border-line-strong bg-surface hover:bg-hover h-8 gap-x-1.5 rounded-md border px-3 text-sm font-medium"
              : "text-muted hover:bg-hover hover:text-fg size-7 rounded-md"
          }
        >
          {isFullButton ? (
            <>
              Manage
              <ChevronDown className="size-3.5" />
            </>
          ) : (
            <Ellipsis className="size-4" />
          )}
        </MenuTrigger>
        <MenuContent>
          <MenuItem onClick={() => setModal("rename")}>Edit machine name</MenuItem>
          {supportsDisablingKeyExpiry && (
            <MenuItem onClick={() => setModal("key-expiry")}>
              {isNoExpiry(node.expiry) ? "Enable" : "Disable"} key expiry
            </MenuItem>
          )}
          <MenuItem onClick={() => setModal("routes")}>Edit route settings</MenuItem>
          <MenuItem onClick={() => setModal("tags")}>Edit ACL tags</MenuItem>
          {supportsNodeOwnerChange && (
            <MenuItem onClick={() => setModal("move")}>Change owner</MenuItem>
          )}
          <MenuSeparator />
          {!isNoExpiry(node.expiry) && (
            <MenuItem variant="danger" disabled={node.expired} onClick={() => setModal("expire")}>
              Expire
            </MenuItem>
          )}
          <MenuItem variant="danger" onClick={() => setModal("remove")}>
            Remove
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
