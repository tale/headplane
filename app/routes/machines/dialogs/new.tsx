import { type } from "arktype";
import { Computer, FileKey2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import CodeBlock from "~/components/code-block";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "~/components/menu";
import Select from "~/components/select";
import Text from "~/components/text";
import Title from "~/components/title";
import { useForm } from "~/hooks/use-form";
import type { User } from "~/types";
import { getUserDisplayName } from "~/utils/user";

const registerSchema = type({
  register_key: "string == 24",
  user: "string > 0",
});

export interface NewMachineProps {
  server: string;
  users: User[];
  isDisabled?: boolean;
  disabledKeys?: string[];
}

export default function NewMachine(data: NewMachineProps) {
  const [pushDialog, setPushDialog] = useState(false);
  const form = useForm({ schema: registerSchema });
  const navigate = useNavigate();

  return (
    <>
      <Dialog isOpen={pushDialog} onOpenChange={setPushDialog}>
        <DialogPanel isDisabled={!form.canSubmit}>
          <Title>Register Machine Key</Title>
          <Text>The machine key is given when you run the following command on your device:</Text>
          <CodeBlock className="mb-4">{`tailscale up --login-server=${data.server}`}</CodeBlock>
          <input name="action_id" type="hidden" value="register" />
          <Input
            {...form.field("register_key")}
            required
            label="Machine Key"
            placeholder="AbCd..."
          />
          <Select
            required
            label="Owner"
            name="user"
            onValueChange={(v) => form.setValue("user", v)}
            placeholder="Select a user"
            items={data.users.map((user) => ({
              value: user.id,
              label: getUserDisplayName(user),
            }))}
          />
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
