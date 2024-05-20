import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import { useFetcher } from '@remix-run/react'
import { githubDark, githubLight } from '@uiw/codemirror-theme-github'
import CodeMirror from '@uiw/react-codemirror'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import CodeMirrorMerge from 'react-codemirror-merge'

import Button from '~/components/Button'
import Spinner from '~/components/Spinner'
import { toast } from '~/components/Toaster'

import Fallback from './fallback'

interface EditorProperties {
	readonly acl: string
	readonly setAcl: (acl: string) => void
	readonly mode: 'edit' | 'diff'

	readonly data: {
		hasAclWrite: boolean
		currentAcl: string
		aclType: string
	}
}

export default function Editor({ data, acl, setAcl, mode }: EditorProperties) {
	const [light, setLight] = useState(false)
	const [loading, setLoading] = useState(true)

	const fetcher = useFetcher()
	const aclType = useMemo(() => data.aclType === 'json' ? json() : yaml(), [data.aclType])

	useEffect(() => {
		const theme = window.matchMedia('(prefers-color-scheme: light)')
		setLight(theme.matches)

		theme.addEventListener('change', (theme) => {
			setLight(theme.matches)
		})

		// Prevents the FOUC
		setLoading(false)
	}, [])

	return (
		<>
			<div className={clsx(
				'border border-gray-200 dark:border-gray-700',
				'rounded-b-lg rounded-tr-lg mb-2 z-10 overflow-x-hidden',
			)}
			>
				<div className="overflow-y-scroll h-editor text-sm">
					{loading
						? (
							<Fallback acl={acl} where="client" />
							)
						: (
								mode === 'edit'
									? (
										<CodeMirror
											value={acl}
											theme={light ? githubLight : githubDark}
											extensions={[aclType]}
											readOnly={!data.hasAclWrite}
											onChange={(value) => {
												setAcl(value)
											}}
										/>
										)
									: (
										<CodeMirrorMerge
											theme={light ? githubLight : githubDark}
											orientation="a-b"
										>
											<CodeMirrorMerge.Original
												readOnly
												value={data.currentAcl}
												extensions={[aclType]}
											/>
											<CodeMirrorMerge.Modified
												readOnly
												value={acl}
												extensions={[aclType]}
											/>
										</CodeMirrorMerge>
										)
							)}
				</div>
			</div>

			<Button
				variant="heavy"
				className="mr-2"
				isDisabled={fetcher.state === 'loading' || !data.hasAclWrite || data.currentAcl === acl}
				onPress={() => {
					fetcher.submit({
						acl,
					}, {
						method: 'PATCH',
						encType: 'application/json',
					})

					toast('Updated tailnet ACL policy')
				}}
			>
				{fetcher.state === 'idle'
					? undefined
					: (
						<Spinner className="w-3 h-3" />
						)}
				Save
			</Button>
			<Button
				isDisabled={fetcher.state === 'loading' || data.currentAcl === acl}
				onPress={() => {
					setAcl(data.currentAcl)
				}}
			>
				Discard Changes
			</Button>
		</>
	)
}
