import { PassThrough } from 'node:stream';
import { createReadableStreamFromReadable } from '@react-router/node';
import { isbot } from 'isbot';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import { renderToPipeableStream } from 'react-dom/server';
import type { AppLoadContext, EntryContext } from 'react-router';
import { ServerRouter } from 'react-router';
import { hs_loadConfig } from '~/utils/config/loader';
import { hp_storeContext } from '~/utils/headscale';
import { hp_loadLogger } from '~/utils/log';
import { initSessionManager } from '~/utils/sessions.server';
import type { AppContext } from '~server/context/app';

export const streamTimeout = 5_000;

// TODO: checkOidc
export default function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	routerContext: EntryContext,
	loadContext: AppContext,
) {
	const { context } = loadContext;
	return new Promise((resolve, reject) => {
		initSessionManager(
			context.server.cookie_secret,
			context.server.cookie_secure,
		);

		// This is a promise but we don't need to wait for it to finish
		// before we start rendering the shell since it only loads once.
		hs_loadConfig(context);
		hp_storeContext(context);
		hp_loadLogger(context.debug);

		let shellRendered = false;
		const userAgent = request.headers.get('user-agent');

		// Ensure requests from bots and SPA Mode renders wait for all content to load before responding
		// https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
		const readyOption: keyof RenderToPipeableStreamOptions =
			(userAgent && isbot(userAgent)) || routerContext.isSpaMode
				? 'onAllReady'
				: 'onShellReady';

		const { pipe, abort } = renderToPipeableStream(
			<ServerRouter context={routerContext} url={request.url} />,
			{
				[readyOption]() {
					shellRendered = true;
					const body = new PassThrough();
					const stream = createReadableStreamFromReadable(body);

					responseHeaders.set('Content-Type', 'text/html');

					resolve(
						new Response(stream, {
							headers: responseHeaders,
							status: responseStatusCode,
						}),
					);

					pipe(body);
				},
				onShellError(error: unknown) {
					reject(error);
				},
				onError(error: unknown) {
					// biome-ignore lint/style/noParameterAssign: Lazy
					responseStatusCode = 500;
					// Log streaming rendering errors from inside the shell.  Don't log
					// errors encountered during initial shell rendering since they'll
					// reject and get logged in handleDocumentRequest.
					if (shellRendered) {
						console.error(error);
					}
				},
			},
		);

		// Abort the rendering stream after the `streamTimeout` so it has tine to
		// flush down the rejected boundaries
		setTimeout(abort, streamTimeout + 1000);
	});
}
