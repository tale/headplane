import { useSubmit } from '@remix-run/react'
import { useState } from 'react'
import { Button } from 'react-aria-components'

import Link from '~/components/Link'
import Switch from '~/components/Switch'
import TableList from '~/components/TableList'
import { cn } from '~/utils/cn'

import AddNameserver from './dialogs/nameserver'

interface Props {
	nameservers: Record<string, string[]>
	override: boolean
	isDisabled: boolean
}

export default function Nameservers({ nameservers, override, isDisabled }: Props) {
	return (
		<div className="flex flex-col w-2/3">
			<h1 className="text-2xl font-medium mb-4">Nameservers</h1>
			<p className="text-gray-700 dark:text-gray-300">
				Set the nameservers used by devices on the Tailnet
				to resolve DNS queries.
				{' '}
				<Link
					to="https://tailscale.com/kb/1054/dns"
					name="Tailscale DNS Documentation"
				>
					Learn more
				</Link>
			</p>
			<div className="mt-4">
				{Object.keys(nameservers).map(key => (
					<NameserverList
						key={key}
						isGlobal={key === 'global'}
						isDisabled={isDisabled}
						nameservers={nameservers[key]}
						override={override}
						name={key}
					/>
				))}

				{isDisabled
					? undefined
					: (
						<AddNameserver nameservers={nameservers} />
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
			<TableList>
				{nameservers.map((ns, index) => (
					// eslint-disable-next-line react/no-array-index-key
					<TableList.Item key={index}>
						<p className="font-mono text-sm">{ns}</p>
						<Button
							className={cn(
								'text-sm',
								'text-red-600 dark:text-red-400',
								'hover:text-red-700 dark:hover:text-red-300',
								isDisabled && 'opacity-50 cursor-not-allowed',
							)}
							isDisabled={isDisabled}
							onPress={() => {
								if (isGlobal) {
									submit({
										'dns_config.nameservers': nameservers
											.filter((_, i) => i !== index),
									}, {
										method: 'PATCH',
										encType: 'application/json',
									})
								} else {
									const key = `dns_config.restricted_nameservers."${name}"`
									submit({
										[key]: nameservers
											.filter((_, i) => i !== index),
									}, {
										method: 'PATCH',
										encType: 'application/json',
									})
								}
							}}
						>
							Remove
						</Button>
					</TableList.Item>
				))}
			</TableList>
		</div>
	)
}
