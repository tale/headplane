import ActionDialog from "~/components/action-dialog";
import Chip from "~/components/chip";
import Link from "~/components/link";

import AddNS from "../dialogs/add-ns";
import Section, { RemoveButton, Row, RowList } from "./section";

interface Props {
  global: string[];
  split: Record<string, string[]>;
  isDisabled: boolean;
}

export default function ManageNS({ global, split, isDisabled }: Props) {
  const rows = [
    ...global.map((ns) => ({ ns, domain: undefined })),
    ...Object.entries(split).flatMap(([domain, list]) => list.map((ns) => ({ ns, domain }))),
  ];

  return (
    <Section
      action={isDisabled ? undefined : <AddNS />}
      description={
        <>
          The servers devices use to resolve names outside the tailnet. A server marked with a
          domain only answers for that domain.{" "}
          <Link external styled to="https://tailscale.com/kb/1054/dns">
            Docs
          </Link>
        </>
      }
      title="Nameservers"
    >
      {rows.length === 0 ? (
        <p className="text-muted py-2.5 text-sm">
          No nameservers. Devices use their own DNS settings.
        </p>
      ) : (
        <RowList>
          {rows.map(({ ns, domain }) => (
            <Row
              action={
                <ActionDialog
                  description={
                    domain
                      ? `Devices stop using this nameserver for ${domain}.`
                      : "Devices stop using this nameserver for queries outside the tailnet."
                  }
                  fields={domain ? { nameserver: ns, split_domain: domain } : { nameserver: ns }}
                  intent="remove_ns"
                  isDestructive
                  submitLabel="Remove"
                  title={`Remove nameserver ${ns}?`}
                  trigger={<RemoveButton disabled={isDisabled} />}
                />
              }
              key={`${domain ?? ""}/${ns}`}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs break-all">{ns}</span>
                {domain && <Chip text={domain} />}
              </span>
            </Row>
          ))}
        </RowList>
      )}
    </Section>
  );
}
