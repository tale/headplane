import { Form } from 'react-router';
import Button from '~/components/Button';
import Link from '~/components/Link';
import TableList from '~/components/TableList';
import cn from '~/utils/cn';
import AddNS from '../dialogs/add-ns';

interface Props {
	nameservers: Record<string, string[]>;
	isDisabled: boolean;
}

export default function ManageNS({ nameservers, isDisabled }: Props) {
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
	name: string;
}

function NameserverList({
	isGlobal,
	isDisabled,
	nameservers,
	name,
}: ListProps) {
	const list = isGlobal ? nameservers.global : nameservers[name];
	if (list.length === 0) {
		return null;
	}

	return (
		<div className="mb-8">
			<div className="flex items-center justify-between mb-2">
				<h2 className="text-md font-medium opacity-80">
					{isGlobal ? 'Global Nameservers' : name}
				</h2>
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
