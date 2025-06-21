import { Info } from 'lucide-react';
import { Form, useSubmit } from 'react-router';
import Button from '~/components/Button';
import Link from '~/components/Link';
import Switch from '~/components/Switch';
import TableList from '~/components/TableList';
import Tooltip from '~/components/Tooltip';
import cn from '~/utils/cn';
import AddNS from '../dialogs/add-ns';

interface Props {
	nameservers: Record<string, string[]>;
	overrideLocalDns: boolean;
	isDisabled: boolean;
}

export default function ManageNS({
	nameservers,
	isDisabled,
	overrideLocalDns,
}: Props) {
	return (
		<div className="flex flex-col w-2/3">
			<h1 className="text-2xl font-medium mb-4">Nameservers</h1>
			<p>
				Set the nameservers used by devices on the Tailnet to resolve DNS
				queries.{' '}
				<Link
					to="https://tailscale.com/kb/1054/dns"
					name="Tailscale DNS Documentation"
				>
					Learn more
				</Link>
			</p>
			<div className="mt-4">
				{Object.keys(nameservers).map((key) => (
					<NameserverList
						key={key}
						isGlobal={key === 'global'}
						isDisabled={isDisabled}
						nameservers={nameservers}
						overrideLocalDns={overrideLocalDns}
						name={key}
					/>
				))}

				{isDisabled ? undefined : <AddNS nameservers={nameservers} />}
			</div>
		</div>
	);
}

interface ListProps {
	isGlobal: boolean;
	isDisabled: boolean;
	nameservers: Record<string, string[]>;
	overrideLocalDns: boolean;
	name: string;
}

function NameserverList({
	isGlobal,
	isDisabled,
	nameservers,
	overrideLocalDns,
	name,
}: ListProps) {
	const list = isGlobal ? nameservers.global : nameservers[name];
	if (list.length === 0) {
		return null;
	}

	const submit = useSubmit();
	return (
		<div className="mb-8">
			<div className="flex items-center justify-between mb-2">
				{isGlobal ? (
					<div className="flex items-center justify-between w-full">
						<h2 className="text-md font-medium opacity-80">
							Global Nameservers
						</h2>
						<div className="flex items-center gap-2 text-sm">
							<Tooltip>
								<Info className="size-4" />
								<Tooltip.Body>
									When enabled, use the DNS servers listed below to resolve
									names outside the tailnet. When disabled (default), devices
									will prefer their local DNS configuration.
									<Link
										to="https://tailscale.com/kb/1054/dns#global-nameservers"
										name="Tailscale Global Nameservers Documentation"
									>
										Learn More
									</Link>
								</Tooltip.Body>
							</Tooltip>
							<p>Override DNS servers</p>
							<Switch
								label="Override local DNS settings"
								className="h-[15px] w-[23px] p-[2px]"
								switchClassName="h-[9px] w-[9px]"
								name="override_dns"
								defaultSelected={overrideLocalDns}
								onChange={(v) => {
									submit(
										{
											action_id: 'override_dns',
											override_dns: v ? 'true' : 'false',
										},
										{
											method: 'POST',
										},
									);
								}}
							/>
						</div>
					</div>
				) : (
					<h2 className="text-md font-medium opacity-80">{name}</h2>
				)}
			</div>
			<TableList>
				{list.length > 0
					? list.map((ns) => (
							<TableList.Item key={ns}>
								<p className="font-mono text-sm">{ns}</p>
								<Form method="POST">
									<input type="hidden" name="action_id" value="remove_ns" />
									<input type="hidden" name="ns" value={ns} />
									<input
										type="hidden"
										name="split_name"
										value={isGlobal ? 'global' : name}
									/>
									<Button
										isDisabled={isDisabled}
										type="submit"
										className={cn(
											'px-2 py-1 rounded-md',
											'text-red-500 dark:text-red-400',
										)}
									>
										Remove
									</Button>
								</Form>
							</TableList.Item>
						))
					: undefined}
			</TableList>
		</div>
	);
}
