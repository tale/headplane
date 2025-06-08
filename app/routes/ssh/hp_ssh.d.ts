declare function newIPN(config: NewIPNConfig): IPNHandle;
declare function TsWasmNet(
	options: TsWasmNetOptions,
	callbacks: TsWasmNetCallbacks,
): TsWasmNet;

interface TsWasmNetOptions {
	ControlURL: string;
	PreAuthKey: string;
	Hostname: string;
}

interface TsWasmNetCallbacks {
	NotifyState: (state: IPNState) => void;
	NotifyNetMap: (netMapJson: string) => void;
	NotifyBrowseToURL: (url: string) => void;
	NotifyPanicRecover: (err: string) => void;
}

interface TsWasmNet {
	Start: () => void;
}

type IPNState =
	| 'NoState'
	| 'InUseOtherUser'
	| 'NeedsLogin'
	| 'NeedsMachineAuth'
	| 'Stopped'
	| 'Starting'
	| 'Running';

interface SSHTerminalConfig {
	writeFn: (data: string) => void;
	writeErrorFn: (error: string) => void;
	setReadFn: (cb: (input: string) => void) => void;
	rows: number;
	cols: number;
	timeoutSeconds?: number;
	onConnectionProgress: (message: string) => void;
	onConnected: () => void;
	onDone: () => void;
}

interface SSHSession {
	close(): boolean;
	resize(rows: number, cols: number): boolean;
}
