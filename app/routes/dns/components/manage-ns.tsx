import ActionDialog from "~/components/action-dialog";
import Callout from "~/components/callout";
import Chip from "~/components/chip";
import Link from "~/components/link";
import Section, { RemoveButton, Row, RowList } from "~/components/section";

import AddNS from "../dialogs/add-ns";
import { useReorder } from "./reorder";

interface Props {
  global: string[];
  split: Record<string, string[]>;
  isDisabled: boolean;
}

export default function ManageNS({ global, split, isDisabled }: Props) {
  const reorder = useReorder("move_ns", "nameserver");

  // Global servers come first, then each split domain's servers. Order only
  // matters within a list, so each one moves on its own.
  const groups = [
    { domain: undefined, list: reorder.order(global, { split_domain: "" }) },
    ...Object.entries(split).map(([domain, list]) => ({
      domain,
      list: reorder.order(list, { split_domain: domain }),
    })),
  ];
  const rows = groups.flatMap(({ domain, list }) =>
    list.map((ns, index) => ({ ns, domain, list, index })),
  );

  return (
    <Section
      action={isDisabled ? undefined : <AddNS />}
      description={
        <>
          The servers devices use for names outside the tailnet, preferring ones higher in the list.
          A server marked with a domain only answers for that domain.{" "}
          <Link external styled to="https://tailscale.com/kb/1054/dns">
            Docs
          </Link>
        </>
      }
      title="Nameservers"
    >
      {reorder.error && (
        <Callout className="mb-3" variant="error">
          {reorder.error}
        </Callout>
      )}
      {rows.length === 0 ? (
        <p className="text-muted py-2.5 text-sm">
          No nameservers. Devices use their own DNS settings.
        </p>
      ) : (
        <RowList>
          {rows.map(({ ns, domain, list, index }) => (
            <Row
              action={
                <div className="flex items-center gap-1">
                  {!isDisabled &&
                    list.length > 1 &&
                    reorder.controls(list, index, { split_domain: domain ?? "" })}
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
                </div>
              }
              className="group/row"
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
