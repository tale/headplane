import cn from "~/utils/cn";

interface Props {
  readonly acl: string;
}

export default function Fallback({ acl }: Props) {
  return (
    <div className="h-editor relative flex w-full">
      <div
        className={cn(
          "h-full w-8 flex justify-center p-1",
          "border-r border-mist-400 dark:border-mist-800",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "h-5 w-5 animate-spin rounded-full",
            "border-mist-900 dark:border-mist-100",
            "border-2 border-t-transparent dark:border-t-transparent",
          )}
        />
      </div>
      <textarea
        className={cn(
          "w-full h-editor font-mono resize-none text-sm",
          "bg-mist-50 dark:bg-mist-950 opacity-60",
          "pl-1 pt-1 leading-snug",
        )}
        readOnly
        value={acl}
      />
    </div>
  );
}
