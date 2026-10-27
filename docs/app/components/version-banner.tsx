import { Banner } from "fumadocs-ui/components/banner";
import { useLocation } from "react-router";

import { docsBuild, pageOn, stableOrigin } from "@/lib/releases";

export default function VersionBanner() {
  const { pathname } = useLocation();
  if (docsBuild.channel !== "beta" && docsBuild.channel !== "archived") {
    return null;
  }

  const isBeta = docsBuild.channel === "beta";

  return (
    <Banner className="bg-warn-subtle text-warn h-9 text-sm">
      {isBeta ? (
        <>
          <span className="sm:hidden">
            Beta · <code>{docsBuild.version}</code>
          </span>
          <span className="max-sm:hidden">
            Beta docs, built from <code>main</code> @{" "}
            <code className="font-semibold">{docsBuild.version}</code>
            {docsBuild.date && ` on ${docsBuild.date}`}.
          </span>
        </>
      ) : (
        <>
          <span className="sm:hidden">
            Headplane <strong>{docsBuild.version}</strong> docs.
          </span>
          <span className="max-sm:hidden">
            These docs are for Headplane <strong>{docsBuild.version}</strong>.
          </span>
        </>
      )}
      <a className="ml-2 underline" href={pageOn(stableOrigin, "/", pathname)}>
        {isBeta ? "Stable docs →" : "Latest docs →"}
      </a>
    </Banner>
  );
}
