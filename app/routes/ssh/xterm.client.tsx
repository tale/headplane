import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import * as xterm from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef, useState } from 'react';
import cn from '~/utils/cn';
import { useLiveData } from '~/utils/live-data';

interface XTermProps {
	ipn: TsWasmNet;
	username: string;
	hostname: string;
}

const RED = new TextEncoder().encode('\x1b[31m');
const RESET = new TextEncoder().encode('\x1b[0m');

export default function XTerm({ ipn, username, hostname }: XTermProps) {
	const { pause } = useLiveData();

	const container = useRef<HTMLDivElement>(null);
	const term = useRef<xterm.Terminal>(null);
	const [isResizing, setIsResizing] = useState(false);
	const inputRef = useRef<((input: string) => void) | null>(null);

	useEffect(() => {
		pause();
		const terminal = new xterm.Terminal({
			allowProposedApi: true,
			cursorBlink: true,
			convertEol: true,
			fontSize: 14,
			cols: 80,
			rows: 24,
			theme: {
				background: '#1e1e1e',
				foreground: '#ffffff',
			},
		});

		terminal.loadAddon(new Unicode11Addon());
		terminal.loadAddon(new ClipboardAddon());
		terminal.loadAddon(
			new WebLinksAddon((event, uri) => {
				event.view?.open(uri, '_blank', 'noopener noreferrer');
			}),
		);

		terminal.unicode.activeVersion = '11';
		const gl = new WebglAddon();
		terminal.loadAddon(gl);

		const fit = new FitAddon();
		terminal.loadAddon(fit);

		gl.onContextLoss(() => {
			console.warn('WebGL context lost, falling back to canvas rendering');
			gl.dispose();
		});

		terminal.open(container.current!);
		terminal.focus();
		term.current = terminal;

		let ro: ResizeObserver | null = null;
		let onUnload: ((e: Event) => void) | null = null;

		const session = ipn.OpenSSH(hostname, username, {
			Rows: terminal.rows,
			Cols: terminal.cols,

			OnStdout: (data) => terminal.write(data),
			OnStderr: (data) => {
				terminal.write(data);
				console.log('SSH stderr:', data);
			},
			OnStdin: (func) => {
				inputRef.current = func;
			},
			OnConnect: () => {
				console.log('SSH session connected');
			},

			OnDisconnect: () => {
				ro?.disconnect();
				terminal.dispose();
				if (onUnload) {
					parent.removeEventListener('unload', onUnload);
				}

				console.log('SSH session disconnected');
				term.current = null;
			},
		});

		const parent = container.current?.ownerDocument.defaultView ?? window;
		ro = new parent.ResizeObserver(() => {
			if (term.current) {
				setIsResizing(true);
				fit.fit();
				setTimeout(() => setIsResizing(false), 100);
			}
		});

		if (container.current) {
			ro.observe(container.current);
		}

		terminal.onResize(({ cols, rows }) => {
			session.Resize(rows, cols);
		});

		terminal.onData((data) => {
			inputRef.current?.(data);
		});

		onUnload = (_) => session.Close();
		parent.addEventListener('unload', onUnload);
	}, []);

	return (
		<div className="relative w-full h-full group">
			<div ref={container} className="w-full h-full" />

			{term.current && isResizing ? (
				<div
					className={cn(
						'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
						'px-4 py-2 bg-headplane-800 text-white rounded-full shadow z-50',
					)}
				>
					{term.current.cols}x{term.current.rows}
				</div>
			) : undefined}
		</div>
	);
}
