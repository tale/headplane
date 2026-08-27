const WASM_MODULE_URL = `${__PREFIX__}/hp_ssh.wasm`;
const WASM_HELPER_URL = `${__PREFIX__}/wasm_exec.js`;

export interface TailnetConfig {
  controlURL: string;
  authKey: string;
  hostname: string;
  onPanic: (error: string) => void;
}

let goHelper: Promise<void> | null = null;

function loadGoHelper(): Promise<void> {
  if (typeof globalThis.Go !== "undefined") {
    return Promise.resolve();
  }

  goHelper ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = WASM_HELPER_URL;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Go WASM helper"));
    document.head.appendChild(script);
  });

  return goHelper;
}

/**
 * Boots the Tailscale WASM node and resolves once it has joined the Tailnet.
 * Rejects if the pre-auth key is refused or the Go runtime panics.
 */
export async function connectTailnet(config: TailnetConfig): Promise<IPN> {
  await loadGoHelper();

  const go = new Go();
  const module = await WebAssembly.instantiateStreaming(fetch(WASM_MODULE_URL), go.importObject);

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
      notifyBrowseToURL: () => reject(new Error("Headscale rejected the pre-auth key")),
      notifyPanicRecover: (error) => reject(new Error(error)),
    });
  });
}
