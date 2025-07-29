import { HostInfo, Machine } from '~/types';

export interface PopulatedNode extends Machine {
	routes: string[];
	hostInfo?: HostInfo;
	expired: boolean;
	customRouting: {
		exitRoutes: string[];
		exitApproved: boolean;
		subnetApprovedRoutes: string[];
		subnetWaitingRoutes: string[];
	};
}

export function mapNodes(
	nodes: Machine[],
	stats?: Record<string, HostInfo> | undefined,
): PopulatedNode[] {
	return nodes.map((node) => {
		const customRouting = {
			exitRoutes: node.availableRoutes.filter(
				(route) => route === '::/0' || route === '0.0.0.0/0',
			),
			exitApproved: node.approvedRoutes.some(
				(route) => route === '::/0' || route === '0.0.0.0/0',
			),
			subnetApprovedRoutes: node.approvedRoutes.filter(
				(route) =>
					route !== '::/0' &&
					route !== '0.0.0.0/0' &&
					node.availableRoutes.includes(route),
			),
			subnetWaitingRoutes: node.availableRoutes.filter(
				(route) =>
					route !== '::/0' &&
					route !== '0.0.0.0/0' &&
					!node.approvedRoutes.includes(route),
			),
		} satisfies PopulatedNode['customRouting'];

		return {
			...node,
			routes: Array.from(new Set(node.availableRoutes)),
			hostInfo: stats?.[node.nodeKey],
			customRouting,
			expired:
				node.expiry === '0001-01-01 00:00:00' ||
				node.expiry === '0001-01-01T00:00:00Z' ||
				node.expiry === null
					? false
					: new Date(node.expiry).getTime() < Date.now(),
		};
	});
}
