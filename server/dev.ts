import log from '~server/log';
import { createServer, type ViteDevServer } from 'vite';
import { type createRequestHandler } from 'react-router';

let server: ViteDevServer | undefined;
export async function loadDevtools() {
	log.info('DEVX', 'Starting Vite Development server')
	process.env.NODE_ENV = 'development';

	// This is loading the ROOT vite.config.ts
	server = await createServer({
		server: {
			middlewareMode: true,
		}
	});

	// We can't just do ssrLoadModule for virtual:react-router/server-build
	// because for hot reload to work server side it needs to be imported
	// using builtin import in its own file.
	const handler = await server.ssrLoadModule('./server/dev-handler.ts');
	return {
		server,
		handler: handler.default,
	};
}

export async function stacksafeTry(
	devtools: {
		server: ViteDevServer,
		handler: any, // import() is dynamic
	},
	req: Request,
	context: unknown
) {
	try {
		const result = await devtools.handler(req, context);
		return result;
	} catch (error) {
		log.error('DEVX', 'Error in request handler', error);
		if (typeof error === 'object' && error instanceof Error) {
			console.log('got error');
			devtools.server.ssrFixStacktrace(error);
		}

		throw error;
	}
}

if (import.meta.hot) {
	import.meta.hot.on('vite:beforeFullReload', () => {
		server?.close();
	});

	import.meta.hot.dispose(() => {
		server?.close();
	});
}
