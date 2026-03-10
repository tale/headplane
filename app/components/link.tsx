import { ExternalLink } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { Link as RouterLink } from "react-router";

import cn from "~/utils/cn";

export type LinkProps =
  | {
      external: true;
      to: string;
      children: ReactNode;
      className?: string;
      styled?: boolean;
    }
  | {
      external?: false;
      to: string;
      children?: ReactNode;
      className?: string;
    };

export default function Link(props: LinkProps): JSX.Element {
  if (props.external) {
    return (
      <a
        href={props.to}
        target="_blank"
        rel="noreferrer"
        className={cn(
          props.styled && [
            "inline-flex items-center gap-x-0.5",
            "text-blue-500 hover:text-blue-700",
            "dark:text-blue-400 dark:hover:text-blue-300",
          ],
          props.className,
        )}
      >
        {props.children}
        {props.styled && <ExternalLink className="w-3.5" />}
      </a>
    );
  }

  return (
    <RouterLink to={props.to} className={props.className}>
      {props.children}
    </RouterLink>
  );
}
