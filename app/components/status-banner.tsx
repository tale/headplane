import { AlertCircle, CloudOff, Info, TriangleAlert, X } from "lucide-react";
import { useState } from "react";

import cn from "~/utils/cn";

type Variant = "info" | "warning" | "error" | "critical";

interface StatusBannerProps {
  variant: Variant;
  title: string;
  children: React.ReactNode;
  dismissable?: boolean;
  className?: string;
}

const icons: Record<Variant, React.ReactNode> = {
  info: <Info className="h-5 w-5 shrink-0" />,
  warning: <TriangleAlert className="h-5 w-5 shrink-0" />,
  error: <AlertCircle className="h-5 w-5 shrink-0" />,
  critical: <CloudOff className="h-5 w-5 shrink-0" />,
};

export default function StatusBanner({
  variant,
  title,
  children,
  dismissable = true,
  className,
}: StatusBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        variant === "info" && ["border-accent/30 bg-accent-subtle text-accent"],
        variant === "warning" && ["border-warn/30 bg-warn-subtle text-warn"],
        variant === "error" && ["border-bad/30 bg-bad-subtle text-bad"],
        variant === "critical" && ["border-bad/30 bg-bad-subtle text-bad"],
        className,
      )}
    >
      {icons[variant]}
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <div className="mt-0.5 text-current/80">{children}</div>
      </div>
      {dismissable && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className={cn("shrink-0 rounded p-0.5 transition-colors", "hover:bg-hover")}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
