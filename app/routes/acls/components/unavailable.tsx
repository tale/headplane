import { cn } from '~/utils/cn'
import { AlertIcon } from '@primer/octicons-react'

import Code from '~/components/Code'
import Card from '~/components/Card'

interface Props {
	mode: 'file' | 'database'
}

export function Unavailable({ mode }: Props) {
	return (
		<Card variant="flat" className="max-w-prose mt-12">
			<div className="flex items-center justify-between">
				<Card.Title className="text-xl mb-0">
					ACL Policy Unavailable
				</Card.Title>
				<AlertIcon className="w-8 h-8 text-red-500"/>
			</div>
			<Card.Text className="mt-4">
				Unable to load a valid ACL policy configuration.
				This is most likely due to a misconfiguration in your
				Headscale configuration file.
			</Card.Text>

			{mode !== 'file' ? (
				<p className="mt-4 text-sm">
					According to your configuration, the ACL policy mode
					is set to <Code>file</Code> but the ACL file is not
					available. Ensure that the <Code>policy.path</Code> is
					set to a valid path in your Headscale configuration.
				</p>
			) : (
				<p className="mt-4 text-sm">
					In order to fully utilize the ACL management features of
					Headplane, please set <Code>policy.mode</Code> to either
					{' '}<Code>file</Code> or <Code>database</Code> in your
					Headscale configuration.
				</p>
			)}
		</Card>
	)
}
