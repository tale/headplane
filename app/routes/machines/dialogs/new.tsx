import { Computer, FileKey2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import Code from "~/components/Code";
import Dialog, { DialogPanel } from "~/components/Dialog";
import Input from "~/components/Input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "~/components/menu";
import Select from "~/components/Select";
import Text from "~/components/Text";
import Title from "~/components/Title";
import type { User } from "~/types";
import { getUserDisplayName } from "~/utils/user";

export interface NewMachineProps {
  server: string;
  users: User[];
  isDisabled?: boolean;
  disabledKeys?: string[];
}

export default function NewMachine(data: NewMachineProps) {
  const [pushDialog, setPushDialog] = useState(false);
  const [mkey, setMkey] = useState("");
  const navigate = useNavigate();

  const isMkeyInvalid = mkey.length > 0 && mkey.length !== 24;

  return (
    <>
      <Dialog isOpen={pushDialog} onOpenChange={setPushDialog}>
        <DialogPanel isDisabled={mkey.length !== 24}>
          <Title>Register Machine Key</Title>
          <Text className="mb-4">
            The machine key is given when you run{" "}
            <Code isCopyable>tailscale up --login-server={data.server}</Code> on your device.
          </Text>
          <input name="action_id" type="hidden" value="register" />
          <Input
            errorMessage="Machine key must be exactly 24 characters"
            isInvalid={isMkeyInvalid}
            isRequired
            label="Machine Key"
            name="register_key"
            onChange={setMkey}
            placeholder="AbCd..."
            validationBehavior="native"
          />
          <Select isRequired label="Owner" name="user" placeholder="Select a user">
            {data.users.map((user) => (
              <Select.Item key={user.id}>{getUserDisplayName(user)}</Select.Item>
            ))}
          </Select>
        </DialogPanel>
      </Dialog>
      <Menu disabled={data.isDisabled}>
        <MenuTrigger className="rounded-md bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-500/90 dark:bg-indigo-500/90 dark:hover:bg-indigo-500/80">
          Add Device
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            disabled={data.disabledKeys?.includes("register")}
            onClick={() => setPushDialog(true)}
          >
            <div className="flex items-center gap-x-3">
              <Computer className="w-4" />
              Register Machine Key
            </div>
          </MenuItem>
          <MenuItem
            disabled={data.disabledKeys?.includes("pre-auth")}
            onClick={() => navigate("/settings/auth-keys")}
          >
            <div className="flex items-center gap-x-3">
              <FileKey2 className="w-4" />
              Generate Pre-auth Key
            </div>
          </MenuItem>
        </MenuContent>
      </Menu>
    </>
  );
}
