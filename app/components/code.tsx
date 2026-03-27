import cn from "~/utils/cn";

export interface CodeProps {
  children: string | string[] | number;
  className?: string;
}

export default function Code({ children, className }: CodeProps) {
  return (
    <code
      className={cn(
        "bg-mist-100 dark:bg-mist-800 px-1.5 py-0.5 font-mono rounded-sm text-[0.875em]",
        className,
      )}
    >
      {children}
    </code>
  );
}
