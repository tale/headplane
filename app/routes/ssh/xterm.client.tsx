import * as xterm from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import { decode } from 'cborg';
import type { SSHFrameData } from '~/server/agent/dispatcher';
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

	useEffect(() => {
		pause();

		const terminal = new xterm.Terminal({
			convertEol: true,
			fontSize: 14,
			theme: {
				background: '#1e1e1e',
				foreground: '#ffffff',
			},
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
				ws.send(input);
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

		return () => {
			ws.removeEventListener('message', onMessage);
			term.current?.dispose();
		};
	}, [ws, queue]);

	return <div ref={container} style={{ height: '100%', width: '100%' }} />;
}
