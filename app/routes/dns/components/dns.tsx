import { useSubmit } from 'react-router';
import Button from '~/components/Button';
import Code from '~/components/Code';
import Link from '~/components/Link';
import TableList from '~/components/TableList';
import cn from '~/utils/cn';
import AddDNS from '../dialogs/dns';

interface Props {
	records: { name: string; type: 'A'; value: string }[];
	isDisabled: boolean;
}

export default function DNS({ records, isDisabled }: Props) {
	const submit = useSubmit();

	return (
		<div className="flex flex-col w-2/3">
			<h1 className="text-2xl font-medium mb-4">DNS Records</h1>
			<p>
				Headscale supports adding custom DNS records to your Tailnet. As of now,
				only <Code>A</Code> records are supported.{' '}
				<Link
					to="https://headscale.net/stable/ref/dns"
					name="Headscale DNS Records documentation"
				>
					Learn More
				</Link>
			</p>
			<div className="mt-4">
				<TableList className="mb-8">
					{records.length === 0 ? (
						<TableList.Item>
							<p className="opacity-50 mx-auto">No DNS records found</p>
						</TableList.Item>
					) : (
						records.map((record, index) => (
							<TableList.Item key={`${record.name}-${record.value}`}>
								<div className="flex gap-24 items-center">
									<div className="flex gap-4 items-center">
										<p
											className={cn(
												'font-mono text-sm font-bold py-1 px-2 rounded-md',
												'bg-headplane-100 dark:bg-headplane-700/30',
											)}
										>
											{record.type}
										</p>
										<p className="font-mono text-sm">{record.name}</p>
									</div>
									<p className="font-mono text-sm">{record.value}</p>
								</div>
								<Button
									className={cn(
										'px-2 py-1 rounded-md',
										'text-red-500 dark:text-red-400',
									)}
									isDisabled={isDisabled}
									onPress={() => {
										submit(
											{
												'dns.extra_records': records.filter(
													(_, i) => i !== index,
												),
											},
											{
												method: 'PATCH',
												encType: 'application/json',
											},
										);
									}}
								>
									Remove
								</Button>
							</TableList.Item>
						))
					)}
				</TableList>

				{isDisabled ? undefined : <AddDNS records={records} />}
			</div>
		</div>
	);
}
