import { ExternalLink } from "lucide-react";
import type { JSX } from "react";
import { Link as RouterLink } from "react-router";

import cn from "~/utils/cn";

const linkStyles = cn(
  "inline-flex items-center gap-x-0.5",
  "text-blue-500 hover:text-blue-700",
  "dark:text-blue-400 dark:hover:text-blue-300",
  "focus:ring-offset-1 rounded-md",
  "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40",
  "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
);

export type LinkProps =
  | {
      isExternal: true;
      to: string;
      name: string;
      children: string;
      className?: string;
    }
  | {
      isExternal?: false;
      to: string;
      children?: string;
      className?: string;
    };

export default function Link(props: LinkProps): JSX.Element {
  if (props.isExternal) {
    return (
      <a
        href={props.to}
        aria-label={props.name}
        target="_blank"
        rel="noreferrer"
        className={cn(linkStyles, props.className)}
      >
        {props.children}
        <ExternalLink className="w-3.5" />
      </a>
    );
  }

  return (
    <RouterLink to={props.to} className={cn(linkStyles, props.className)}>
      {props.children}
    </RouterLink>
  );
}
