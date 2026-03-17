import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";

import cn from "~/utils/cn";
import { toastManager } from "~/utils/toast";

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className={cn(
        "toast-root rounded-lg",
        "bg-white text-mist-900 border border-mist-200",
        "dark:bg-mist-800 dark:text-mist-50 dark:border-mist-700",
        "shadow-lg",
      )}
    >
      <Toast.Content
        className={cn("toast-content", "flex items-center justify-between gap-x-3 pl-4 pr-3 py-3")}
      >
        <Toast.Description>{toast.description}</Toast.Description>
        <Toast.Close
          aria-label="Close"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full p-1",
            "bg-transparent hover:bg-mist-100",
            "dark:bg-transparent dark:hover:bg-mist-700",
          )}
        >
          <X className="h-4 w-4" />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}

export default function ToastProvider() {
  return (
    <Toast.Provider toastManager={toastManager}>
      <Toast.Portal>
        <Toast.Viewport className="toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
