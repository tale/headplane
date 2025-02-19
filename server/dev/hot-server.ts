import { type ViteDevServer, createServer } from 'vite';
import log from '~server/utils/log';

// TODO: Remove env.NODE_ENV
let server: ViteDevServer | undefined;
export async function loadDevtools() {
	log.info('DEVX', 'Starting Vite Development server');
	process.env.NODE_ENV = 'development';

	// This is loading the ROOT vite.config.ts
	server = await createServer({
		server: {
			middlewareMode: true,
		},
	});

	// We can't just do ssrLoadModule for virtual:react-router/server-build
	// because for hot reload to work server side it needs to be imported
	// using builtin import in its own file.
	const handler = await server.ssrLoadModule('./server/dev/dev-handler.ts');
	return {
		server,
		handler: handler.default,
	};
}

export async function stacksafeTry(
	devtools: {
		server: ViteDevServer;
		handler: (req: Request, context: unknown) => Promise<Response>;
	},
	req: Request,
	context: unknown,
) {
	try {
		const result = await devtools.handler(req, context);
		return result;
	} catch (error) {
		log.error('DEVX', 'Error in request handler', error);
		if (typeof error === 'object' && error instanceof Error) {
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
