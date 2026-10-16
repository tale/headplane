import { useState } from "react";

import ActionDialog from "~/components/action-dialog";
import Link from "~/components/link";
import RadioGroup from "~/components/radio-group";
import { Roles } from "~/server/web/roles";
import type { Role } from "~/server/web/roles";

interface ReassignProps {
  headplaneUserId: string;
  displayName: string;
  role: Role;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function ReassignUser({
  headplaneUserId,
  displayName,
  role,
  isOpen,
  setIsOpen,
}: ReassignProps) {
  const [selected, setSelected] = useState<string>(role);

  return (
    <ActionDialog
      description={
        <>
          Roles decide what the user can access in Headplane.{" "}
          <Link external styled to="https://tailscale.com/kb/1138/user-roles">
            Docs
          </Link>
        </>
      }
      fields={{ headplane_user_id: headplaneUserId }}
      intent="reassign"
      isDisabled={selected === role}
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Change role"
      title={`Change role for ${displayName}`}
    >
      <RadioGroup
        className="gap-4"
        label="Role"
        name="role"
        onValueChange={setSelected}
        value={selected}
      >
        {Object.keys(Roles)
          .filter((r) => r !== "owner")
          .map((r) => {
            const { name, desc } = mapRoleToName(r);
            return (
              <RadioGroup.Radio key={r} label={name} value={r}>
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-muted">{desc}</p>
                </div>
              </RadioGroup.Radio>
            );
          })}
      </RadioGroup>
    </ActionDialog>
  );
}

function mapRoleToName(role: string) {
  switch (role) {
    case "admin":
      return {
        name: "Admin",
        desc: "Can view the admin console, manage network, machine, and user settings.",
      };
    case "network_admin":
      return {
        name: "Network Admin",
        desc: "Can view the admin console and manage ACLs and network settings. Cannot manage machines or users.",
      };
    case "it_admin":
      return {
        name: "IT Admin",
        desc: "Can view the admin console and manage machines and users. Cannot manage ACLs or network settings.",
      };
    case "auditor":
      return {
        name: "Auditor",
        desc: "Can view the admin console.",
      };
    case "viewer":
      return {
        name: "Viewer",
        desc: "Can view machines, users, and generate their own auth keys.",
      };
    case "member":
      return {
        name: "Member",
        desc: "Cannot view the admin console.",
      };
    default:
      return {
        name: role,
        desc: "No description available.",
      };
  }
}
