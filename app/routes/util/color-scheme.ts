import { data, redirect } from "react-router";

import { isValidColorScheme, setColorScheme } from "~/utils/color-scheme";

import type { Route } from "./+types/color-scheme";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const colorScheme = formData.get("colorScheme");
  const returnTo = safeRedirect(formData.get("returnTo"));

  if (!colorScheme || !isValidColorScheme(colorScheme)) {
    throw data("Bad Request", { status: 400 });
  }

  return redirect(returnTo, {
    headers: {
      "Set-Cookie": await setColorScheme(colorScheme),
    },
  });
}

// Stolen from react-router thanks!
function safeRedirect(to: FormDataEntryValue | null) {
  if (!to || typeof to !== "string") {
    return "/";
  }

  if (!to.startsWith("/") || to.startsWith("//")) {
    return "/";
  }

  return to;
}
