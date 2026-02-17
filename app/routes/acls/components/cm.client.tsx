import * as shopify from '@shopify/lang-jsonc';
import { xcodeDark, xcodeLight } from '@uiw/codemirror-theme-xcode';
import CodeMirror, {
	Decoration,
	type DecorationSet,
	EditorView,
	type Extension,
	ViewPlugin,
	type ViewUpdate,
} from '@uiw/react-codemirror';
import { BookCopy, CircleX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Merge from 'react-codemirror-merge';
import { ErrorBoundary } from 'react-error-boundary';
import { ClientOnly } from 'remix-utils/client-only';
import type { ACLTestResult } from '~/server/headscale/api/endpoints/policy';
import type { SyntaxErrorLocation } from '../utils/parsing';
import Fallback from './fallback';

interface EditorProps {
	isDisabled?: boolean;
	value: string;
	onChange: (value: string) => void;
	testResults?: ACLTestResult[];
	syntaxError?: SyntaxErrorLocation;
}

// Find line ranges for each test in the JSON
function findTestLineRanges(
	content: string,
): Array<{ start: number; end: number }> {
	const ranges: Array<{ start: number; end: number }> = [];
	const lines = content.split('\n');

	// Find "tests": [ line
	let inTestsArray = false;
	let bracketDepth = 0;
	let currentTestStart = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Check if we're entering the tests array
		if (!inTestsArray && /"tests"\s*:\s*\[/.test(line)) {
			inTestsArray = true;
			// Check if there's already a { on this line
			const afterBracket = line.substring(line.indexOf('[') + 1);
			if (afterBracket.includes('{')) {
				currentTestStart = i;
				bracketDepth = 1;
			}
			continue;
		}

		if (!inTestsArray) continue;

		// Count brackets to track test object boundaries
		for (const char of line) {
			if (char === '{') {
				if (bracketDepth === 0) {
					currentTestStart = i;
				}
				bracketDepth++;
			} else if (char === '}') {
				bracketDepth--;
				if (bracketDepth === 0 && currentTestStart !== -1) {
					ranges.push({ start: currentTestStart, end: i });
					currentTestStart = -1;
				}
			} else if (char === ']' && bracketDepth === 0) {
				// End of tests array
				inTestsArray = false;
				break;
			}
		}
	}

	return ranges;
}

// Create decorations for test results
function createTestDecorations(
	view: EditorView,
	testResults: ACLTestResult[],
): DecorationSet {
	const content = view.state.doc.toString();
	const ranges = findTestLineRanges(content);
	const decorations: Array<{
		from: number;
		to: number;
		decoration: Decoration;
	}> = [];

	for (let i = 0; i < Math.min(ranges.length, testResults.length); i++) {
		const range = ranges[i];
		const result = testResults[i];

		const fromLine = view.state.doc.line(range.start + 1);
		const toLine = view.state.doc.line(range.end + 1);

		const decoration = Decoration.mark({
			class: result.passed ? 'cm-test-passed' : 'cm-test-failed',
		});

		decorations.push({
			from: fromLine.from,
			to: toLine.to,
			decoration,
		});
	}

	// Sort by position and create decoration set
	decorations.sort((a, b) => a.from - b.from);
	return Decoration.set(
		decorations.map((d) => d.decoration.range(d.from, d.to)),
	);
}

// Theme for test highlighting
const testHighlightTheme = EditorView.baseTheme({
	'.cm-test-passed': {
		backgroundColor: 'rgba(34, 197, 94, 0.15)',
		borderLeft: '3px solid rgb(34, 197, 94)',
	},
	'.cm-test-failed': {
		backgroundColor: 'rgba(239, 68, 68, 0.15)',
		borderLeft: '3px solid rgb(239, 68, 68)',
	},
});

// Create a view plugin that updates decorations
function createTestHighlightPlugin(testResults: ACLTestResult[]) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = createTestDecorations(view, testResults);
			}

			update(update: ViewUpdate) {
				if (update.docChanged) {
					this.decorations = createTestDecorations(update.view, testResults);
				}
			}
		},
		{
			decorations: (v: { decorations: DecorationSet }) => v.decorations,
		},
	);
}

