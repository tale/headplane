import type { ShouldRevalidateFunction } from "react-router";

// For loaders that don't read the query string, such as pages that search and
// filter on the client.
export const ignoreSearchChanges: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formAction,
  defaultShouldRevalidate,
}) => {
  if (
    !formAction &&
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search
  ) {
    return false;
  }

  return defaultShouldRevalidate;
};
