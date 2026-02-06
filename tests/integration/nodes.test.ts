import { describe, expect, test } from 'vitest';
import { getNode, getRuntimeClient, getIsAtLeast, HS_VERSIONS } from './setup/env';

describe.sequential.for(HS_VERSIONS)('Headscale %s: Users', (version) => {
	let workingNodeId: string;

	test('nodes can register via their nodekey', async () => {
		const client = await getRuntimeClient(version);
		const tailnetNode = await getNode(version);

		const user = await client.createUser('node-reg@');
		const node = await client.registerNode(user.name, tailnetNode.authCode);
		expect(node).toBeDefined();
		expect(node.registerMethod).toBe('REGISTER_METHOD_CLI');
		expect(node.name).toBe(tailnetNode.nodeName);
	});

	test('nodes can be retrieved', async () => {
		const client = await getRuntimeClient(version);
		const { nodeName } = await getNode(version);
		const nodes = await client.getNodes();
		const node = nodes.find((n) => n.name === nodeName);
		expect(node).toBeDefined();
		expect(node?.name).toBe(nodeName);

		const fetchedNode = await client.getNode(node!.id);
		expect(fetchedNode).toBeDefined();
		expect(fetchedNode.id).toBe(node!.id);
		workingNodeId = node!.id;
	});

	test('nodes can be renamed', async () => {
		const client = await getRuntimeClient(version);
		const { nodeName } = await getNode(version);
		const newName = `${nodeName}-renamed`;

		await client.renameNode(workingNodeId, newName);
		const renamedNode = await client.getNode(workingNodeId);
		expect(renamedNode).toBeDefined();
		expect(renamedNode.givenName).toBe(newName);
	});

	test('nodes can be reassigned to another user', async () => {
		if (! getIsAtLeast("0.28.0")) {
			const client = await getRuntimeClient(version);
			const user = await client.createUser('node-reassign@');

			await client.setNodeUser(workingNodeId, user.id);
			const reassignedNode = await client.getNode(workingNodeId);
			expect(reassignedNode).toBeDefined();
			expect(reassignedNode.user.name).toBe(user.name);
		}
	});

	test('nodes can be expired', async () => {
		const client = await getRuntimeClient(version);
		await client.expireNode(workingNodeId);

		const expiredNode = await client.getNode(workingNodeId);
		expect(expiredNode).toBeDefined();
		expect(expiredNode.expiry).toBeDefined();
	});

	test('nodes can be deleted', async () => {
		const client = await getRuntimeClient(version);
		await client.deleteNode(workingNodeId);

		const nodes = await client.getNodes();
		const node = nodes.find((n) => n.id === workingNodeId);
		expect(node).toBeUndefined();
	});
});
