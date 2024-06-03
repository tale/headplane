import Editor, { DiffEditor, Monaco } from '@monaco-editor/react'
import { useEffect, useState } from 'react'
import { ClientOnly } from 'remix-utils/client-only'

import Fallback from '~/routes/_data.acls._index/fallback'
import { cn } from '~/utils/cn'

interface MonacoProps {
	variant: 'editor' | 'diff'
	language: 'json' | 'yaml'
	value: string
	onChange: (value: string) => void
	original?: string
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

export default function MonacoEditor({ value, onChange, variant, original, language }: MonacoProps) {
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
					<ClientOnly fallback={<Fallback acl={value} />}>
						{() => variant === 'editor'
							? (
								<Editor
									height="100%"
									language={language}
									theme={light ? 'light' : 'vs-dark'}
									value={value}
									onChange={(updated) => {
										if (!updated) {
											return
										}

										if (updated !== value) {
											onChange(updated)
										}
									}}
									loading={<Fallback acl={value} />}
									beforeMount={monacoCallback}
									options={{
										wordWrap: 'on',
										minimap: { enabled: false },
										fontSize: 14,
									}}
								/>
								)
							: (
								<DiffEditor
									height="100%"
									language={language}
									theme={light ? 'light' : 'vs-dark'}
									original={original}
									modified={value}
									loading={<Fallback acl={value} />}
									beforeMount={monacoCallback}
									options={{
										wordWrap: 'on',
										minimap: { enabled: false },
										fontSize: 13,
									}}
								/>
								)}
					</ClientOnly>
				</div>
			</div>

		</>
	)
}
