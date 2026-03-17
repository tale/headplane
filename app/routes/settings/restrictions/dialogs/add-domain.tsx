import { useMemo, useState } from "react";

import Button from "~/components/button";
import Dialog, { DialogPanel } from "~/components/Dialog";
import Input from "~/components/Input";
import Text from "~/components/Text";
import Title from "~/components/Title";

interface AddDomainProps {
  domains: string[];
  isDisabled?: boolean;
}

export default function AddDomain({ domains, isDisabled }: AddDomainProps) {
  const [domain, setDomain] = useState("");

  const isInvalid = useMemo(() => {
    if (!domain || domain.trim().length === 0) {
      // Empty domain is invalid, but no error shown
      return false;
    }

    if (domains.includes(domain.trim())) {
      return true;
    }

    try {
      // Check if domain is a valid FQDN
      const url = new URL(`http://${domain.trim()}`);
      return url.hostname !== domain.trim();
    } catch (e) {
      // If URL constructor fails, it's not a valid domain
      return true;
    }
  }, [domain, domains]);

  return (
    <Dialog>
      <Button isDisabled={isDisabled}>Add domain</Button>
      <DialogPanel>
        <Title>Add domain</Title>
        <Text className="mb-4">
          Add this domain to a list of allowed email domains that can authenticate with Headscale
          via OIDC.
        </Text>
        <input name="action_id" type="hidden" value="add_domain" />
        <Input
          description={
            domain.trim().length > 0
              ? `Matches users with <user>@${domain.trim()}`
              : "Enter a domain to match users with their email addresses."
          }
          isInvalid={domain.trim().length === 0 || isInvalid}
          isRequired
          label="Domain"
          name="domain"
          onChange={setDomain}
          placeholder="example.com"
        />
        {isInvalid && (
          <p className="mt-2 text-sm text-red-500">
            The domain you entered is invalid or already exists in the list.
          </p>
        )}
      </DialogPanel>
    </Dialog>
  );
}
