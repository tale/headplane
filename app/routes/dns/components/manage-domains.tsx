import ActionDialog from "~/components/action-dialog";
import Callout from "~/components/callout";
import Section, { RemoveButton, Row, RowList } from "~/components/section";

import AddDomain from "../dialogs/add-domain";
import { useReorder } from "./reorder";

interface Props {
  searchDomains: string[];
  isDisabled: boolean;
  magic?: string;
}

export default function ManageDomains({ searchDomains, isDisabled, magic }: Props) {
  const reorder = useReorder("move_domain", "domain");
  const domains = reorder.order(searchDomains);

  return (
    <Section
      action={isDisabled ? undefined : <AddDomain />}
      description="Devices try these suffixes, in order, when resolving a short name. With Magic DNS on, your tailnet domain always comes first."
      title="Search domains"
    >
      {reorder.error && (
        <Callout className="mb-3" variant="error">
          {reorder.error}
        </Callout>
      )}
      {!magic && domains.length === 0 ? (
        <p className="text-muted py-2.5 text-sm">No search domains</p>
      ) : (
        <RowList>
          {magic && (
            <Row action={<span className="text-muted px-2">Magic DNS</span>}>
              <span className="font-mono text-xs break-all">{magic}</span>
            </Row>
          )}
          {domains.map((domain, index) => (
            <Row
              action={
                <div className="flex items-center gap-1">
                  {!isDisabled && reorder.controls(domains, index)}
                  <ActionDialog
                    description="Devices stop trying this suffix on short names."
                    fields={{ domain }}
                    intent="remove_domain"
                    isDestructive
                    submitLabel="Remove"
                    title={`Remove search domain ${domain}?`}
                    trigger={<RemoveButton disabled={isDisabled} />}
                  />
                </div>
              }
              className="group/row"
              key={domain}
            >
              <span className="font-mono text-xs break-all">{domain}</span>
            </Row>
          ))}
        </RowList>
      )}
    </Section>
  );
}
