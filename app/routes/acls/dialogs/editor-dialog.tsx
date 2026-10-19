import type React from "react";

import Button from "~/components/button";
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "~/components/dialog";

interface EditorDialogProps {
  title: string;
  description: React.ReactNode;
  submitLabel: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isDisabled?: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}

// Edits the policy draft in the browser. Nothing is sent until the page saves.
export default function EditorDialog({
  title,
  description,
  submitLabel,
  isOpen,
  setIsOpen,
  isDisabled,
  onSubmit,
  children,
}: EditorDialogProps) {
  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
          setIsOpen(false);
        }}
      >
        {children}
        <DialogActions>
          <DialogClose render={<Button>Cancel</Button>} />
          <Button disabled={isDisabled} type="submit" variant="primary">
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
