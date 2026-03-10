import React, { cloneElement, useEffect, useRef } from "react";
import {
  type AriaDialogProps,
  type AriaModalOverlayProps,
  Overlay,
  useDialog,
  useModalOverlay,
  useOverlayTrigger,
} from "react-aria";
import { Form, type HTMLFormMethod } from "react-router";
import {
  type OverlayTriggerProps,
  type OverlayTriggerState,
  useOverlayTriggerState,
} from "react-stately";

import Button, { ButtonProps } from "~/components/Button";
import IconButton, { IconButtonProps } from "~/components/IconButton";
import Text from "~/components/Text";
import Title from "~/components/Title";
import cn from "~/utils/cn";
import { useLiveData } from "~/utils/live-data";

export interface DialogProps extends OverlayTriggerProps {
  children:
    | [
        React.ReactElement<ButtonProps> | React.ReactElement<IconButtonProps>,
        React.ReactElement<DialogPanelProps>,
      ]
    | React.ReactElement<DialogPanelProps>;
}

function Dialog(props: DialogProps) {
  const { pause, resume } = useLiveData();
  const state = useOverlayTriggerState(props);
  const { triggerProps, overlayProps } = useOverlayTrigger(
    {
      type: "dialog",
    },
    state,
  );

  useEffect(() => {
    if (state.isOpen) {
      pause();
    } else {
      resume();
    }
  }, [state.isOpen]);

  if (Array.isArray(props.children)) {
    const [button, panel] = props.children;
    return (
      <>
        {cloneElement(button, triggerProps)}
        {state.isOpen && (
          <DModal state={state}>
            {cloneElement(panel, {
              ...overlayProps,
              close: () => state.close(),
            })}
          </DModal>
        )}
      </>
    );
  }

  return (
    <DModal state={state}>
      {cloneElement(props.children, {
        ...overlayProps,
        close: () => state.close(),
      })}
    </DModal>
  );
}

export interface DialogPanelProps extends AriaDialogProps {
  children: React.ReactNode;
  variant?: "normal" | "destructive" | "unactionable";
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  method?: HTMLFormMethod;
  isDisabled?: boolean;

  // Anonymous (passed by parent)
  close?: () => void;
}

function Panel(props: DialogPanelProps) {
  const { children, onSubmit, isDisabled, close, variant, method = "POST" } = props;
  const ref = useRef<HTMLFormElement | null>(null);
  const { dialogProps } = useDialog(
    {
      ...props,
      role: "alertdialog",
    },
    ref,
  );

  return (
    <Form
      {...dialogProps}
      className={cn(
        "w-full max-w-lg rounded-xl p-4",
        "outline-hidden",
        "bg-white dark:bg-mist-900",
        "border border-mist-200 dark:border-mist-800",
        "shadow-overlay",
      )}
      method={method ?? "POST"}
      onSubmit={(event) => {
        if (onSubmit) {
          onSubmit(event);
        }

        close?.();
      }}
      ref={ref}
    >
      <div className="flex flex-col gap-4">{children}</div>
      <div className="mt-5 flex justify-end gap-3">
        {variant === "unactionable" ? (
          <Button onPress={close}>Close</Button>
        ) : (
          <>
            <Button onPress={close}>Cancel</Button>
            <Button
              isDisabled={isDisabled}
              type="submit"
              variant={variant === "destructive" ? "danger" : "heavy"}
            >
              Confirm
            </Button>
          </>
        )}
      </div>
    </Form>
  );
}

interface DModalProps extends AriaModalOverlayProps {
  children: React.ReactNode;
  state: OverlayTriggerState;
}

function DModal(props: DModalProps) {
  const { children, state } = props;
  const ref = useRef<HTMLDivElement>(null);
  const { modalProps, underlayProps } = useModalOverlay(props, state, ref);

  if (!state.isOpen) {
    return null;
  }

  return (
    <Overlay>
      <div
        {...underlayProps}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-20 h-screen w-screen",
          "flex items-center justify-center",
          "bg-mist-900/30 dark:bg-mist-950/60",
          "entering:animate-in exiting:animate-out",
          "entering:fade-in entering:duration-100 entering:ease-out",
          "exiting:fade-out exiting:duration-50 exiting:ease-in",
        )}
      />
      <div
        {...modalProps}
        className={cn(
          "fixed inset-0 z-20 h-screen w-screen",
          "flex items-center justify-center p-4",
        )}
      >
        {children}
      </div>
    </Overlay>
  );
}

export default Object.assign(Dialog, {
  Button,
  IconButton,
  Panel,
  Title,
  Text,
});
