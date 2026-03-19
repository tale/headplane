import { type } from "arktype";

import Button from "~/components/button";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Text from "~/components/text";
import Title from "~/components/title";
import { useForm } from "~/hooks/use-form";

const domainSchema = type({
  domain: "string > 0",
});

interface AddDomainProps {
  domains: string[];
  isDisabled?: boolean;
}

export default function AddDomain({ domains, isDisabled }: AddDomainProps) {
  const form = useForm({
    schema: domainSchema,
    validate: (values) => {
      const domain = (values.domain as string).trim();
      if (domain.length === 0) return undefined;

      if (domains.includes(domain)) {
        return { domain: "This domain already exists in the list." };
      }

      try {
        const url = new URL(`http://${domain}`);
        if (url.hostname !== domain) {
          return { domain: "This is not a valid domain." };
        }
      } catch {
        return { domain: "This is not a valid domain." };
      }

      return undefined;
    },
  });
  const domain = (form.values.domain as string).trim();

  return (
    <Dialog>
      <Button disabled={isDisabled}>Add domain</Button>
      <DialogPanel>
        <Title>Add domain</Title>
        <Text className="mb-4">
          Add this domain to a list of allowed email domains that can authenticate with Headscale
          via OIDC.
        </Text>
        <input name="action_id" type="hidden" value="add_domain" />
        <Input
          {...form.field("domain")}
          description={
            domain.length > 0
              ? `Matches users with <user>@${domain}`
              : "Enter a domain to match users with their email addresses."
          }
          required
          label="Domain"
          placeholder="example.com"
        />
      </DialogPanel>
    </Dialog>
  );
}
