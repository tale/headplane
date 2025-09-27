import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import * as xterm from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import cn from '~/utils/cn';
import { useLiveData } from '~/utils/live-data';
import toast from '~/utils/toast';

interface XTermProps {
	ipn: TsWasmNet;
	username: string;
	hostname: string;
}

export default function XTerm({ ipn, username, hostname }: XTermProps) {
	const { pause } = useLiveData();

	const container = useRef<HTMLDivElement>(null);
	const term = useRef<xterm.Terminal>(null);
	const inputRef = useRef<((input: string) => void) | null>(null);

	const [isResizing, setIsResizing] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isFailed, setIsFailed] = useState(false);

	useEffect(() => {
		pause();
		if (!container.current) {
			console.error('Container ref is not set');
			return;
		}

		// Don't create a new terminal if one already exists
		if (term.current) {
			console.warn('Terminal already exists, skipping initialization');
			return;
		}

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
		const fit = new FitAddon();
		terminal.loadAddon(fit);

		const gl = new WebglAddon();
		terminal.loadAddon(gl);

		gl.onContextLoss(() => {
			console.warn('WebGL context lost, falling back to canvas rendering');
			gl.dispose();
		});

		fit.fit();
		term.current = terminal;
		terminal.open(container.current!);
		terminal.focus();

		let onUnload: ((e: Event) => void) | null = null;
		const session = ipn.OpenSSH(hostname, username, {
			rows: terminal.rows,
			cols: terminal.cols,

			onStdout: (data) => terminal.write(data),
			onStderr: (data) => {
				terminal.write(data);
				console.log('SSH stderr:', data);
				toast(data);
			},
			onStdin: (func) => {
				console.log('SSH session is ready to receive input');
				inputRef.current = func;
				console.log('Stdin handler set', func);
			},
			onConnect: () => {
				console.log('SSH session connected');
				setIsLoading(false);
			},

			onDisconnect: () => {
				ro?.disconnect();
				terminal.dispose();
				if (onUnload) {
					parent.removeEventListener('unload', onUnload);
				}

				console.log('SSH session disconnected');
				terminal.writeln('Disconnected from SSH session');
				setIsLoading(false);
				setIsFailed(true);
				term.current = null;
			},
		});

		const ro = new ResizeObserver(() => {
			if (term.current) {
				setIsResizing(true);
				fit.fit();
				setTimeout(() => setIsResizing(false), 100);
			}
		});

		ro.observe(container.current);
		terminal.onResize(({ cols, rows }) => {
			console.log(`Terminal resized to ${cols}x${rows}`);
			session.Resize(cols, rows);
		});

		terminal.onData((data) => {
			inputRef.current?.(data);
		});

		onUnload = (_) => session.Close();
		parent.addEventListener('unload', onUnload);

		return () => {
			if (onUnload) {
				parent.removeEventListener('unload', onUnload);
			}

			session.Close();
			ro?.disconnect();
			terminal.dispose();
			term.current = null;
			inputRef.current = null;
			console.log('SSH session closed and terminal disposed');
		};
	}, []);

	return (
		<>
			{isLoading ? (
				<div className="absolute w-screen z-50 mx-auto h-screen flex items-center justify-center">
					<Loader2 className="animate-spin size-10 text-headplane-50" />
				</div>
			) : undefined}
			<div
				className={cn('w-full h-full', isLoading ? 'opacity-0' : 'opacity-100')}
				ref={container}
			/>
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
			{isFailed ? (
				<div
					className={cn(
						'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center',
						'px-4 py-2 bg-headplane-800 text-white rounded-full shadow z-50',
					)}
				>
					Failed to connect to SSH session
				</div>
			) : undefined}
		</>
	);
}
