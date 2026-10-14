import { Form } from "@base-ui/react/form";
import React, { useState } from "react";
import { useFetcher } from "react-router";

import Button from "~/components/button";
import Callout from "~/components/callout";
import {
  AlertDialog,
  Dialog,
  DialogActions,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "~/components/dialog";
import type { ActionResult } from "~/utils/form";

export interface ActionDialogProps {
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  intent: string;
  fields?: Record<string, string>;
  action?: string;
  isDestructive?: boolean;
  isDisabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement;
  children?: React.ReactNode;
  // Replaces the form after a successful submit instead of closing.
  success?: (data: Record<string, string>) => React.ReactNode;
}

export default function ActionDialog({
  title,
  description,
  submitLabel,
  intent,
  fields,
  action,
  isDestructive,
  isDisabled,
  open,
  onOpenChange,
  trigger,
  children,
  success,
}: ActionDialogProps) {
  const fetcher = useFetcher<ActionResult>();
  const [internalOpen, setInternalOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const isPending = fetcher.state !== "idle";
  if (isPending && !hasSubmitted) {
    setHasSubmitted(true);
  }

  const result = hasSubmitted && !isPending ? fetcher.data : undefined;
  const isDone = result?.ok === true && !success;
  const errors = result?.ok === false ? result.errors : undefined;

  function handleOpenChange(next: boolean) {
    if (!next && isPending) {
      return;
    }

    setInternalOpen(next);
    onOpenChange?.(next);
  }

  // A successful submit closes the dialog without an open-change event, so
  // the parent is told once the close animation finishes.
  function handleOpenChangeComplete(next: boolean) {
    if (next) {
      return;
    }

    setHasSubmitted(false);
    if (isDone) {
      setInternalOpen(false);
      onOpenChange?.(false);
    }
  }

  const Root = isDestructive ? AlertDialog : Dialog;

  return (
    <Root
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
      open={(open ?? internalOpen) && !isDone}
      trigger={trigger}
    >
      {result?.ok && success ? (
        <>
          {success(result.data ?? {})}
          <DialogActions>
            <DialogClose render={<Button>Done</Button>} />
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
          <Form
            className="flex flex-col gap-4"
            errors={errors}
            render={<fetcher.Form action={action} method="post" />}
            validationMode="onBlur"
          >
            <input name="intent" type="hidden" value={intent} />
            {Object.entries(fields ?? {}).map(([name, value]) => (
              <input key={name} name={name} type="hidden" value={value} />
            ))}
            {children}
            {errors?.form && <Callout variant="error">{errors.form}</Callout>}
            <DialogActions>
              <DialogClose disabled={isPending} render={<Button>Cancel</Button>} />
              <Button
                disabled={isDisabled}
                pending={isPending}
                type="submit"
                variant={isDestructive ? "danger" : "primary"}
              >
                {submitLabel}
              </Button>
            </DialogActions>
          </Form>
        </>
      )}
    </Root>
  );
}
