// A release's anchor and label, shared by the changelog and Upgrading pages.
export function releaseId(version: string) {
  return version === "Next" ? "next" : `v${version}`;
}

export function releaseLabel(version: string) {
  return version === "Next" ? "Unreleased" : version;
}

// Exported by remark-changelog from the compiled CHANGELOG.md.
export interface ReleaseSummary {
  version: string;
  hasUpgrading: boolean;
}
