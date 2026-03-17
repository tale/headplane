import { Toast } from "@base-ui/react/toast";

export const toastManager = Toast.createToastManager();

export default function toast(content: string, duration = 3000) {
  return toastManager.add({ description: content, timeout: duration });
}
