/** biome-ignore-all lint/correctness/noNestedComponentDefinitions: Wtf? */

import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
	ActionFunctionArgs,
	data,
	LinksFunction,
	LoaderFunctionArgs,
	ShouldRevalidateFunction,
	useLoaderData,
	useSubmit,
} from 'react-router';
import { ExternalScriptsHandle } from 'remix-utils/external-scripts';
import { LoadContext } from '~/server';
import { EphemeralNodeInsert, ephemeralNodes } from '~/server/db/schema';
import { Machine, PreAuthKey, User } from '~/types';
import { useLiveData } from '~/utils/live-data';
import UserPrompt from './user-prompt';
import XTerm from './xterm.client';

export const shouldRevalidate: ShouldRevalidateFunction = () => {
	return false;
};

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const origin = new URL(request.url).origin;
	const assets = ['/wasm_exec.js', '/hp_ssh.wasm'];
	const missing: string[] = [];

	for (const file of assets) {
		const res = await fetch(`${origin}${file}`, { method: 'HEAD' });
		if (!res.ok) missing.push(file);
	}

	if (missing.length > 0) {
		throw data('WebSSH is not configured in this build.', 405);
	}

	if (!context.agents?.agentID()) {
		throw data(
			'WebSSH is only available with the Headplane agent integration',
			400,
		);
	}

	const session = await context.sessions.auth(request);
	if (session.user.subject === 'unknown-non-oauth') {
		throw data('Only OAuth users are allowed to use WebSSH', 403);
	}
	const { users } = await context.client.get<{ users: User[] }>(
		'v1/user',
		session.api_key,
	);

	// MARK: This assumes that a user has authenticated with Headscale first
	// Since the only way to enforce permissions via ACLs is to generate a
	// pre-authkey which REQUIRES a user ID, meaning the user has to have
	// authenticated with Headscale first.
	const lookup = users.find((u) => {
		const subject = u.providerId?.split('/').pop();
		if (!subject) {
			return false;
		}
		return subject === session.user.subject;
	});

	if (!lookup) {
		throw data(
			`User with subject ${session.user.subject} not found within Headscale`,
			404,
		);
	}

	const { preAuthKey } = await context.client.post<{ preAuthKey: PreAuthKey }>(
		'v1/preauthkey',
		session.api_key,
		{
			user: lookup.id,
			reusable: false,
			ephemeral: true,
			expiration: new Date(Date.now() + 60 * 1000).toISOString(), // 1 minute
		},
	);

	// TODO: Enable config to enforce generate_authkeys capability
	// For now, any user is capable of WebSSH connections
	// const check = await context.sessions.check(
	// 	request,
	// 	Capabilities.generate_authkeys,
	// );

	const qp = new URL(request.url).searchParams;
	const username = qp.get('username') || undefined;
	const hostname = qp.get('hostname') || undefined;
	if (!hostname) {
		throw data('Missing required parameter:  hostname', 400);
	}

	if (!username) {
		return {
			ipnDetails: undefined,
			sshDetails: {
				username,
				hostname,
			},
		};
	}

	// We're making a request to <url>/key?v=116 to check the CORS headers
	const u = context.config.headscale.public_url ?? context.config.headscale.url;
	// const res = await fetch(`${u}/key?v=116`, {
	// 	method: 'GET',
	// });

	// const corsOrigin = res.headers.get('Access-Control-Allow-Origin');
	// const corsMethods = res.headers.get('Access-Control-Allow-Methods');
	// const corsHeaders = res.headers.get('Access-Control-Allow-Headers');
	// console.log(corsOrigin, corsMethods, corsHeaders);

	// if (!corsOrigin || !corsMethods || !corsHeaders) {
	// 	throw data(
	// 		'Headscale server does not have the required CORS headers for WebSSH',
	// 		500,
	// 	);
	// }

	const { nodes } = await context.client.get<{ nodes: Machine[] }>(
		'v1/node',
		session.api_key,
	);

	// node.name is the hostname, given_name is the set name
	const lookupNode = nodes.find((n) => n.name === hostname);
	if (!lookupNode) {
		throw data(`Node with hostname ${hostname} not found`, 404);
	}

	// Last thing is keeping track of the ephemeral node in the database
	// because Headscale doesn't automatically delete ephemeral nodes???
	const [_ephemeralNode] = await context.db
		.insert(ephemeralNodes)
		.values({
			auth_key: preAuthKey.key,
		} satisfies EphemeralNodeInsert)
		.returning();

	return {
		ipnDetails: {
			PreAuthKey: preAuthKey.key,
			Hostname: generateHostname(username),
			ControlURL: u,
		},

		sshDetails: {
			username,
			hostname,
		},
	};
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