// Theme for syntax error highlighting
const syntaxErrorTheme = EditorView.baseTheme({
	'.cm-syntax-error-line': {
		backgroundColor: 'rgba(239, 68, 68, 0.2)',
		borderLeft: '3px solid rgb(239, 68, 68)',
	},
	'.cm-syntax-error-char': {
		backgroundColor: 'rgba(239, 68, 68, 0.5)',
		outline: '2px solid rgb(239, 68, 68)',
		borderRadius: '2px',
	},
});

// Create syntax error decorations
function createSyntaxErrorDecorations(
	view: EditorView,
	error: SyntaxErrorLocation | null,
): DecorationSet {
	if (!error) return Decoration.none;

	const doc = view.state.doc;
	if (error.line < 1 || error.line > doc.lines) return Decoration.none;

	const line = doc.line(error.line);
	const decorations: Array<{
		from: number;
		to: number;
		decoration: Decoration;
	}> = [];

	// Highlight the entire line
	decorations.push({
		from: line.from,
		to: line.to,
		decoration: Decoration.mark({ class: 'cm-syntax-error-line' }),
	});

	// Highlight specific character if column is valid
	if (error.column >= 1) {
		const charPos = line.from + error.column - 1;
		if (charPos <= line.to) {
			// Highlight 1-3 characters around the error position
			const endPos = Math.min(charPos + 1, line.to);
			decorations.push({
				from: charPos,
				to: endPos,
				decoration: Decoration.mark({ class: 'cm-syntax-error-char' }),
			});
		}
	}

	decorations.sort((a, b) => a.from - b.from);
	return Decoration.set(
		decorations.map((d) => d.decoration.range(d.from, d.to)),
	);
}

// Create syntax error plugin that responds to external updates
function createSyntaxErrorPlugin(initialError: SyntaxErrorLocation | null) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = createSyntaxErrorDecorations(view, initialError);
			}

			update(update: ViewUpdate) {
				if (update.docChanged) {
					// Clear decorations when content changes
					this.decorations = Decoration.none;
				}
			}
		},
		{
			decorations: (v: { decorations: DecorationSet }) => v.decorations,
		},
	);
}

// TODO: Remove ClientOnly
export function Editor(props: EditorProps) {
	const [light, setLight] = useState(false);
	const editorRef = useRef<{ view?: EditorView }>(null);
	// Track which error we've already scrolled to (by line:column)
	const lastScrolledErrorRef = useRef<string | null>(null);

	useEffect(() => {
		const theme = window.matchMedia('(prefers-color-scheme: light)');
		setLight(theme.matches);
		theme.addEventListener('change', (theme) => {
			setLight(theme.matches);
		});
	});

	// Build extensions including test highlighting if results provided
	const extensions = useMemo(() => {
		const ext: Extension[] = [shopify.jsonc()];
		if (props.testResults && props.testResults.length > 0) {
			ext.push(testHighlightTheme);
			ext.push(createTestHighlightPlugin(props.testResults));
		}
		if (props.syntaxError) {
			ext.push(syntaxErrorTheme);
			ext.push(createSyntaxErrorPlugin(props.syntaxError));
		}
		return ext;
	}, [props.testResults, props.syntaxError]);

	// Scroll to error line only once when a NEW syntax error appears
	useEffect(() => {
		if (!props.syntaxError) {
			// Clear the ref when error is cleared
			lastScrolledErrorRef.current = null;
			return;
		}

		const errorKey = `${props.syntaxError.line}:${props.syntaxError.column}`;
		// Only scroll if this is a different error than what we last scrolled to
		if (lastScrolledErrorRef.current === errorKey) {
			return;
		}

		if (editorRef.current?.view) {
			const view = editorRef.current.view;
			const doc = view.state.doc;
			if (props.syntaxError.line >= 1 && props.syntaxError.line <= doc.lines) {
				const line = doc.line(props.syntaxError.line);
				view.dispatch({
					effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
				});
				lastScrolledErrorRef.current = errorKey;
			}
		}
	}, [props.syntaxError]);

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
							editable={!props.isDisabled}
							extensions={extensions}
							height="100%"
							onChange={(value) => props.onChange(value)}
							readOnly={props.isDisabled}
							ref={editorRef}
							style={{ height: '100%' }}
							theme={light ? xcodeLight : xcodeDark}
							value={props.value}
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
										extensions={[shopify.jsonc()]}
										readOnly
										value={props.left}
									/>
									<Merge.Modified
										extensions={[shopify.jsonc()]}
										readOnly
										value={props.right}
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
