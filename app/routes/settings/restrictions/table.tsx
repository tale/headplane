import { GlobeLock, Group, User2 } from "lucide-react";
import type React from "react";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import List from "~/components/list";

import type { RestrictionType } from "./schemas";

interface RestrictionProps {
  children: React.ReactNode;
  type: RestrictionType;
  values: string[];
  isDisabled?: boolean;
}

export default function RestrictionTable({ children, type, values, isDisabled }: RestrictionProps) {
  return (
    <div className="w-full sm:w-2/3">
      <h2 className="mt-8 text-xl font-semibold">
        Permitted {type.charAt(0).toUpperCase() + type.slice(1)}s
      </h2>
      <List className="my-4">
        {values.length > 0 ? (
          values.map((value) => (
            <List.Item key={`${type}-${value}`}>
              {type === "domain" ? (
                <p>
                  <span className="text-muted">{"<user>"}</span>
                  <span className="font-semibold">@</span>
                  <span>{value}</span>
                </p>
              ) : (
                <p>{value}</p>
              )}
              <ActionDialog
                description={`Only the remaining ${type}s can sign in. If none are left, every ${type} can.`}
                fields={{ type, value }}
                intent="remove"
                isDestructive
                submitLabel="Remove"
                title={`Remove ${value}?`}
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
        ) : (
          <List.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
            {iconForType(type)}
            <p className="text-center font-semibold">All {type}s are permitted to authenticate.</p>
          </List.Item>
        )}
      </List>
      {children}
    </div>
  );
}

function iconForType(type: RestrictionType) {
  if (type === "domain") {
    return <GlobeLock />;
  }

  if (type === "group") {
    return <Group />;
  }

  return <User2 />;
}
