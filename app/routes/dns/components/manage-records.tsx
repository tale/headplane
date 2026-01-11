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
		<div className="flex flex-col w-full sm:w-2/3">
			<h1 className="text-2xl font-medium mb-4">DNS Records</h1>
			<p>
				Headscale supports adding custom DNS records to your Tailnet. As of now,
				only <Code>A</Code> and <Code>AAAA</Code> records are supported.{' '}
				<Link
					name="Headscale DNS Records documentation"
					to="https://headscale.net/stable/ref/dns"
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
						records.map((record) => (
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
									<div className="flex flex-col sm:flex-row sm:gap-2 flex-1 min-w-0">
										<p className="font-mono text-sm truncate">{record.name}</p>
										<p className="font-mono text-sm truncate opacity-70 sm:opacity-100">
											{record.value}
										</p>
									</div>
								</div>
								<Form method="POST">
									<input name="action_id" type="hidden" value="remove_record" />
									<input name="record_name" type="hidden" value={record.name} />
									<input name="record_type" type="hidden" value={record.type} />
									<Button
										className={cn(
											'px-2 py-1 rounded-md',
											'text-red-500 dark:text-red-400',
										)}
										isDisabled={isDisabled}
										type="submit"
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
