import { Split } from "lucide-react";
import { useMemo, useState } from "react";

import Button from "~/components/button";
import Chip from "~/components/Chip";
import Dialog, { DialogPanel } from "~/components/Dialog";
import Input from "~/components/Input";
import Switch from "~/components/Switch";
import Text from "~/components/Text";
import Title from "~/components/Title";
import Tooltip from "~/components/Tooltip";
import cn from "~/utils/cn";

interface Props {
  nameservers: Record<string, string[]>;
}

export default function AddNameserver({ nameservers }: Props) {
  const [split, setSplit] = useState(false);
  const [ns, setNs] = useState("");
  const [domain, setDomain] = useState("");

  const isInvalid = useMemo(() => {
    if (ns === "") return false;
    // Test if it's a valid IPv4 or IPv6 address
    const ipv4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    const ipv6 = /^([0-9a-fA-F:]+:+)+[0-9a-fA-F]+$/;
    if (!ipv4.test(ns) && !ipv6.test(ns)) return true;

    if (split) {
      return nameservers[domain]?.includes(ns);
    }

    return Object.values(nameservers).some((nsList) => nsList.includes(ns));
  }, [nameservers, ns]);

  return (
    <Dialog>
      <Button>Add nameserver</Button>
      <DialogPanel>
        <Title className="mb-4">Add nameserver</Title>
        <input name="action_id" type="hidden" value="add_ns" />
        <Input
          description="Use this IPv4 or IPv6 address to resolve names."
          isInvalid={isInvalid}
          isRequired
          label="Nameserver"
          name="ns"
          onChange={setNs}
          placeholder="1.2.3.4"
        />
        <div className="mt-8 flex items-center justify-between">
          <div className="block">
            <div className="inline-flex items-center gap-2">
              <Text className="font-semibold">Restrict to domain</Text>
              <Tooltip>
                <Chip
                  className={cn("inline-flex items-center")}
                  leftIcon={<Split className="mr-0.5 h-3 w-3" />}
                  text="Split DNS"
                />
                <Tooltip.Body>
                  Only clients that support split DNS (Tailscale v1.8 or later for most platforms)
                  will use this nameserver. Older clients will ignore it.
                </Tooltip.Body>
              </Tooltip>
            </div>
            <Text className="text-sm">This nameserver will only be used for some domains.</Text>
          </div>
          <Switch label="Split DNS" onChange={setSplit} />
        </div>
        {split ? (
          <>
            <Text className="mt-8 font-semibold">Domain</Text>
            <Input
              isRequired={split === true}
              label="Domain"
              name="split_name"
              onChange={setDomain}
              placeholder="example.com"
            />
            <Text className="text-sm">
              Only single-label or fully-qualified queries matching this suffix should use the
              nameserver.
            </Text>
          </>
        ) : (
          <input name="split_name" type="hidden" value="global" />
        )}
      </DialogPanel>
    </Dialog>
  );
}
