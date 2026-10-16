import type { HTMLProps } from "react";

import cn from "~/utils/cn";

function List(props: HTMLProps<HTMLDivElement>) {
  return (
    <div {...props} className={cn("rounded-lg", "border border-line", props.className)}>
      {props.children}
    </div>
  );
}

function Item(props: HTMLProps<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 last:border-b-0",
        "border-b border-line",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export default Object.assign(List, { Item });
