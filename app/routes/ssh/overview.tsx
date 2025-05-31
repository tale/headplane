import { decode } from 'cborg';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LoaderFunctionArgs, data, useLoaderData } from 'react-router';
import { ClientOnly } from 'remix-utils/client-only';
import {
	Command,
	SSHConnectData,
	SSHConnectFailedData,
} from '~/server/agent/dispatcher';
import { useLiveData } from '~/utils/live-data';
import toast from '~/utils/toast';
import XTerm from './xterm.client';

export async function loader({ request }: LoaderFunctionArgs) {
	const qp = new URL(request.url).searchParams;
	const username = qp.get('username') || undefined;
	const hostname = qp.get('hostname') || undefined;
	const port = qp.get('port')
		? Number.parseInt(qp.get('port')!, 10)
		: undefined;

	if (!username || !hostname || !port) {
		throw data('Missing required parameters: username, hostname, port', 400);
	}

	const baseUrl = new URL(request.url).origin;
	const wsUrl = new URL('/_ssh_plexer', baseUrl);
	wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
	wsUrl.searchParams.set('username', username);
	wsUrl.searchParams.set('hostname', hostname);
	wsUrl.searchParams.set('port', port.toString());

	return {
		socketUrl: wsUrl.toString(),
	};
}
type SessionStatus = 'loading' | 'connected' | 'error';

export default function Page() {
	const { pause } = useLiveData();
	const { socketUrl } = useLoaderData<typeof loader>();
	const [socket, setSocket] = useState<WebSocket | null>(null);
	const [status, setStatus] = useState<SessionStatus>('loading');
	const [sessionId, setSessionId] = useState<string | null>(null);

	const queue = useRef<Array<Uint8Array>>([]);
	const validated = useRef<boolean>(false);

	useEffect(() => {
		// SSH connections should not use stale while revalidate logic.
		pause();

		const ws = new WebSocket(socketUrl);
		ws.binaryType = 'arraybuffer';

		ws.onopen = () => {
			setSocket(ws);
			setStatus('loading');
		};

		// We need to wait for the WebSocket to open and respond with the
		// connection ID. Without a session ID, we do not have a mux.
		const messageHandler = (event: MessageEvent) => {
			if (!(event.data instanceof ArrayBuffer)) {
				toast('Invalid message received from server');
				return;
			}

			const data = new Uint8Array(event.data);
			const obj = decode(data) as Command;

			if (obj.op === 'ssh_conn_successful') {
				const data = obj as SSHConnectData;
				if (!validated.current) {
					validated.current = true;
					toast(
						`SSH connection established with session ID: ${data.payload.sessionId}`,
					);

					setStatus('connected');
					setSessionId(data.payload.sessionId);
				}

				return;
			}

			if (obj.op === 'ssh_conn_failed') {
				const data = obj as SSHConnectFailedData;
				if (!validated.current) {
					validated.current = true;
					toast(`SSH connection failed: ${data.payload.reason}`);
					setStatus('error');
				}

				return;
			}

			if (obj.op === 'ssh_frame') {
				queue.current.push(new Uint8Array(event.data));
				return;
			}
		};

		ws.addEventListener('message', messageHandler);

		ws.onerror = (error) => {
			setStatus('error');
			toast(`WebSocket error: ${error}`);
		};

		ws.onclose = () => {
			if (status !== 'error') {
				toast('SSH connection closed');
			}

			setSocket(null);
			setStatus('error');
		};

		return () => {
			ws.removeEventListener('message', messageHandler);
			ws.close();
		};
	}, [socketUrl]);

	if (socket === null || !sessionId || status === 'loading') {
		return (
			<Loader2 className="animate-spin text-gray-500 dark:text-gray-400 w-6 h-6 mx-auto mt-4" />
		);
	}

	return (
		<div className="flex flex-col h-full">
			<h1>Session ID: {sessionId}</h1>
			{queue.current.length > 0 && (
				<p className="text-sm text-gray-500 dark:text-gray-400">
					{queue.current.length} frames queued
				</p>
			)}

			<XTerm ws={socket} sessionId={sessionId} queue={queue.current} />
		</div>
	);
}
