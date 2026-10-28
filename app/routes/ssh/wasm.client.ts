export interface TailnetConfig {
  controlURL: string;
  authKey: string;
  hostname: string;
  wasmUrl: string;
  wasmHelperUrl: string;
  onPanic: (error: string) => void;
}

// The build doesn't include Browser SSH, or a proxy doesn't serve its files.
export class MissingWasmError extends Error {}

let goHelper: Promise<void> | null = null;

function loadGoHelper(url: string): Promise<void> {
  if (typeof globalThis.Go !== "undefined") {
    return Promise.resolve();
  }

  goHelper ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.crossOrigin = "anonymous";
    // A proxy may answer with an HTML page, which loads but defines nothing.
    script.onload = () =>
      typeof globalThis.Go === "undefined" ? reject(new MissingWasmError()) : resolve();
    script.onerror = () => reject(new MissingWasmError());
    document.head.appendChild(script);
  });

  return goHelper;
}

/**
 * Boots the Tailscale WASM node and resolves once it has joined the Tailnet.
 * Rejects if the pre-auth key is refused or the Go runtime panics.
 */
export async function connectTailnet(config: TailnetConfig): Promise<IPN> {
  await loadGoHelper(config.wasmHelperUrl);

  const response = await fetch(config.wasmUrl);
  if (!response.ok) {
    throw new MissingWasmError();
  }

  const go = new Go();
  const module = await WebAssembly.instantiateStreaming(response, go.importObject);

  // The Go process parks on a channel forever, so returning means it died.
  go.run(module.instance).then(() => config.onPanic("Unexpected shutdown"));

  const ipn = newIPN({
    controlURL: config.controlURL,
    authKey: config.authKey,
    hostname: config.hostname,
  });

  let loginStarted = false;

  return new Promise((resolve, reject) => {
    ipn.run({
      notifyState: (state) => {
        if (state === "Running") resolve(ipn);

        // The backend parks at NeedsLogin until login starts. With an auth key
        // set this consumes it rather than opening an interactive flow.
        if (state === "NeedsLogin" && !loginStarted) {
          loginStarted = true;
          ipn.login();
        }
      },
      notifyNetMap: () => {},
      // Only reached when the auth key was refused and the node wants a human.
      notifyBrowseToURL: () => reject(new Error("Headscale rejected the auth key")),
      notifyPanicRecover: (error) => reject(new Error(error)),
    });
  });
}
