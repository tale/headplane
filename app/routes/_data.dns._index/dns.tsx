import { useSubmit } from '@remix-run/react'
import { useState } from 'react'
import { Button } from 'react-aria-components'

import Code from '~/components/Code'
import Link from '~/components/Link'
import Switch from '~/components/Switch'
import TableList from '~/components/TableList'
import { cn } from '~/utils/cn'

import AddDNS from './dialogs/dns'

interface Props {
	records: { name: string, type: 'A', value: string }[]
	isDisabled: boolean
}

export default function DNS({ records, isDisabled }: Props) {
	const submit = useSubmit()

	return (
		<div className="flex flex-col w-2/3">
			<h1 className="text-2xl font-medium mb-4">DNS Records</h1>
			<p className="text-gray-700 dark:text-gray-300">
				Headscale supports adding custom DNS records to your Tailnet.
				As of now, only
				{' '}
				<Code>A</Code>
				{' '}
				records are supported.
				{' '}
				<Link
					to="https://headscale.net/dns-records/"
					name="Headscale DNS Records documentation"
				>
					Learn More
				</Link>
			</p>
			<div className="mt-4">
				<TableList className="mb-8">
					{records.length === 0
						? (
							<TableList.Item>
								<p className="opacity-50 text-sm mx-auto">
									No DNS records found
								</p>
							</TableList.Item>
							)
						: records.map((record, index) => (
							<TableList.Item key={index}>
								<div className="flex gap-24">
									<div className="flex gap-2">
										<p className="font-mono text-sm font-bold">{record.type}</p>
										<p className="font-mono text-sm">{record.name}</p>
									</div>
									<p className="font-mono text-sm">{record.value}</p>
								</div>
								<Button
									className={cn(
										'text-sm',
										'text-red-600 dark:text-red-400',
										'hover:text-red-700 dark:hover:text-red-300',
										isDisabled && 'opacity-50 cursor-not-allowed',
									)}
									isDisabled={isDisabled}
									onPress={() => {
										submit({
											'dns_config.extra_records': records
												.filter((_, i) => i !== index),
										}, {
											method: 'PATCH',
											encType: 'application/json',
										})
									}}
								>
									Remove
								</Button>
							</TableList.Item>
						))}
				</TableList>

				{isDisabled
					? undefined
					: (
						<AddDNS records={records} />
						)}
			</div>
		</div>
	)
}

interface ListProps {
	isGlobal: boolean
	isDisabled: boolean
	nameservers: string[]
	name: string
	override: boolean
}

function NameserverList({ isGlobal, isDisabled, nameservers, name, override }: ListProps) {
	const [localOverride, setLocalOverride] = useState(override)
	const submit = useSubmit()

	return (
		<div className="mb-8">
			<div className="flex items-center justify-between mb-2">
				<h2 className="text-md font-medium opacity-80">
					{isGlobal ? 'Global Nameservers' : name}
				</h2>
				{isGlobal
					? (
						<div className="flex gap-2 items-center">
							<span className="text-sm opacity-50">
								Override local DNS
							</span>
							<Switch
								label="Override local DNS"
								defaultSelected={localOverride}
								isDisabled={isDisabled}
								onChange={() => {
									submit({
										'dns_config.override_local_dns': !localOverride,
									}, {
										method: 'PATCH',
										encType: 'application/json',
									})

									setLocalOverride(!localOverride)
								}}
							/>
						</div>
						)
					: undefined}
			</div>
		</div>
	)
}
