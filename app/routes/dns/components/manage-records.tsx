import { Form } from 'react-router';
import Button from '~/components/Button';
import Code from '~/components/Code';
import Link from '~/components/Link';
import TableList from '~/components/TableList';
import cn from '~/utils/cn';
import AddRecord from '../dialogs/add-record';

interface Props {
	records: { name: string; type: 'A' | string; value: string }[];
	isDisabled: boolean;
}

export default function ManageRecords({ records, isDisabled }: Props) {
	return (
		<div className="flex flex-col w-2/3">
			<h1 className="text-2xl font-medium mb-4">DNS Records</h1>
			<p>
				Headscale supports adding custom DNS records to your Tailnet. As of now,
				only <Code>A</Code> and <Code>AAAA</Code> records are supported.{' '}
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
								<div className="flex gap-2 items-center w-full">
									<p
										className={cn(
											'font-mono text-sm font-bold py-1 px-2 rounded-md text-center',
											'bg-headplane-100 dark:bg-headplane-700/30 min-w-12',
										)}
									>
										{record.type}
									</p>
									<div className="grid grid-cols-2 gap-2 w-full">
										<p className="font-mono text-sm">{record.name}</p>
										<p className="font-mono text-sm">{record.value}</p>
									</div>
								</div>
								<Form method="POST">
									<input type="hidden" name="action_id" value="remove_record" />
									<input type="hidden" name="record_name" value={record.name} />
									<input type="hidden" name="record_type" value={record.type} />
									<Button
										type="submit"
										isDisabled={isDisabled}
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
					)}
				</TableList>

				{isDisabled ? undefined : <AddRecord records={records} />}
			</div>
		</div>
	);
}
