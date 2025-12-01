import type { Traversal } from 'arktype';
import log from '~/utils/log';

export function deprecatedField() {
	return (_: unknown, ctx: Traversal) => {
		log.warn('config', `${ctx.propString} is deprecated and has no effect.`);
		return true;
	};
}
