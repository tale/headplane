import Dialog, { DialogPanel } from "~/components/dialog";
import Link from "~/components/link";
import Notice from "~/components/notice";
import RadioGroup from "~/components/radio-group";
import Text from "~/components/text";
import Title from "~/components/title";
import { Roles } from "~/server/web/roles";
import type { Role } from "~/server/web/roles";

interface ReassignProps {
  userId: string;
  displayName: string;
  role: Role;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function ReassignUser({
  userId,
  displayName,
  role,
  isOpen,
  setIsOpen,
}: ReassignProps) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel variant={role === "owner" ? "unactionable" : "normal"}>
        <Title>Change role for {displayName}?</Title>
        <Text className="mb-6">
          Roles control what the user can access in Headplane. Each role grants a specific set of
          capabilities.{" "}
          <Link external styled to="https://tailscale.com/kb/1138/user-roles">
            Learn More
          </Link>
        </Text>
        {role === "owner" ? (
          <Notice>The Tailnet owner cannot be reassigned.</Notice>
        ) : (
          <>
            <input name="action_id" type="hidden" value="reassign_user" />
            <input name="user_id" type="hidden" value={userId} />
            <RadioGroup className="gap-4" defaultValue={role} label="Role" name="new_role">
              {Object.keys(Roles)
                .filter((r) => r !== "owner")
                .map((r) => {
                  const { name, desc } = mapRoleToName(r);
                  return (
                    <RadioGroup.Radio key={r} label={name} value={r}>
                      <div className="block">
                        <p className="font-bold">{name}</p>
                        <p className="opacity-70">{desc}</p>
                      </div>
                    </RadioGroup.Radio>
                  );
                })}
            </RadioGroup>
          </>
        )}
      </DialogPanel>
    </Dialog>
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
