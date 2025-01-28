import { useMemo, useState } from 'react';
import { useSubmit } from 'react-router';
import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

interface Props {
	records: { name: string; type: 'A'; value: string }[];
}

export default function AddDNS({ records }: Props) {
	const submit = useSubmit();
	const [name, setName] = useState('');
	const [ip, setIp] = useState('');

	const isDuplicate = useMemo(() => {
		if (name.length === 0 || ip.length === 0) return false;
		const lookup = records.find((record) => record.name === name);
		if (!lookup) return false;

		return lookup.value === ip;
	}, [records, name, ip]);

	// TODO: Ditch useSubmit here (non JSON form)
	return (
		<Dialog>
			<Dialog.Button>Add DNS record</Dialog.Button>
			<Dialog.Panel
				onSubmit={(event) => {
					event.preventDefault();
					if (!name || !ip) return;

					setName('');
					setIp('');
					submit(
						{
							'dns.extra_records': [
								...records,
								{
									name,
									type: 'A',
									value: ip,
								},
							],
						},
						{
							method: 'PATCH',
							encType: 'application/json',
						},
					);
				}}
			>
				<Dialog.Title>Add DNS record</Dialog.Title>
				<Dialog.Text>
					Enter the domain and IP address for the new DNS record.
				</Dialog.Text>
				<div className="flex flex-col gap-2 mt-4">
					<Input
						isRequired
						label="Domain"
						placeholder="test.example.com"
						onChange={setName}
						isInvalid={isDuplicate}
					/>
					<Input
						isRequired
						label="IP Address"
						placeholder="101.101.101.101"
						name="ip"
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
