import { createCookie } from "react-router";

export type ColorScheme = "dark" | "light" | "system";

let cookie = createCookie("color_scheme", {
  maxAge: 34560000,
  sameSite: "lax",
});

export function isValidColorScheme(val: unknown): val is ColorScheme {
  return typeof val === "string" && ["dark", "light", "system"].includes(val);
}

export async function getColorScheme(request: Request) {
  const header = request.headers.get("Cookie");
  const vals = await cookie.parse(header);
  return ["dark", "light", "system"].includes(vals?.colorScheme) ? vals.colorScheme : "system";
}

export function setColorScheme(colorScheme: ColorScheme) {
  if (colorScheme === "system") {
    return cookie.serialize({}, { expires: new Date(0), maxAge: 0 });
  }

  return cookie.serialize({ colorScheme });
}
