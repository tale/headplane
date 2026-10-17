import { type AddressInfo, connect, createServer, type Socket } from "node:net";

export type FaultMode = "up" | "down" | "blackhole";

export async function createFaultProxy(target: URL) {
  let mode: FaultMode = "up";
  let latencyMs = 0;
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
    upstream.pipe(client);

    // Per chunk, since clients reuse keep-alive connections.
    client.on("data", (chunk) => {
      if (latencyMs === 0) {
        upstream.write(chunk);
        return;
      }

      setTimeout(() => upstream.write(chunk), latencyMs);
    });

    client.on("end", () => upstream.end());
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,

    setMode(next: FaultMode) {
      mode = next;
      if (next === "up") {
        return;
      }

      for (const socket of sockets) {
        socket.destroy();
      }
    },

    setLatency(ms: number) {
      latencyMs = ms;
    },

    async close() {
      for (const socket of sockets) {
        socket.destroy();
      }

      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
