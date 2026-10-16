import type { HostInfo } from "~/types";

export function getTSVersion(host: HostInfo) {
  const { IPNVersion } = host;
  if (!IPNVersion) {
    return "Unknown";
  }

  // IPNVersion is <Semver>-<something>-<something>
  return IPNVersion.split("-")[0];
}

// Only major.minor is compared since platforms ship patch releases at
// different times (e.g. the macOS app often trails the Linux tarballs).
export function isUpdateAvailable(host: HostInfo, latest: string) {
  const current = getTSVersion(host);
  if (current === "Unknown") {
    return false;
  }

  const [curMajor = 0, curMinor = 0] = current.split(".").map(Number);
  const [newMajor = 0, newMinor = 0] = latest.split(".").map(Number);
  if (curMajor !== newMajor) {
    return curMajor < newMajor;
  }

  return curMinor < newMinor;
}

export function getOSInfo(host: HostInfo) {
  const { OS, OSVersion } = host;
  // OS follows runtime.GOOS but uses iOS and macOS instead of darwin
  const formattedOS = formatOS(OS);

  // Trim in case OSVersion is empty
  return `${formattedOS} ${OSVersion ?? ""}`.trim();
}

function formatOS(os?: string) {
  switch (os) {
    case "macOS":
    case "iOS":
      return os;
    case "windows":
      return "Windows";
    case "linux":
      return "Linux";
    case undefined:
      return "Unknown";
    default:
      return os;
  }
}
