const WASM_MODULE_URL = `${__PREFIX__}/hp_ssh.wasm`;

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

/**
 * One-shot function that loads the Go WASM binary and returns the SSH factory.
 * It expects the Go WASM helper to be loaded, and will error if called before.
 */
export async function loadHeadplaneWASM(): Promise<HeadplaneSSHFactory> {
  if (!resolvedFactory) {
    const go = new Go();
    const result = await WebAssembly.instantiateStreaming(fetch(WASM_MODULE_URL), go.importObject);

    resolvedFactory = new Promise<HeadplaneSSHFactory>((resolve) => {
      globalThis.__hp_ssh_resolve = resolve;
    });

    go.run(result.instance);
  }

  return resolvedFactory;
}
