import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import React from "react";

import cn from "~/utils/cn";

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  trigger?: React.ReactElement;
  className?: string;
  children: React.ReactNode;
}

const backdropClass = cn(
  "fixed inset-0 z-40 bg-backdrop",
  "transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
);

const popupClass = cn(
  "flex max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg p-5",
  "bg-raised border-overlay shadow-overlay outline-hidden",
  "transition-[opacity,scale] duration-150",
  "data-ending-style:scale-[0.98] data-ending-style:opacity-0",
  "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
);

export function Dialog({
  open,
  onOpenChange,
  onOpenChangeComplete,
  trigger,
  className,
  children,
}: DialogProps) {
  return (
    <BaseDialog.Root
      onOpenChange={(next) => onOpenChange?.(next)}
      onOpenChangeComplete={onOpenChangeComplete}
      open={open}
    >
      {trigger && <BaseDialog.Trigger render={trigger} />}
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={backdropClass} />
        <BaseDialog.Viewport className="fixed inset-0 z-40 grid place-items-center p-4">
          <BaseDialog.Popup className={cn(popupClass, className)}>{children}</BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export function AlertDialog({
  open,
  onOpenChange,
  onOpenChangeComplete,
  trigger,
  className,
  children,
}: DialogProps) {
  return (
    <BaseAlertDialog.Root
      onOpenChange={(next) => onOpenChange?.(next)}
      onOpenChangeComplete={onOpenChangeComplete}
      open={open}
    >
      {trigger && <BaseAlertDialog.Trigger render={trigger} />}
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop className={backdropClass} />
        <BaseAlertDialog.Viewport className="fixed inset-0 z-40 grid place-items-center p-4">
          <BaseAlertDialog.Popup className={cn(popupClass, className)}>
            {children}
          </BaseAlertDialog.Popup>
        </BaseAlertDialog.Viewport>
      </BaseAlertDialog.Portal>
    </BaseAlertDialog.Root>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title {...props} className={cn("text-lg font-semibold text-balance", className)} />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Description>) {
  return <BaseDialog.Description {...props} className={cn("-mt-2 text-muted", className)} />;
}

export function DialogActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div {...props} className={cn("mt-1 flex justify-end gap-2", className)} />;
}

export const DialogClose = BaseDialog.Close;
