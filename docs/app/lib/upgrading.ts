// The heading each release gets on the Upgrading page, shared by the page's
// component and the TOC its loader builds.
export function upgradeHeading(version: string) {
  return version === "Next"
    ? { id: "next-release", title: "Next release" }
    : { id: `v${version}`, title: version };
}
