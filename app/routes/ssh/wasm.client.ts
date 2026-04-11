const WASM_MODULE_URL = `${__PREFIX__}/hp_ssh.wasm`;
const WASM_HELPER_URL = `${__PREFIX__}/wasm_exec.js`;

declare global {
  type HeadplaneSSHFactory = (config: HeadplaneSSHConfig) => HeadplaneSSH;
  var __hp_ssh_resolve: ((factory: HeadplaneSSHFactory) => void) | undefined;

  var Go: {
    new (): {
      importObject: WebAssembly.Imports;
      run(instance: WebAssembly.Instance): Promise<void>;
      argv?: string[];
      env?: Record<string, string>;
      exit?: (code: number) => void;
    };
  };
}

interface HeadplaneSSHConfig {
  controlURL: string;
  preAuthKey: string;
  hostname: string;
  onReady: () => void;
  onError?: (message: string) => void;
}

export interface HeadplaneSSH {
  openTunnel(config: TunnelConfig): TunnelSession;
}

interface TunnelConfig {
  ipAddress: string;
  username: string;
  timeout?: number;
  onData: (data: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export interface TunnelSession {
  writeInput(data: string): void;
  resize(cols: number, rows: number): void;
  close(): void;
}

let resolvedFactory: Promise<HeadplaneSSHFactory> | null = null;

function loadGoHelper(): Promise<void> {
  if (typeof globalThis.Go !== "undefined") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = WASM_HELPER_URL;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Go WASM helper"));
    document.head.appendChild(script);
  });
}

/**
 * One-shot function that loads the Go WASM binary and returns the SSH factory.
 * Automatically loads the Go JS helper if it hasn't been loaded yet.
 */
export async function loadHeadplaneWASM(): Promise<HeadplaneSSHFactory> {
  if (!resolvedFactory) {
    await loadGoHelper();

    const go = new Go();
    const result = await WebAssembly.instantiateStreaming(fetch(WASM_MODULE_URL), go.importObject);

    resolvedFactory = new Promise<HeadplaneSSHFactory>((resolve) => {
      globalThis.__hp_ssh_resolve = resolve;
    });

    go.run(result.instance);
  }

  return resolvedFactory;
}
