import type { HTMLProps } from "react";

import cn from "~/utils/cn";

function TableList(props: HTMLProps<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("rounded-lg", "border border-mist-200 dark:border-mist-800", props.className)}
    >
      {props.children}
    </div>
  );
}

function Item(props: HTMLProps<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "flex items-center justify-between p-2 last:border-b-0",
        "border-b border-mist-200 dark:border-mist-800",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export default Object.assign(TableList, { Item });