export async function action({
	request,
	context,
}: ActionFunctionArgs<LoadContext>) {
	const _session = await context.sessions.auth(request);
	if (!context.agents?.agentID()) {
		throw data(
			'WebSSH is only available with the Headplane agent integration',
			400,
		);
	}

	const form = await request.formData();
	const nodeKey = form.get('node_key');
	const authKey = form.get('auth_key');

	if (nodeKey === null || typeof nodeKey !== 'string') {
		throw data('Missing node_key', 400);
	}

	if (authKey === null || typeof authKey !== 'string') {
		throw data('Missing auth_key', 400);
	}

	await context.db
		.update(ephemeralNodes)
		.set({
			node_key: nodeKey,
		})
		.where(eq(ephemeralNodes.auth_key, authKey));
}

export const links: LinksFunction = () => [
	{
		rel: 'preload',
		href: '/hp_ssh.wasm',
		as: 'fetch',
		type: 'application/wasm',
		crossOrigin: 'anonymous',
	},
];

export const handle: ExternalScriptsHandle = {
	scripts: [
		{
			src: '/wasm_exec.js',
			crossOrigin: 'anonymous',
			preload: true,
		},
	],
};

export default function Page() {
	const submit = useSubmit();
	const { pause } = useLiveData();

	const [ipn, setIpn] = useState<TsWasmNet | null>(null);
	const [nodeKey, setNodeKey] = useState<string | null>(null);
	const { ipnDetails, sshDetails } = useLoaderData<typeof loader>();

	useEffect(() => {
		if (!ipnDetails) {
			return;
		}

		pause();
		const go = new Go(); // Go is defined by wasm_exec.js
		WebAssembly.instantiateStreaming(
			fetch('/hp_ssh.wasm'),
			go.importObject,
		).then((value) => {
			go.run(value.instance);
			const handle = TsWasmNet(ipnDetails, {
				NotifyState: (state) => {
					console.log('State changed:', state);
					if (state === 'Running') {
						setIpn(handle);
					}
				},
				NotifyNetMap: (netmap) => {
					// Only set NodeKey if it is not already set and then
					// also dispatch that to the backend to track the
					// ephemeral node.
					//
					// We open an SSE connection to the backend
					// so that when the connection is closed,
					// the backend can delete the ephemeral node.
					if (nodeKey === null) {
						setNodeKey(netmap.NodeKey);
						submit(
							{
								node_key: netmap.NodeKey,
								auth_key: ipnDetails.PreAuthKey,
							},
							{ method: 'POST' },
						);
					}
				},
				NotifyBrowseToURL: (url) => {
					console.log('Browse to URL:', url);
				},
				NotifyPanicRecover: (message) => {
					console.error('Panic recover:', message);
				},
			});

			handle.Start();
		});
	}, []);

	if (!sshDetails.username) {
		return <UserPrompt hostname={sshDetails.hostname} />;
	}

	return (
		<div className="w-screen h-screen bg-headplane-900">
			{ipn === null ? (
				<div className="mx-auto h-screen flex items-center justify-center">
					<Loader2 className="animate-spin size-10 text-headplane-50" />
				</div>
			) : (
				<div className="flex flex-col h-screen">
					<XTerm
						hostname={sshDetails.hostname}
						ipn={ipn}
						username={sshDetails.username}
					/>
				</div>
			)}
		</div>
	);
}
