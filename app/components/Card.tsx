import React from "react";

import Text from "~/components/Text";
import Title from "~/components/Title";
import cn from "~/utils/cn";

interface Props extends React.HTMLProps<HTMLDivElement> {
  variant?: "raised" | "flat";
}

function Card({ variant = "raised", ...props }: Props) {
  return (
    <div
      {...props}
      className={cn(
        "w-full max-w-md rounded-lg p-5",
        variant === "flat"
          ? "bg-transparent shadow-none"
          : "bg-mist-50/50 dark:bg-mist-950/50 shadow-surface",
        "border border-mist-100 dark:border-mist-800",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export default Object.assign(Card, { Title, Text });
