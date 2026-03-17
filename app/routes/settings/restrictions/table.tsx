import { GlobeLock, Group, User2 } from "lucide-react";
import React from "react";
import { Form } from "react-router";

import Button from "~/components/button";
import TableList from "~/components/table-list";
import cn from "~/utils/cn";

interface RestrictionProps {
  children: React.ReactNode;
  type: "domain" | "group" | "user";
  values: string[];
  isDisabled?: boolean;
}

export default function RestrictionTable({ children, type, values, isDisabled }: RestrictionProps) {
  return (
    <div className="w-full sm:w-2/3">
      <h2 className="mt-8 text-2xl font-medium">
        Permitted {type.charAt(0).toUpperCase() + type.slice(1)}s
      </h2>
      <TableList className="my-4">
        {values.length > 0 ? (
          values.map((value) => (
            <TableList.Item key={`${type}-${value}`}>
              {type === "domain" ? (
                <p>
                  <span className="text-mist-600 dark:text-mist-300">{"<user>"}</span>
                  <span className="font-bold">@</span>
                  <span>{value}</span>
                </p>
              ) : (
                <p>{value}</p>
              )}
              <Form method="POST">
                <input name="action_id" type="hidden" value={`remove_${type}`} />
                <input name={type} type="hidden" value={value} />
                <Button
                  className={cn("px-2 py-1 rounded-md", "text-red-500 dark:text-red-400")}
                  disabled={isDisabled}
                  type="submit"
                >
                  Remove
                </Button>
              </Form>
            </TableList.Item>
          ))
        ) : (
          <TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
            {iconForType(type)}
            <p className="text-center font-semibold">All {type}s are permitted to authenticate.</p>
          </TableList.Item>
        )}
      </TableList>
      {children}
    </div>
  );
}

function iconForType(type: "domain" | "group" | "user") {
  if (type === "domain") {
    return <GlobeLock />;
  }

  if (type === "group") {
    return <Group />;
  }

  return <User2 />;
}
