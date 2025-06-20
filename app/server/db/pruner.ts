import { eq, isNotNull } from 'drizzle-orm';
import { LoaderFunctionArgs } from 'react-router';
import { Machine } from '~/types';
import log from '~/utils/log';
import { LoadContext } from '..';
import { ephemeralNodes } from './schema';

export async function pruneEphemeralNodes({
	context,
	request,
}: LoaderFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	const ephemerals = await context.db
		.select()
		.from(ephemeralNodes)
		.where(isNotNull(ephemeralNodes.node_key));

	if (ephemerals.length === 0) {
		log.debug('api', 'No ephemeral nodes to prune');
		return;
	}

	const { nodes } = await context.client.get<{ nodes: Machine[] }>(
		'v1/node',
		session.get('api_key')!,
	);

	const toPrune = nodes.filter((node) => {
		if (node.online) {
			return false;
		}

		return ephemerals.some((ephemeral) => node.nodeKey === ephemeral.node_key);
	});

	if (toPrune.length === 0) {
		log.debug('api', 'No SSH nodes to prune');
		return;
	}

	// Delete from the Headscale nodes list and then from the database
	const promises = toPrune.map((node) => {
		return async () => {
			log.info('api', `Pruning node ${node.name}`);
			await context.client.delete(
				`v1/node/${node.id}`,
				session.get('api_key')!,
			);

			await context.db
				.delete(ephemeralNodes)
				.where(eq(ephemeralNodes.node_key, node.nodeKey));
			log.info('api', `Node ${node.name} pruned successfully`);
		};
	});

	await Promise.all(promises.map((p) => p()));
}
