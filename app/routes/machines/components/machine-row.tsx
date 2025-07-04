import { ChevronDownIcon, CopyIcon } from '@primer/octicons-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import Chip from '~/components/Chip';
import Menu from '~/components/Menu';
import StatusCircle from '~/components/StatusCircle';
import type { User } from '~/types';
import cn from '~/utils/cn';
import * as hinfo from '~/utils/host-info';

import { ExitNodeTag } from '~/components/tags/ExitNode';
import { ExpiryTag } from '~/components/tags/Expiry';
import { HeadplaneAgentTag } from '~/components/tags/HeadplaneAgent';
import { SubnetTag } from '~/components/tags/Subnet';
import { PopulatedNode } from '~/utils/node-info';
import toast from '~/utils/toast';
import MenuOptions from './menu';

interface Props {
	node: PopulatedNode;
	users: User[];
	isAgent?: boolean;
	magic?: string;
	isDisabled?: boolean;
}

export default function MachineRow({
	node,
	users,
	isAgent,
	magic,
	isDisabled,
}: Props) {
	const uiTags = useMemo(() => {
		const tags = uiTagsForNode(node, isAgent);
		return tags;
	}, [node, isAgent]);

	const ipOptions = useMemo(() => {
		if (magic) {
			return [...node.ipAddresses, `${node.givenName}.${magic}`];
		}

		return node.ipAddresses;
	}, [magic, node.ipAddresses]);

	return (
		<tr
			key={node.id}
			className="group hover:bg-headplane-50 dark:hover:bg-headplane-950"
		>
			<td className="pl-0.5 py-2 focus-within:ring-3">
				<Link
					to={`/machines/${node.id}`}
					className={cn('group/link h-full focus:outline-hidden')}
				>
					<p
						className={cn(
							'font-semibold leading-snug',
							'group-hover/link:text-blue-600',
							'dark:group-hover/link:text-blue-400',
						)}
					>
						{node.givenName}
					</p>
					<p className="text-sm opacity-50">
						{node.user.name || node.user.email}
					</p>
					<div className="flex gap-1 flex-wrap mt-1.5">
						{mapTagsToComponents(node, uiTags)}
						{node.validTags.map((tag) => (
							<Chip key={tag} text={tag} />
						))}
					</div>
				</Link>
			</td>
			<td className="py-2">
				<div className="flex items-center gap-x-1">
					{node.ipAddresses[0]}
					<Menu placement="bottom end">
						<Menu.IconButton className="bg-transparent" label="IP Addresses">
							<ChevronDownIcon className="w-4 h-4" />
						</Menu.IconButton>
						<Menu.Panel
							onAction={async (key) => {
								await navigator.clipboard.writeText(key.toString());
								toast('Copied IP address to clipboard');
							}}
						>
							<Menu.Section>
								{ipOptions.map((ip) => (
									<Menu.Item key={ip} textValue={ip}>
										<div
											className={cn(
												'flex items-center justify-between',
												'text-sm w-full gap-x-6',
											)}
										>
											{ip}
											<CopyIcon className="w-3 h-3" />
										</div>
									</Menu.Item>
								))}
							</Menu.Section>
						</Menu.Panel>
					</Menu>
				</div>
			</td>
			{/* We pass undefined when agents are not enabled */}
			{isAgent !== undefined ? (
				<td className="py-2">
					{node.hostInfo !== undefined ? (
						<>
							<p className="leading-snug">
								{hinfo.getTSVersion(node.hostInfo)}
							</p>
							<p className="text-sm opacity-50 max-w-48 truncate">
								{hinfo.getOSInfo(node.hostInfo)}
							</p>
						</>
					) : (
						<p className="text-sm opacity-50">Unknown</p>
					)}
				</td>
			) : undefined}
			<td className="py-2">
				<span
					className={cn(
						'flex items-center gap-x-1 text-sm',
						'text-headplane-600 dark:text-headplane-300',
					)}
				>
					<StatusCircle
						isOnline={node.online && !node.expired}
						className="w-4 h-4"
					/>
					<p suppressHydrationWarning>
						{node.online && !node.expired
							? 'Connected'
							: new Date(node.lastSeen).toLocaleString()}
					</p>
				</span>
			</td>
			<td className="py-2 pr-0.5">
				<MenuOptions
					node={node}
					users={users}
					magic={magic}
					isDisabled={isDisabled}
				/>
			</td>
		</tr>
	);
}

export function uiTagsForNode(node: PopulatedNode, isAgent?: boolean) {
	const uiTags: string[] = [];
	if (node.expired) {
		uiTags.push('expired');
	}

	if (node.expiry === null) {
		uiTags.push('no-expiry');
	}

	if (node.customRouting.exitRoutes.length > 0) {
		if (node.customRouting.exitApproved) {
			uiTags.push('exit-approved');
		} else {
			uiTags.push('exit-waiting');
		}
	}

	if (node.customRouting.subnetWaitingRoutes.length > 0) {
		uiTags.push('subnet-waiting');
	} else if (node.customRouting.subnetApprovedRoutes.length > 0) {
		uiTags.push('subnet-approved');
	}

	if (isAgent === true) {
		uiTags.push('headplane-agent');
	}

	return uiTags;
}

export function mapTagsToComponents(node: PopulatedNode, uiTags: string[]) {
	return uiTags.map((tag) => {
		switch (tag) {
			case 'exit-approved':
			case 'exit-waiting':
				return <ExitNodeTag key={tag} isEnabled={tag === 'exit-approved'} />;

			case 'subnet-approved':
			case 'subnet-waiting':
				return <SubnetTag key={tag} isEnabled={tag === 'subnet-approved'} />;

			case 'expired':
			case 'no-expiry':
				return (
					<ExpiryTag
						key={tag}
						variant={tag}
						expiry={node.expiry ?? undefined}
					/>
				);

			case 'headplane-agent':
				return <HeadplaneAgentTag />;

			default:
				return;
		}
	});
}
