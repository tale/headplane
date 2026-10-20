// Runs in a Node container on the tailnet's network and drives hp_ssh.wasm
// the way the Browser SSH page does, then prints one RESULT line as JSON.
import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

interface Options {
  controlURL: string;
  authKey: string;
  hostname: string;
  host: string;
  user: string;
  input: string;
  timeoutMs: number;
}

const options = JSON.parse(process.env.BROWSER_SSH ?? "") as Options;
const started = Date.now();
const events: string[] = [];
let output = "";

function note(event: string) {
  events.push(`${Date.now() - started}ms ${event}`);
}

function finish(error?: string) {
  console.log(`RESULT ${JSON.stringify({ output, events, error })}`);
  process.exit(error ? 1 : 0);
}

setTimeout(() => finish("timed out"), options.timeoutMs);

// Only exists in the container.
const wasmExec = "/browser-ssh/wasm_exec.js";
await import(wasmExec);

const go = new Go();
const module = await WebAssembly.instantiate(
  await readFile("/browser-ssh/hp_ssh.wasm"),
  go.importObject,
);
void go.run(module.instance).then(() => finish("the Go runtime exited"));

const ipn = newIPN({
  controlURL: options.controlURL,
  authKey: options.authKey,
  hostname: options.hostname,
});

let isLoginStarted = false;
let isSshStarted = false;
ipn.run({
  notifyState(state) {
    note(`state ${state}`);
    if (state === "NeedsLogin" && !isLoginStarted) {
      isLoginStarted = true;
      ipn.login();
    }

    if (state === "Running" && !isSshStarted) {
      isSshStarted = true;
      startSsh();
    }
  },
  notifyNetMap: () => {},
  notifyBrowseToURL: (url) => finish(`asked to browse to ${url}`),
  notifyPanicRecover: (error) => finish(`panic: ${error}`),
});

// Types the input once the shell goes quiet, and answers cursor position
// queries the way the page's terminal does, since shells wait for a reply.
function startSsh() {
  let write: (data: string) => void = () => {};
  let typing: ReturnType<typeof setTimeout> | undefined;
  let isConnected = false;
  let isTyped = false;

  function typeWhenQuiet() {
    if (!isConnected || isTyped) return;

    clearTimeout(typing);
    typing = setTimeout(() => {
      isTyped = true;
      write(options.input);
    }, 500);
  }

  ipn.ssh(options.host, options.user, {
    writeFn: (data) => {
      output += data;
      appendFileSync(`/tmp/${options.hostname}.out`, data);
      if (data.includes("\x1b[6n")) write("\x1b[24;1R");
      typeWhenQuiet();
    },
    writeErrorFn: (error) => note(`error ${error}`),
    setReadFn: (read) => (write = read),
    rows: 24,
    cols: 80,
    // As the page sets them.
    termType: "xterm-256color",
    timeoutSeconds: 30,
    onConnectionProgress: (message) => note(`progress ${message}`),
    onConnected: () => {
      note("connected");
      isConnected = true;
      typeWhenQuiet();
    },
    onDone: () => {
      note("done");
      finish();
    },
  });
}
