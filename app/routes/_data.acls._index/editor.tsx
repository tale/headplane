import Editor, { DiffEditor, Monaco } from '@monaco-editor/react'
import { useEffect, useState } from 'react'
import { ClientOnly } from 'remix-utils/client-only'

import Fallback from '~/routes/_data.acls._index/fallback'
import { cn } from '~/utils/cn'

interface Props {
	variant: 'edit' | 'diff'
	language: 'json' | 'yaml'
	state: [string, (value: string) => void]
	policy?: string
	isDisabled?: boolean
}

function monacoCallback(monaco: Monaco) {
	monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
		validate: true,
		allowComments: true,
		schemas: [],
		enableSchemaRequest: true,
		trailingCommas: 'ignore',
	})

	monaco.languages.register({ id: 'json' })
	monaco.languages.register({ id: 'yaml' })
}

export default function MonacoEditor({ variant, language, state, policy, isDisabled }: Props) {
	const [light, setLight] = useState(false)

	useEffect(() => {
		const theme = window.matchMedia('(prefers-color-scheme: light)')
		setLight(theme.matches)

		theme.addEventListener('change', (theme) => {
			setLight(theme.matches)
		})
	}, [])

	return (
		<>
			<div className={cn(
				'border border-gray-200 dark:border-gray-700',
				'rounded-b-lg rounded-tr-lg mb-2 z-10 overflow-x-hidden',
			)}
			>
				<div className="overflow-y-scroll h-editor text-sm">
					<ClientOnly fallback={<Fallback acl={state[0]} />}>
						{() => variant === 'edit'
							? (
								<Editor
									height="100%"
									language={language}
									theme={light ? 'light' : 'vs-dark'}
									value={state[0]}
									onChange={(updated) => {
										if (!updated) {
											return
										}

										if (updated !== state[0]) {
											state[1](updated)
										}
									}}
									loading={<Fallback acl={state[0]} />}
									beforeMount={monacoCallback}
									options={{
										wordWrap: 'on',
										minimap: { enabled: false },
										fontSize: 14,
										readOnly: isDisabled,
									}}
								/>
								)
							: (
								<DiffEditor
									height="100%"
									language={language}
									theme={light ? 'light' : 'vs-dark'}
									original={policy}
									modified={state[0]}
									loading={<Fallback acl={state[0]} />}
									beforeMount={monacoCallback}
									options={{
										wordWrap: 'on',
										minimap: { enabled: false },
										fontSize: 13,
										readOnly: isDisabled,
									}}
								/>
								)}
					</ClientOnly>
				</div>
			</div>

		</>
	)
}
