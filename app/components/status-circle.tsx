import cn from "~/utils/cn";

export interface StatusCircleProps {
  isOnline: boolean;
  isExpired?: boolean;
  className?: string;
}

export default function StatusCircle({ isOnline, isExpired, className }: StatusCircleProps) {
  const label = isExpired ? "Expired" : isOnline ? "Online" : "Offline";

  return (
    <span
      aria-label={label}
      className={cn(
        "inline-block size-[7px] shrink-0 rounded-full",
        isExpired ? "bg-bad" : isOnline ? "bg-ok" : "bg-faint",
        className,
      )}
      role="img"
    />
  );
}
