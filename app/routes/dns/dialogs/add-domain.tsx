import { Plus } from "lucide-react";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Input from "~/components/input";

export default function AddDomain() {
  return (
    <ActionDialog
      description="Devices try this suffix when resolving a short name."
      intent="add_domain"
      submitLabel="Add domain"
      title="Add search domain"
      trigger={
        <Button>
          <Plus className="size-3.5" />
          Add domain
        </Button>
      }
    >
      <Input label="Domain" name="domain" placeholder="corp.example.com" required />
    </ActionDialog>
  );
}
