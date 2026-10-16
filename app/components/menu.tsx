import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ComponentProps, JSX, ReactNode } from "react";

import cn from "~/utils/cn";

const SIDE_OFFSET = 8;

export const Menu = ({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}): JSX.Element => <BaseMenu.Root disabled={disabled}>{children}</BaseMenu.Root>;

export const MenuTrigger = ({
  className,
  children,
  disabled,
  onClick,
}: Pick<
  ComponentProps<typeof BaseMenu.Trigger>,
  "className" | "children" | "disabled" | "onClick"
>): JSX.Element => (
  <BaseMenu.Trigger
    className={cn(
      "inline-flex items-center justify-center",
      "focus-ring",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className,
    )}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </BaseMenu.Trigger>
);

export const MenuContent = ({
  children,
  className,
  side = "bottom",
  sideOffset = SIDE_OFFSET,
  align = "start",
}: {
  children: ReactNode;
  className?: string;
  side?: ComponentProps<typeof BaseMenu.Positioner>["side"];
  sideOffset?: number;
  align?: ComponentProps<typeof BaseMenu.Positioner>["align"];
}): JSX.Element => (
  <BaseMenu.Portal>
    <BaseMenu.Positioner align={align} className="z-50" side={side} sideOffset={sideOffset}>
      <BaseMenu.Popup
        className={cn(
          "max-h-(--available-height) min-w-50 overflow-y-auto rounded-lg py-1 outline-hidden",
          "bg-raised border-overlay shadow-overlay",
          className,
        )}
      >
        {children}
      </BaseMenu.Popup>
    </BaseMenu.Positioner>
  </BaseMenu.Portal>
);

export const MenuItem = ({
  className,
  variant,
  children,
  disabled,
  onClick,
}: Pick<ComponentProps<typeof BaseMenu.Item>, "className" | "children" | "disabled" | "onClick"> & {
  variant?: "danger";
}): JSX.Element => (
  <BaseMenu.Item
    className={cn(
      "py-2 px-3 mx-1 rounded-md",
      "select-none cursor-pointer",
      "text-fg",
      "data-highlighted:bg-hover",
      "data-disabled:text-muted data-disabled:cursor-default",
      variant === "danger" && "text-bad",
      className,
    )}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </BaseMenu.Item>
);

export const MenuSeparator = ({ className }: { className?: string }): JSX.Element => (
  <BaseMenu.Separator className={cn("mx-2 my-1 border-t border-line", className)} />
);
