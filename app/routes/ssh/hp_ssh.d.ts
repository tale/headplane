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
	NotifyNetMap: (netmap: TsWasmNetMap) => void;
	NotifyBrowseToURL: (url: string) => void;
	NotifyPanicRecover: (err: string) => void;
}

interface TsWasmNetMap {
	NodeKey: string;
}

interface TsWasmNet {
	Start: () => void;
	OpenSSH: (
		hostname: string,
		username: string,
		options: XtermConfig,
	) => SSHSession;
}

type IPNState =
	| 'NoState'
	| 'InUseOtherUser'
	| 'NeedsLogin'
	| 'NeedsMachineAuth'
	| 'Stopped'
	| 'Starting'
	| 'Running';

interface XtermConfig {
	rows: number;
	cols: number;
	timeout?: number;

	onStdout: (data: string) => void;
	onStderr: (data: string) => void;
	onStdin: (func: (input: string) => void) => void;

	onConnect: () => void;
	onDisconnect: () => void;
}

interface SSHSession {
	Close(): boolean;
	Resize(rows: number, cols: number): boolean;
}
