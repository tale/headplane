import ActionDialog from "~/components/action-dialog";
import Code from "~/components/code";
import Link from "~/components/link";
import Section, { RemoveButton, Row, RowList } from "~/components/section";

import AddRecord from "../dialogs/add-record";

interface Props {
  records: { name: string; type: "A" | string; value: string }[];
  hasRecordsFile: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
}

export default function ManageRecords({ records, hasRecordsFile, isDisabled, isReadOnly }: Props) {
  const isLocked = isDisabled || isReadOnly;

  return (
    <Section
      action={isLocked ? undefined : <AddRecord />}
      description={
        <>
          Point a name at an address for every device on the tailnet. Headscale supports A and AAAA
          records.{" "}
          <Link external styled to="https://headscale.net/stable/ref/dns">
            Docs
          </Link>
          {!isDisabled && isReadOnly && hasRecordsFile && (
            <>
              {" "}
              To edit records here, give Headplane write access to the file at{" "}
              <Code>dns.extra_records_path</Code>.
            </>
          )}
          {!isDisabled && isReadOnly && !hasRecordsFile && (
            <>
              {" "}
              To edit records here, move them from <Code>dns.extra_records</Code> into a JSON file
              set as <Code>dns.extra_records_path</Code>.
            </>
          )}
        </>
      }
      title="DNS records"
    >
      {records.length === 0 ? (
        <p className="text-muted py-2.5 text-sm">No DNS records</p>
      ) : (
        <RowList>
          {records.map((record) => (
            <Row
              action={
                <ActionDialog
                  description="Devices stop resolving this name to the record's address."
                  fields={{ name: record.name, type: record.type }}
                  intent="remove_record"
                  isDestructive
                  submitLabel="Remove"
                  title={`Remove the ${record.type} record for ${record.name}?`}
                  trigger={<RemoveButton disabled={isLocked} />}
                />
              }
              key={`${record.name}-${record.type}-${record.value}`}
            >
              <span className="grid grid-cols-1 gap-x-4 font-mono text-xs sm:grid-cols-2">
                <span className="break-all">{record.name}</span>
                <span className="break-all">
                  <span className="text-muted mr-2 inline-block w-8">{record.type}</span>
                  {record.value}
                </span>
              </span>
            </Row>
          ))}
        </RowList>
      )}
    </Section>
  );
}
