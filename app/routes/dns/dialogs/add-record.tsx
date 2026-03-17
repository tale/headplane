import { useMemo, useState } from "react";

import Button from "~/components/button";
import Code from "~/components/Code";
import Dialog, { DialogPanel } from "~/components/Dialog";
import Input from "~/components/Input";
import Select from "~/components/Select";
import Text from "~/components/Text";
import Title from "~/components/Title";

interface Props {
  records: { name: string; type: "A" | "AAAA" | string; value: string }[];
}

export default function AddRecord({ records }: Props) {
  const [type, setType] = useState<"A" | "AAAA" | string>("A");
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");

  const isDuplicate = useMemo(() => {
    if (name.length === 0 || ip.length === 0) return false;
    const lookup = records.find((record) => record.name === name);
    if (!lookup) return false;

    return lookup.value === ip;
  }, [records, name, ip]);

  return (
    <Dialog>
      <Button>Add DNS record</Button>
      <DialogPanel
        onSubmit={() => {
          setName("");
          setIp("");
        }}
      >
        <Title>Add DNS record</Title>
        <Text>Enter the domain and IP address for the new DNS record.</Text>
        <div className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="action_id" value="add_record" />
          <Select
            isRequired
            label="Record Type"
            name="record_type"
            defaultInputValue={type}
            onSelectionChange={(v) => {
              if (v) setType(v.toString() as "A" | "AAAA");
            }}
          >
            <Select.Item key="A">A</Select.Item>
            <Select.Item key="AAAA">AAAA</Select.Item>
          </Select>
          <Input
            isRequired
            label="Domain"
            placeholder="test.example.com"
            name="record_name"
            onChange={setName}
            isInvalid={isDuplicate}
          />
          <Input
            isRequired
            label="IP Address"
            placeholder={type === "AAAA" ? "2001:db8::ff00:42:8329" : "101.101.101.101"}
            name="record_value"
            onChange={setIp}
            isInvalid={isDuplicate}
          />
          {isDuplicate ? (
            <p className="text-sm opacity-50">
              A record with the domain name <Code>{name}</Code> and IP address <Code>{ip}</Code>{" "}
              already exists.
            </p>
          ) : undefined}
        </div>
      </DialogPanel>
    </Dialog>
  );
}
