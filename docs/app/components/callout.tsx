import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

// Mirrors the variants in app/components/callout.tsx.
const variants = {
  neutral: { box: "border-line bg-subtle", icon: "text-muted", Icon: Info },
  info: { box: "border-accent/25 bg-accent-subtle", icon: "text-accent", Icon: Info },
  warning: { box: "border-warn/25 bg-warn-subtle", icon: "text-warn", Icon: TriangleAlert },
  error: { box: "border-bad/25 bg-bad-subtle", icon: "text-bad", Icon: CircleAlert },
  success: { box: "border-ok/25 bg-ok-subtle", icon: "text-ok", Icon: CircleCheck },
};

interface CalloutContainerProps {
  type?: keyof typeof variants;
  children: ReactNode;
}

export function CalloutContainer({ type = "neutral", children }: CalloutContainerProps) {
  const { box, icon, Icon } = variants[type];

  return (
    <div className={`my-5 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${box}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${icon}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function CalloutTitle({ children }: { children: ReactNode }) {
  return <p className="text-fg my-0! font-medium">{children}</p>;
}

export function CalloutDescription({ children }: { children: ReactNode }) {
  return <div className="prose-no-margin leading-6">{children}</div>;
}
