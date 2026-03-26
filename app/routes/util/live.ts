import { nodesResource, usersResource } from "~/server/headscale/live-store";
import log from "~/utils/log";

import type { Route } from "./+types/live";

export async function loader({ request, context }: Route.LoaderArgs) {
  const principal = await context.auth.require(request);
  const apiKey = context.auth.getHeadscaleApiKey(principal, context.oidc?.apiKey);
  const api = context.hsApi.getRuntimeClient(apiKey);

  // Ensure resources are loaded before streaming
  await Promise.all([
    context.hsLive.get(nodesResource, api),
    context.hsLive.get(usersResource, api),
  ]);

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        if (!closed) {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        }
      };

      const versions = context.hsLive.getVersions();
      log.debug("sse", "Client connected, sending hello with versions: %o", versions);
      send("hello", versions);

      const unsubscribe = context.hsLive.subscribe((resource, version) => {
        log.debug("sse", "Sending change event: %s v%s", resource, version);
        send("changed", { resource, version });
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      request.signal.addEventListener("abort", () => {
        log.debug("sse", "Client disconnected");
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
