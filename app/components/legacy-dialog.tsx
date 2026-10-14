// Temporary: the old close-on-submit dialog API, rebuilt on the new primitives.
// Each caller moves to a fetcher-driven dialog in #653, then this file goes away.
import React, { useEffect, useRef } from "react";
import { Form, type HTMLFormMethod } from "react-router";

import Button, { type ButtonProps } from "~/components/button";
import { AlertDialog, Dialog, DialogActions, DialogClose } from "~/components/dialog";
import { useLiveData } from "~/utils/live-data";

export interface DialogProps {
  children:
    | [React.ReactElement<ButtonProps>, React.ReactElement<DialogPanelProps>]
    | React.ReactElement<DialogPanelProps>;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export default function LegacyDialog({ children, isOpen, onOpenChange }: DialogProps) {
  const { pause, resume } = useLiveData();

  useEffect(() => {
    if (isOpen) {
      pause();
    } else {
      resume();
    }
  }, [isOpen]);

  const [trigger, panel] = Array.isArray(children) ? children : [undefined, children];
  const Root = panel.props.variant === "destructive" ? AlertDialog : Dialog;

  return (
    <Root open={isOpen} onOpenChange={onOpenChange} trigger={trigger}>
      {panel}
    </Root>
  );
}

export interface DialogPanelProps {
  children: React.ReactNode;
  variant?: "normal" | "destructive" | "unactionable";
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  method?: HTMLFormMethod;
  isDisabled?: boolean;
}

export function DialogPanel({
  children,
  onSubmit,
  isDisabled,
  variant,
  method = "POST",
}: DialogPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <Form
      method={method}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        onSubmit?.(event);
        if (!event.defaultPrevented) {
          closeRef.current?.click();
        }
      }}
    >
      {children}
      <DialogActions>
        {variant === "unactionable" ? (
          <DialogClose render={<Button>Close</Button>} />
        ) : (
          <>
            <DialogClose render={<Button>Cancel</Button>} />
            <DialogClose ref={closeRef} className="hidden" aria-hidden tabIndex={-1} />
            <Button
              disabled={isDisabled}
              type="submit"
              variant={variant === "destructive" ? "danger" : "primary"}
            >
              Confirm
            </Button>
          </>
        )}
      </DialogActions>
    </Form>
  );
}
