import { type AddressInfo, connect, createServer, type Socket } from "node:net";

/**
 * - `up` forwards traffic to Headscale.
 * - `down` resets every connection, like Headscale stopping.
 * - `blackhole` accepts connections and never answers, like a hung server
 *   or a dead network path.
 */
export type FaultMode = "up" | "down" | "blackhole";

/**
 * A TCP proxy in front of Headscale that tests can cut. Both Headplane's API
 * client and the agent's control connection go through it, so an outage hits
 * everything at once the way a real one would.
 */
export async function createFaultProxy(target: URL) {
  let mode: FaultMode = "up";
  const sockets = new Set<Socket>();

  function track(socket: Socket) {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
  }

  const server = createServer((client) => {
    track(client);
    if (mode === "down") {
      client.destroy();
      return;
    }

    if (mode === "blackhole") {
      return;
    }

    const upstream = connect(Number(target.port), target.hostname);
    track(upstream);
    client.pipe(upstream).pipe(client);
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,

    // Open connections are dropped on any mode change away from `up`, so the
    // agent's long-poll to Headscale breaks just like in a real outage.
    setMode(next: FaultMode) {
      mode = next;
      if (next === "up") {
        return;
      }

      for (const socket of sockets) {
        socket.destroy();
      }
    },

    async close() {
      for (const socket of sockets) {
        socket.destroy();
      }

      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
