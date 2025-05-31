import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import * as xterm from '@xterm/xterm';
import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { decode, encode } from 'cborg';
import type {
	SSHDataCommand,
	SSHFrameData,
	SSHResizeCommand,
} from '~/server/agent/dispatcher';
import cn from '~/utils/cn';
import { useLiveData } from '~/utils/live-data';

interface XTermProps {
	ws: WebSocket;
	sessionId: string;
	queue: Array<Uint8Array>;
}

const RED = new TextEncoder().encode('\x1b[31m');
const RESET = new TextEncoder().encode('\x1b[0m');

export default function XTerm({ ws, sessionId, queue }: XTermProps) {
	const { pause } = useLiveData();

	const container = useRef<HTMLDivElement>(null);
	const term = useRef<xterm.Terminal>(null);
	const [isResizing, setIsResizing] = useState(false);

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
		terminal.loadAddon(new WebLinksAddon());
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

		const handleFrame = (data: Uint8Array) => {
			try {
				const frame: SSHFrameData = decode(data);
				if (frame.op !== 'ssh_frame') {
					console.warn('Received unexpected frame type:', frame.op);
					return;
				}

				// If this is stderr, color it red
				if (frame.payload.channel === 2) {
					terminal.write(
						new Uint8Array([...RED, ...frame.payload.frame, ...RESET]),
					);
				} else {
					terminal.write(frame.payload.frame);
				}
			} catch (err) {
				console.error('Failed to decode CBOR frame:', err);
			}
		};

		for (const buffer of queue) {
			handleFrame(buffer);
		}

		terminal.onData((input) => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(
					encode({
						op: 'ssh_data',
						payload: {
							sessionId,
							data: new TextEncoder().encode(input),
						},
					} satisfies SSHDataCommand),
				);
			} else {
				console.warn('WebSocket is not open, cannot send data');
			}
		});

		const onMessage = (event: MessageEvent) => {
			if (!(event.data instanceof ArrayBuffer)) {
				console.warn('Received non-binary message from WebSocket');
				return;
			}

			const data = new Uint8Array(event.data);
			handleFrame(data);
		};

		ws.addEventListener('message', onMessage);
		const ro = new ResizeObserver(() => {
			const before = {
				cols: terminal.cols,
				rows: terminal.rows,
			};

			fit.fit();
			if (before.cols !== terminal.cols || before.rows !== terminal.rows) {
				console.log(
					`Resized terminal to ${terminal.cols} cols and ${terminal.rows} rows`,
				);
				ws.send(
					encode({
						op: 'ssh_resize',
						payload: {
							sessionId,
							width: terminal.cols,
							height: terminal.rows,
						},
					} satisfies SSHResizeCommand),
				);

				setIsResizing(true);
				setTimeout(() => {
					setIsResizing(false);
				}, 1000);
			}
		});

		ro.observe(container.current!);
		return () => {
			ws.removeEventListener('message', onMessage);
			term.current?.dispose();
			ro.disconnect();
		};
	}, [ws, queue]);

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
