import { faker } from '@faker-js/faker';
import { useState } from 'react';
import { LoaderFunctionArgs } from 'react-router';
import { LoadContext } from '~/server';

import { Loader2 } from 'lucide-react';
import '~/wasm_exec';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	// const session = await context.sessions.auth(request);
	// const user = session.get('user');
	// if (!user) {
	// 	throw data('Unauthorized', 401);
	// }
	// if (user.subject === 'unknown-non-oauth') {
	// 	throw data('Only OAuth users are allowed to use WebSSH', 403);
	// }
	// const { users } = await context.client.get<{ users: User[] }>(
	// 	'v1/user',
	// 	session.get('api_key')!,
	// );
	// // MARK: This assumes that a user has authenticated with Headscale first
	// // Since the only way to enforce permissions via ACLs is to generate a
	// // pre-authkey which REQUIRES a user ID, meaning the user has to have
	// // authenticated with Headscale first.
	// const lookup = users.find((u) => {
	// 	const subject = u.providerId?.split('/').pop();
	// 	if (!subject) {
	// 		return false;
	// 	}
	// 	return subject === user.subject;
	// });
	// if (!lookup) {
	// 	throw data(
	// 		`User with subject ${user.subject} not found within Headscale`,
	// 		404,
	// 	);
	// }
	// const { preAuthKey } = await context.client.post<{ preAuthKey: PreAuthKey }>(
	// 	'v1/preauthkey',
	// 	session.get('api_key')!,
	// 	{
	// 		user: lookup.id,
	// 		reusable: false,
	// 		ephemeral: true,
	// 		expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
	// 	},
	// );
	// // TODO: Enable config to enforce generate_authkeys capability
	// // For now, any user is capable of WebSSH connections
	// // const check = await context.sessions.check(
	// // 	request,
	// // 	Capabilities.generate_authkeys,
	// // );
	// const qp = new URL(request.url).searchParams;
	// const username = qp.get('username') || undefined;
	// const hostname = qp.get('hostname') || undefined;
	// const port = qp.get('port')
	// 	? Number.parseInt(qp.get('port')!, 10)
	// 	: undefined;
	// if (!username || !hostname || !port) {
	// 	throw data('Missing required parameters: username, hostname, port', 400);
	// }
	// // TODO: Verify the Host headers to ensure CORS friendly
	// // TODO: Check if the URL actually resolves correctly
	// // TODO: Keep track of hostname since ephemeral nodes are broken atm
	// return {
	// 	PreAuthKey: preAuthKey.key,
	// 	ControlURL:
	// 		context.config.headscale.public_url ?? context.config.headscale.url,
	// 	Hostname: generateHostname(username),
	// 	ssh: {
	// 		username,
	// 		hostname,
	// 	},
	// };
}

function generateHostname(username: string) {
	const adjective = faker.word.adjective({
		length: {
			min: 3,
			max: 6,
		},
	});

	const noun = faker.word.noun({
		length: {
			min: 3,
			max: 6,
		},
	});

	return `ssh-${adjective}-${noun}-${username}`;
}

export default function Page() {
	// const { pause } = useLiveData();
	const [ipn, setIpn] = useState<TsWasmNet | null>(null);
	// const { PreAuthKey, ControlURL, Hostname, ssh } =
	// 	useLoaderData<typeof loader>();

	// useEffect(() => {
	// 	pause();
	// 	const go = new Go(); // Go is defined by wasm_exec.js
	// 	WebAssembly.instantiateStreaming(fetch(wasm), go.importObject).then(
	// 		(value) => {
	// 			go.run(value.instance);
	// 			const handle = TsWasmNet(
	// 				{
	// 					PreAuthKey,
	// 					ControlURL,
	// 					Hostname,
	// 				},
	// 				{
	// 					NotifyState: (state) => {
	// 						console.log('State changed:', state);
	// 						if (state === 'Running') {
	// 							setIpn(handle);
	// 						}
	// 					},
	// 					NotifyNetMap: (netmap) => {
	// 						console.log('NetMap updated:', netmap);
	// 					},
	// 					NotifyBrowseToURL: (url) => {
	// 						console.log('Browse to URL:', url);
	// 					},
	// 					NotifyPanicRecover: (message) => {
	// 						console.error('Panic recover:', message);
	// 					},
	// 				},
	// 			);

	// 			handle.Start();
	// 		},
	// 	);
	// }, []);

	return (
		<div className="w-screen h-screen bg-headplane-900">
			{ipn === null ? (
				<div className="mx-auto h-screen flex items-center justify-center">
					<Loader2 className="animate-spin size-10" />
				</div>
			) : (
				<div className="flex flex-col h-screen">
					{/* <h1>Session ID: {sessionId}</h1>
					{queue.current.length > 0 && (
						<p className="text-sm text-gray-500 dark:text-gray-400">
							{queue.current.length} frames queued
						</p>
					)} */}

					{/* <XTerm ipn={ipn} /> */}
					<div className="flex-1 overflow-auto">
						{/* Render your terminal component here */}
						{/* <Terminal ipn={ipn} /> */}
					</div>
				</div>
			)}
		</div>
	);
}
