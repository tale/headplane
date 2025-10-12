import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import * as xterm from '@xterm/xterm';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import cn from '~/utils/cn';
import { useLiveData } from '~/utils/live-data';
import toast from '~/utils/toast';

import '@xterm/xterm/css/xterm.css';

interface XTermProps {
	ipn: TsWasmNet;
	username: string;
	hostname: string;
}

// Go's WASM -> JS crosses realms so we might have to normalize the data under
// certain conditions. This also enforces bytes instead of strings being sent.
function normU8(data: unknown) {
	if (data instanceof Uint8Array) {
		return data;
	}

	if (data && typeof data === 'object') {
		const any = data as {
			buffer?: ArrayBufferLike;
			byteOffset?: number;
			byteLength?: number;
		};

		if (
			any.buffer instanceof ArrayBuffer &&
			typeof any.byteLength === 'number'
		) {
			return new Uint8Array(
				any.buffer.slice(
					any.byteOffset ?? 0,
					(any.byteOffset ?? 0) + any.byteLength,
				),
			);
		}
	}

	throw new Error('Data is not a Uint8Array or ArrayBuffer-like object');
}

export default function XTerm({ ipn, username, hostname }: XTermProps) {
	const { pause } = useLiveData();

	const genRef = useRef(0);
	const termRef = useRef<xterm.Terminal>(null);
	const roRef = useRef<ResizeObserver>(null);
	const inputRef = useRef<(input: Uint8Array) => void>(null);
	const sshRef = useRef<SSHSession>(null);
	const divRef = useRef<HTMLDivElement>(null);

	const [isResizing, setIsResizing] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		pause();
	});

	useEffect(() => {
		if (!divRef.current) {
			return;
		}

		const currentGen = ++genRef.current;
		const term = new xterm.Terminal({
			allowProposedApi: true,
			cursorBlink: true,
			convertEol: true,
			fontSize: 14,
		});

		const fit = new FitAddon();
		term.loadAddon(fit);

		term.loadAddon(new Unicode11Addon());
		term.loadAddon(new ClipboardAddon());
		term.loadAddon(
			new WebLinksAddon((event, uri) => {
				event.view?.open(uri, '_blank', 'noopener noreferrer');
			}),
		);

		term.unicode.activeVersion = '11';
		termRef.current = term;
		term.open(divRef.current!);
		fit.fit();
		term.focus();

		const session = ipn.OpenSSH(hostname, username, {
			rows: term.rows,
			cols: term.cols,
			onStdout: (data) => {
				if (currentGen !== genRef.current || term !== termRef.current) {
					console.warn('Stale terminal instance, ignoring stdout');
					return;
				}

				const text = normU8(data);
				term.write(text);
			},
			onStderr: (data) => {
				if (currentGen !== genRef.current || term !== termRef.current) {
					console.warn('Stale terminal instance, ignoring stderr');
					return;
				}

				const text = normU8(data);
				term.write(text);
				const str = new TextDecoder().decode(text);
				setError(str);
			},
			onStdin: (func) => {
				inputRef.current = func;
			},
			onConnect: () => {
				if (currentGen !== genRef.current) {
					console.warn('Stale terminal instance, ignoring onConnect');
					return;
				}

				setIsLoading(false);
			},
			onDisconnect: () => {
				if (currentGen !== genRef.current) {
					console.warn('Stale terminal instance, ignoring onDisconnect');
					return;
				}

				roRef.current?.disconnect();
				term.dispose();
				termRef.current = null;
				inputRef.current = null;
				sshRef.current = null;

				setIsLoading(false);
			},
		});

		sshRef.current = session;
		const enc = new TextEncoder();
		term.onData((data) => {
			if (currentGen !== genRef.current) {
				console.warn('Stale terminal instance, ignoring onData');
				return;
			}

			const bytes = enc.encode(data);
			inputRef.current?.(bytes);
		});

		const ro = new ResizeObserver(() => {
			if (currentGen !== genRef.current || term !== termRef.current) {
				console.warn('Stale terminal instance, ignoring resize');
				return;
			}

			setIsResizing(true);
			fit.fit();
			sshRef.current?.Resize(term.cols, term.rows);
			setTimeout(() => setIsResizing(false), 100);
		});

		roRef.current = ro;
		ro.observe(divRef.current!);

		return () => {
			++genRef.current;
			roRef.current?.disconnect();
			roRef.current = null;

			sshRef.current?.Close();
			sshRef.current = null;

			term.dispose();
			if (termRef.current === term) {
				termRef.current = null;
			}

			inputRef.current = null;
		};
	}, [ipn, username, hostname]);

	return (
		<>
			{isLoading ? (
				<div className="absolute w-screen z-50 mx-auto h-screen flex items-center justify-center">
					<Loader2 className="animate-spin size-10 text-headplane-50" />
				</div>
			) : undefined}
			<div
				className={cn('w-full h-full', isLoading ? 'opacity-0' : 'opacity-100')}
				ref={divRef}
			/>
			{termRef.current && isResizing ? (
				<div
					className={cn(
						'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
						'px-4 py-2 bg-headplane-800 text-white rounded-full shadow z-50',
					)}
				>
					{termRef.current.cols}x{termRef.current.rows}
				</div>
			) : undefined}
			{error !== null ? (
				<div
					className={cn(
						'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center',
						'px-4 py-2 bg-headplane-800 text-white rounded-full shadow z-50',
					)}
				>
					Failed to connect to SSH session
					{error}
				</div>
			) : undefined}
		</>
	);
}
