import { HostInfo, Machine, Route } from '~/types';

export interface PopulatedNode extends Machine {
	routes: Route[];
	hostInfo?: HostInfo;
	expired: boolean;
	customRouting: {
		exitRoutes: Route[];
		exitApproved: boolean;
		subnetApprovedRoutes: Route[];
		subnetWaitingRoutes: Route[];
	};
}

export function mapNodes(
	nodes: Machine[],
	routes: Route[],
	stats?: Record<string, HostInfo> | undefined,
): PopulatedNode[] {
	return nodes.map((node) => {
		const nodeRoutes = routes.filter((route) => route.node.id === node.id);
		const customRouting = nodeRoutes.reduce<PopulatedNode['customRouting']>(
			(acc, route) => {
				if (route.prefix === '::/0' || route.prefix === '0.0.0.0/0') {
					acc.exitRoutes.push(route);
					if (route.enabled) {
						acc.exitApproved = true;
					}
				} else {
					if (route.enabled) {
						acc.subnetApprovedRoutes.push(route);
					} else {
						acc.subnetWaitingRoutes.push(route);
					}
				}

				return acc;
			},
			{
				exitRoutes: [],
				exitApproved: false,
				subnetApprovedRoutes: [],
				subnetWaitingRoutes: [],
			},
		);

		return {
			...node,
			routes: nodeRoutes,
			hostInfo: stats?.[node.nodeKey],
			customRouting,
			expired:
				node.expiry === null
					? false
					: new Date(node.expiry).getTime() < Date.now(),
		};
	});
}
