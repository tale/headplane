import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Code from "~/components/code";
import Link from "~/components/link";
import List from "~/components/list";
import cn from "~/utils/cn";

import AddRecord from "../dialogs/add-record";

interface Props {
  records: { name: string; type: "A" | string; value: string }[];
  isDisabled: boolean;
}

export default function ManageRecords({ records, isDisabled }: Props) {
  return (
    <div className="flex w-full flex-col sm:w-2/3">
      <h2 className="mb-4 text-lg font-semibold">DNS Records</h2>
      <p>
        Headscale supports adding custom DNS records to your Tailnet. As of now, only <Code>A</Code>{" "}
        and <Code>AAAA</Code> records are supported.{" "}
        <Link external styled to="https://headscale.net/stable/ref/dns">
          Learn More
        </Link>
      </p>
      <div className="mt-4">
        <List className="mb-8">
          {records.length === 0 ? (
            <List.Item>
              <p className="mx-auto opacity-50">No DNS records found</p>
            </List.Item>
          ) : (
            records.map((record) => (
              <List.Item key={`${record.name}-${record.value}`}>
                <div className="flex w-full items-center gap-2">
                  <p
                    className={cn(
                      "font-mono text-sm font-semibold py-1 px-2 rounded-md text-center",
                      "bg-subtle min-w-12",
                    )}
                  >
                    {record.type}
                  </p>
                  <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:gap-2">
                    <p className="truncate font-mono text-sm">{record.name}</p>
                    <p className="truncate font-mono text-sm opacity-70 sm:opacity-100">
                      {record.value}
                    </p>
                  </div>
                </div>
                <ActionDialog
                  description="Devices stop resolving this domain to the record's address."
                  fields={{ name: record.name, type: record.type }}
                  intent="remove_record"
                  isDestructive
                  submitLabel="Remove"
                  title={`Remove the ${record.type} record for ${record.name}?`}
                  trigger={
                    <Button
                      className="text-bad hover:bg-bad-subtle hover:text-bad"
                      disabled={isDisabled}
                      size="sm"
                      variant="ghost"
                    >
                      Remove
                    </Button>
                  }
                />
              </List.Item>
            ))
          )}
        </List>

        {isDisabled ? undefined : <AddRecord />}
      </div>
    </div>
  );
}
