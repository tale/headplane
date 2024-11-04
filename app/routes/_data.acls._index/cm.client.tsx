import React, { useEffect } from 'react'
import Merge from 'react-codemirror-merge'
import CodeMirror from '@uiw/react-codemirror'
import * as shopify from '@shopify/lang-jsonc'
import { ClientOnly } from 'remix-utils/client-only'
import { ErrorBoundary } from 'react-error-boundary'
import { githubDark, githubLight } from '@uiw/codemirror-theme-github'
import { useState } from 'react'
import { cn } from '~/utils/cn'

import Fallback from './fallback'

interface EditorProps {
	isDisabled?: boolean
	value: string
	onChange: (value: string) => void
}

export function Editor(props: EditorProps) {
	const [light, setLight] = useState(false)
	useEffect(() => {
		const theme = window.matchMedia('(prefers-color-scheme: light)')
		setLight(theme.matches)
		theme.addEventListener('change', (theme) => {
			setLight(theme.matches)
		})
	})

	return (
		<div className={cn(
			'border border-gray-200 dark:border-gray-700',
			'rounded-b-lg rounded-tr-lg mb-2 z-10 overflow-x-hidden',
		)}>
			<div className="overflow-y-scroll h-editor text-sm">
				<ErrorBoundary fallback={
					<p className={cn(
						'w-full h-full flex items-center justify-center',
						'text-gray-400 dark:text-gray-500 text-xl',
					)}>
						Failed to load the editor.
					</p>
				}>
					<ClientOnly fallback={<Fallback acl={props.value} />}>
					{() => (
						<CodeMirror
							value={props.value}
							height="100%"
							extensions={[shopify.jsonc()]}
							style={{ height: "100%" }}
							theme={light ? githubLight : githubDark}
							onChange={(value) => props.onChange(value)}
						/>
					)}
					</ClientOnly>
				</ErrorBoundary>
			</div>
		</div>
	)
}

interface DifferProps {
	left: string
	right: string
}

export function Differ(props: DifferProps) {
	const [light, setLight] = useState(false)
	useEffect(() => {
		const theme = window.matchMedia('(prefers-color-scheme: light)')
		setLight(theme.matches)
		theme.addEventListener('change', (theme) => {
			setLight(theme.matches)
		})
	})

	return (
		<div className={cn(
			'border border-gray-200 dark:border-gray-700',
			'rounded-b-lg rounded-tr-lg mb-2 z-10 overflow-x-hidden',
		)}>
			<div className="overflow-y-scroll h-editor text-sm">
				{props.left === props.right ? (
					<p className={cn(
						'w-full h-full flex items-center justify-center',
						'text-gray-400 dark:text-gray-500 text-xl',
					)}>
						No changes
					</p>
				) : (
					<ErrorBoundary fallback={
						<p className={cn(
							'w-full h-full flex items-center justify-center',
							'text-gray-400 dark:text-gray-500 text-xl',
						)}>
							Failed to load the editor.
						</p>
					}>
						<ClientOnly fallback={<Fallback acl={props.right} />}>
						{() => (
							<Merge
								orientation="a-b"
								theme={light ? githubLight : githubDark}
							>
								<Merge.Original
									readOnly
									value={props.left}
									extensions={[shopify.jsonc()]}
								/>
								<Merge.Modified
									readOnly
									value={props.right}
									extensions={[shopify.jsonc()]}
								/>
							</Merge>
						)}
						</ClientOnly>
					</ErrorBoundary>
				)}
			</div>
		</div>
	)
}
