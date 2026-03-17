import { useMemo, useState } from "react";

import Button from "~/components/button";
import Code from "~/components/code";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Select from "~/components/select";
import Text from "~/components/text";
import Title from "~/components/title";

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
            required
            label="Record Type"
            name="record_type"
            defaultValue={type}
            onValueChange={(v) => {
              if (v) setType(v as "A" | "AAAA");
            }}
            items={[
              { value: "A", label: "A" },
              { value: "AAAA", label: "AAAA" },
            ]}
          />
          <Input
            required
            label="Domain"
            placeholder="test.example.com"
            name="record_name"
            onChange={setName}
            invalid={isDuplicate}
          />
          <Input
            required
            label="IP Address"
            placeholder={type === "AAAA" ? "2001:db8::ff00:42:8329" : "101.101.101.101"}
            name="record_value"
            onChange={setIp}
            invalid={isDuplicate}
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
