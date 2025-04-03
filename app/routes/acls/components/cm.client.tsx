import * as shopify from '@shopify/lang-jsonc';
import { xcodeDark, xcodeLight } from '@uiw/codemirror-theme-xcode';
import CodeMirror from '@uiw/react-codemirror';
import { BookCopy, CircleX } from 'lucide-react';
import { useEffect, useState } from 'react';
import Merge from 'react-codemirror-merge';
import { ErrorBoundary } from 'react-error-boundary';
import { ClientOnly } from 'remix-utils/client-only';
import Fallback from './fallback';

interface EditorProps {
	isDisabled?: boolean;
	value: string;
	onChange: (value: string) => void;
}

// TODO: Remove ClientOnly
export function Editor(props: EditorProps) {
	const [light, setLight] = useState(false);
	useEffect(() => {
		const theme = window.matchMedia('(prefers-color-scheme: light)');
		setLight(theme.matches);
		theme.addEventListener('change', (theme) => {
			setLight(theme.matches);
		});
	});

	return (
		<div className="overflow-y-scroll h-editor text-sm">
			<ErrorBoundary
				fallback={
					<div className="flex flex-col items-center gap-2.5 py-8">
						<CircleX />
						<p className="text-lg font-semibold">Failed to load the editor.</p>
					</div>
				}
			>
				<ClientOnly fallback={<Fallback acl={props.value} />}>
					{() => (
						<CodeMirror
							value={props.value}
							editable={!props.isDisabled} // Allow editing unless disabled
							readOnly={props.isDisabled} // Use readOnly if disabled
							height="100%"
							extensions={[shopify.jsonc()]}
							style={{ height: '100%' }}
							theme={light ? xcodeLight : xcodeDark}
							onChange={(value) => props.onChange(value)}
						/>
					)}
				</ClientOnly>
			</ErrorBoundary>
		</div>
	);
}

interface DifferProps {
	left: string;
	right: string;
}

export function Differ(props: DifferProps) {
	const [light, setLight] = useState(false);
	useEffect(() => {
		const theme = window.matchMedia('(prefers-color-scheme: light)');
		setLight(theme.matches);
		theme.addEventListener('change', (theme) => {
			setLight(theme.matches);
		});
	});

	return (
		<div className="text-sm">
			{props.left === props.right ? (
				<div className="flex flex-col items-center gap-2.5 py-8">
					<BookCopy />
					<p className="text-lg font-semibold">No changes</p>
				</div>
			) : (
				<div className="h-editor overflow-y-scroll">
					<ErrorBoundary
						fallback={
							<div className="flex flex-col items-center gap-2.5 py-8">
								<CircleX />
								<p className="text-lg font-semibold">
									Failed to load the editor.
								</p>
							</div>
						}
					>
						<ClientOnly fallback={<Fallback acl={props.right} />}>
							{() => (
								<Merge orientation="a-b" theme={light ? xcodeLight : xcodeDark}>
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
				</div>
			)}
		</div>
	);
}
