import { eq, isNotNull } from 'drizzle-orm';
import log from '~/utils/log';
import type { Route } from '../../layouts/+types/dashboard';
import { ephemeralNodes } from './schema';

export async function pruneEphemeralNodes({
	context,
	request,
}: Route.LoaderArgs) {
	const session = await context.sessions.auth(request);
	const ephemerals = await context.db
		.select()
		.from(ephemeralNodes)
		.where(isNotNull(ephemeralNodes.node_key));

	if (ephemerals.length === 0) {
		log.debug('api', 'No ephemeral nodes to prune');
		return;
	}

	const api = context.hsApi.getRuntimeClient(session.api_key);
	const nodes = await api.getNodes();
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
			log.debug('api', `Pruning node ${node.name}`);
			await api.deleteNode(node.id);

			await context.db
				.delete(ephemeralNodes)
				.where(eq(ephemeralNodes.node_key, node.nodeKey));
			log.debug('api', `Node ${node.name} pruned successfully`);
		};
	});

	await Promise.all(promises.map((p) => p()));
}
