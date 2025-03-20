import { createMiddleware } from 'hono/factory';

export function exampleMiddleware() {
	return createMiddleware(async (c, next) => {
		console.log('accept-language', c.req.header('accept-language'));
		return next();
	});
}
