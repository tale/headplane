import React from "react";

import cn from "~/utils/cn";

function Card(props: React.HTMLProps<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "w-full max-w-md rounded-lg p-5",
        "bg-surface",
        "border border-line",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export default Card;
