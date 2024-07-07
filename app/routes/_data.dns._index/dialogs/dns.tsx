import { Form, useSubmit } from '@remix-run/react'
import { useMemo, useState } from 'react'

import Code from '~/components/Code'
import Dialog from '~/components/Dialog'
import TextField from '~/components/TextField'
import { cn } from '~/utils/cn'

interface Props {
	records: { name: string, type: 'A', value: string }[]
}

export default function AddDNS({ records }: Props) {
	const submit = useSubmit()
	const [name, setName] = useState('')
	const [ip, setIp] = useState('')

	const isDuplicate = useMemo(() => {
		if (name.length === 0 || ip.length === 0) return false
		const lookup = records.find(record => record.name === name)
		if (!lookup) return false

		return lookup.value === ip
	}, [records, name, ip])

	return (
		<Dialog>
			<Dialog.Button>
				Add DNS record
			</Dialog.Button>
			<Dialog.Panel>
				{close => (
					<>
						<Dialog.Title>
							Add DNS record
						</Dialog.Title>
						<Dialog.Text>
							Enter the domain and IP address for the new DNS record.
						</Dialog.Text>
						<Form
							method="POST"
							onSubmit={(event) => {
								event.preventDefault()
								if (!name || !ip) return

								setName('')
								setIp('')

								submit({
									'dns_config.extra_records': [
										...records,
										{
											name,
											type: 'A',
											value: ip,
										},
									],
								}, {
									method: 'PATCH',
									encType: 'application/json',
								})

								close()
							}}
						>
							<TextField
								label="Domain"
								placeholder="test.example.com"
								name="domain"
								state={[name, setName]}
								className={cn(
									'mt-2',
									isDuplicate && 'outline outline-red-500',
								)}
							/>
							<TextField
								label="IP Address"
								placeholder="101.101.101.101"
								name="ip"
								state={[ip, setIp]}
								className={cn(
									isDuplicate && 'outline outline-red-500',
								)}
							/>
							{isDuplicate
								? (
									<p className="text-sm opacity-50">
										A record with the domain name
										{' '}
										<Code>{name}</Code>
										{' '}
										and IP address
										{' '}
										<Code>{ip}</Code>
										{' '}
										already exists.
									</p>
									)
								: undefined}
							<div className="mt-6 flex justify-end gap-2 mt-8">
								<Dialog.Action
									variant="cancel"
									onPress={close}
								>
									Cancel
								</Dialog.Action>
								<Dialog.Action
									variant="confirm"
									onPress={close}
									isDisabled={isDuplicate}
								>
									Add
								</Dialog.Action>
							</div>
						</Form>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	)
}
