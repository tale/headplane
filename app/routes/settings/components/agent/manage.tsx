import Card from '~/components/Card'
import StatusCircle from '~/components/StatusCircle'
import type { HostInfo } from '~/types';
import * as hinfo from '~/utils/host-info';

export type Props = {
	reachable: boolean;
	hostInfo: HostInfo;
};

export default function AgentManagement({ reachable, hostInfo }: Props) {
	console.log('hostInfo:', hostInfo);
	return (
		<div className="flex flex-col w-2/3">
			<h1 className="text-2xl font-medium mb-4">
				Local Agent Configuration
			</h1>
			<p className="text-gray-700 dark:text-gray-300 mb-8">
				A local agent has already been configured for this
				Headplane instance. You can manage the agent settings here.
			</p>
			<Card>
				<div className="flex items-center gap-2">
					<StatusCircle
						isOnline={reachable}
						className="w-4 h-4 px-1 w-fit"
					/>
					<div>
						<p className="text-lg font-bold">
							{hostInfo.Hostname ?? 'Unknown'}
						</p>
						<p className="leading-snug">
							{hinfo.getTSVersion(hostInfo)}
							<span className="ml-2 text-sm text-gray-500 dark:text-gray-300">
								{hinfo.getOSInfo(hostInfo)}
							</span>
						</p>
					</div>
				</div>
				{JSON.stringify(hostInfo)}
			</Card>
		</div>
	)
}
