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
	Rows: number;
	Cols: number;

	OnStdout: (data: string) => void;
	OnStderr: (data: string) => void;
	OnStdin: (func: (input: string) => void) => void;

	OnConnect: () => void;
	OnDisconnect: () => void;
}

interface SSHSession {
	Close(): boolean;
	Resize(rows: number, cols: number): boolean;
}
