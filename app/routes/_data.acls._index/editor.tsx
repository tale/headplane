import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import { useFetcher } from '@remix-run/react'
import { githubDark, githubLight } from '@uiw/codemirror-theme-github'
import CodeMirror from '@uiw/react-codemirror'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import CodeMirrorMerge from 'react-codemirror-merge'
import { toast } from 'react-hot-toast/headless'

import Button from '~/components/Button'
import Spinner from '~/components/Spinner'

type EditorProperties = {
	readonly acl: string;
	readonly setAcl: (acl: string) => void;
	readonly mode: 'edit' | 'diff';

	readonly data: {
		hasAclWrite: boolean;
		currentAcl: string;
		aclType: string;
	};
}

export default function Editor({ data, acl, setAcl, mode }: EditorProperties) {
	const [light, setLight] = useState(false)
	const fetcher = useFetcher()
	const aclType = useMemo(() => data.aclType === 'json' ? json() : yaml(), [data.aclType])

	useEffect(() => {
		const theme = window.matchMedia('(prefers-color-scheme: light)')
		setLight(theme.matches)

		theme.addEventListener('change', theme => {
			setLight(theme.matches)
		})
	}, [])

	return (
		<>
			<div className={clsx(
				'border border-gray-200 dark:border-gray-700',
				'rounded-b-lg rounded-tr-lg mb-2 overflow-hidden'
			)}
			>
				{mode === 'edit' ? (
					<CodeMirror
						value={acl}
						maxHeight='calc(100vh - 20rem)'
						theme={light ? githubLight : githubDark}
						extensions={[aclType]}
						readOnly={!data.hasAclWrite}
						onChange={value => {
							setAcl(value)
						}}
					/>
				) : (
					<div
						className='overflow-y-scroll'
						style={{ height: 'calc(100vh - 20rem)' }}
					>
						<CodeMirrorMerge
							theme={light ? githubLight : githubDark}
							orientation='a-b'
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
					</div>
				)}
			</div>

			<Button
				variant='emphasized'
				className='text-sm w-fit mr-2'
				onClick={() => {
					fetcher.submit({
						acl
					}, {
						method: 'PATCH',
						encType: 'application/json'
					})

					toast('Updated tailnet ACL policy')
				}}
			>
				{fetcher.state === 'idle' ? undefined : (
					<Spinner className='w-3 h-3'/>
				)}
				Save
			</Button>
			<Button
				variant='emphasized'
				className={clsx(
					'text-sm w-fit bg-gray-100 dark:bg-transparent',
					'border border-gray-200 dark:border-gray-700'
				)}
				onClick={() => {
					setAcl(data.currentAcl)
				}}
			>
				Discard Changes
			</Button>
		</>
	)
}
