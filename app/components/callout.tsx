import { CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import React, { useState } from "react";

import cn from "~/utils/cn";

type Variant = "neutral" | "info" | "warning" | "error";

const variants: Record<Variant, { box: string; icon: string; Icon: typeof Info }> = {
  neutral: { box: "border-line bg-subtle", icon: "text-muted", Icon: Info },
  info: { box: "border-accent/25 bg-accent-subtle", icon: "text-accent", Icon: Info },
  warning: { box: "border-warn/25 bg-warn-subtle", icon: "text-warn", Icon: TriangleAlert },
  error: { box: "border-bad/25 bg-bad-subtle", icon: "text-bad", Icon: CircleAlert },
};

export interface CalloutProps {
  variant?: Variant;
  title?: string;
  icon?: React.ReactElement;
  isDismissable?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function Callout({
  variant = "neutral",
  title,
  icon,
  isDismissable,
  className,
  children,
}: CalloutProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  if (isDismissed) {
    return null;
  }

  const { box, icon: iconClass, Icon } = variants[variant];
  const isUrgent = variant === "warning" || variant === "error";

  return (
    <div
      className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-3", box, className)}
      role={isUrgent ? "alert" : "status"}
    >
      <span className={cn("mt-0.5 shrink-0 [&>svg]:size-4", iconClass)}>{icon ?? <Icon />}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5 text-muted")}>{children}</div>}
      </div>
      {isDismissable && (
        <button
          aria-label="Dismiss"
          className="focus-ring text-muted hover:text-fg -m-0.5 shrink-0 rounded-sm p-0.5"
          onClick={() => setIsDismissed(true)}
          type="button"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
