import { Plus } from "lucide-react";
import { useState } from "react";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Input from "~/components/input";
import Select from "~/components/select";
import { fieldValidator } from "~/utils/form";

import { recordValue } from "../schemas";

const validators = {
  A: fieldValidator(recordValue.A),
  AAAA: fieldValidator(recordValue.AAAA),
};

export default function AddRecord() {
  const [type, setType] = useState<keyof typeof validators>("A");

  return (
    <ActionDialog
      description="Point a domain at an IP address for every device on the tailnet."
      intent="add_record"
      submitLabel="Add record"
      title="Add DNS record"
      trigger={
        <Button>
          <Plus className="size-3.5" />
          Add record
        </Button>
      }
    >
      <Select
        items={[
          { value: "A", label: "A" },
          { value: "AAAA", label: "AAAA" },
        ]}
        label="Type"
        name="type"
        onValueChange={(value) => {
          if (value === "A" || value === "AAAA") setType(value);
        }}
        required
        value={type}
      />
      <Input label="Domain" name="name" placeholder="test.example.com" required />
      <Input
        key={type}
        label="IP address"
        name="value"
        placeholder={type === "AAAA" ? "2001:db8::ff00:42:8329" : "100.100.100.100"}
        required
        validate={validators[type]}
      />
    </ActionDialog>
  );
}
