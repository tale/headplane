import { Toast } from "@base-ui/react/toast";

export const toastManager = Toast.createToastManager();

export default function toast(content: string, duration = 3000) {
  return toastManager.add({ description: content, timeout: duration });
}

export async function toastOnSuccess<T>(result: Promise<T>) {
  const value = await result;
  if (value && typeof value === "object" && "ok" in value && value.ok && "message" in value) {
    if (typeof value.message === "string") {
      toast(value.message);
    }
  }

  return value;
}

export function toastClientAction({ serverAction }: { serverAction: () => Promise<unknown> }) {
  return toastOnSuccess(serverAction());
}
