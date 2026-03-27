import { AlertDialog } from "@base-ui/react/alert-dialog";
import React, { cloneElement, useEffect, useRef } from "react";
import { Form, type HTMLFormMethod } from "react-router";

import Button, { type ButtonProps } from "~/components/button";
import cn from "~/utils/cn";
import { useLiveData } from "~/utils/live-data";

export interface DialogProps {
  children:
    | [React.ReactElement<ButtonProps>, React.ReactElement<DialogPanelProps>]
    | React.ReactElement<DialogPanelProps>;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

function Dialog(props: DialogProps) {
  const { pause, resume } = useLiveData();
  const { isOpen, onOpenChange } = props;

  useEffect(() => {
    if (isOpen) {
      pause();
    } else {
      resume();
    }
  }, [isOpen]);

  if (Array.isArray(props.children)) {
    const [button, panel] = props.children;
    return (
      <AlertDialog.Root open={isOpen} onOpenChange={(open) => onOpenChange?.(open)}>
        <AlertDialog.Trigger render={cloneElement(button)} />
        <DialogOverlay>{panel}</DialogOverlay>
      </AlertDialog.Root>
    );
  }

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={(open) => onOpenChange?.(open)}>
      <DialogOverlay>{props.children}</DialogOverlay>
    </AlertDialog.Root>
  );
}

export interface DialogPanelProps {
  children: React.ReactNode;
  variant?: "normal" | "destructive" | "unactionable";
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  method?: HTMLFormMethod;
  isDisabled?: boolean;
}

function Panel(props: DialogPanelProps) {
  const { children, onSubmit, isDisabled, variant, method = "POST" } = props;
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog.Popup
      className={cn(
        "w-full max-w-lg rounded-xl p-4",
        "outline-hidden",
        "bg-white dark:bg-mist-900",
        "border border-mist-200 dark:border-mist-800",
        "shadow-overlay",
      )}
    >
      <Form
        method={method ?? "POST"}
        onSubmit={(event) => {
          if (onSubmit) {
            onSubmit(event);
          }

          if (!event.defaultPrevented) {
            closeRef.current?.click();
          }
        }}
      >
        <div className="flex flex-col gap-4">{children}</div>
        <div className="mt-5 flex justify-end gap-3">
          {variant === "unactionable" ? (
            <AlertDialog.Close render={<Button>Close</Button>} />
          ) : (
            <>
              <AlertDialog.Close render={<Button>Cancel</Button>} />
              <AlertDialog.Close ref={closeRef} className="hidden" aria-hidden tabIndex={-1} />
              <Button
                disabled={isDisabled}
                type="submit"
                variant={variant === "destructive" ? "danger" : "heavy"}
              >
                Confirm
              </Button>
            </>
          )}
        </div>
      </Form>
    </AlertDialog.Popup>
  );
}

function DialogOverlay({ children }: { children: React.ReactNode }) {
  return (
    <AlertDialog.Portal>
      <AlertDialog.Backdrop
        className={cn(
          "fixed inset-0 z-20 h-screen w-screen",
          "bg-mist-900/30 dark:bg-mist-950/60",
          "transition-opacity duration-100",
        )}
      />
      <div
        className={cn(
          "fixed inset-0 z-20 h-screen w-screen",
          "flex items-center justify-center p-4",
        )}
      >
        {children}
      </div>
    </AlertDialog.Portal>
  );
}

export { Panel as DialogPanel };
export default Dialog;
