import { useMemo, useState } from 'react';
import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

interface Props {
	records: { name: string; type: 'A' | string; value: string }[];
}

export default function AddRecord({ records }: Props) {
	const [name, setName] = useState('');
	const [ip, setIp] = useState('');

	const isDuplicate = useMemo(() => {
		if (name.length === 0 || ip.length === 0) return false;
		const lookup = records.find((record) => record.name === name);
		if (!lookup) return false;

		return lookup.value === ip;
	}, [records, name, ip]);

	return (
		<Dialog>
			<Dialog.Button>Add DNS record</Dialog.Button>
			<Dialog.Panel>
				<Dialog.Title>Add DNS record</Dialog.Title>
				<Dialog.Text>
					Enter the domain and IP address for the new DNS record.
				</Dialog.Text>
				<div className="flex flex-col gap-2 mt-4">
					<input type="hidden" name="action_id" value="add_record" />
					<input type="hidden" name="record_type" value="A" />
					<Input
						isRequired
						label="Domain"
						placeholder="test.example.com"
						name="record_name"
						onChange={setName}
						isInvalid={isDuplicate}
					/>
					<Input
						isRequired
						label="IP Address"
						placeholder="101.101.101.101"
						name="record_value"
						onChange={setIp}
						isInvalid={isDuplicate}
					/>
					{isDuplicate ? (
						<p className="text-sm opacity-50">
							A record with the domain name <Code>{name}</Code> and IP address{' '}
							<Code>{ip}</Code> already exists.
						</p>
					) : undefined}
				</div>
			</Dialog.Panel>
		</Dialog>
	);
}
