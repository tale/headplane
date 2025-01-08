import type { HostInfo } from '~/utils/types';

export function getTSVersion(host: HostInfo) {
	const { IPNVersion } = host;
	if (!IPNVersion) {
		return 'Unknown';
	}

	// IPNVersion is <Semver>-<something>-<something>
	return IPNVersion.split('-')[0];
}

export function getOSInfo(host: HostInfo) {
	const { OS, OSVersion } = host;
	// OS follows runtime.GOOS but uses iOS and macOS instead of darwin
	const formattedOS = formatOS(OS);

	// Trim in case OSVersion is empty
	return `${formattedOS} ${OSVersion}`.trim();
}

function formatOS(os?: string) {
	switch (os) {
		case 'macOS':
		case 'iOS':
			return os;
		case 'windows':
			return 'Windows';
		case 'linux':
			return 'Linux';
		case undefined:
			return 'Unknown';
		default:
			return os;
	}
}
