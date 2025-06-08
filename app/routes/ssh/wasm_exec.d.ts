declare class Go {
	importObject: WebAssembly.Imports;
	run(instance: WebAssembly.Instance): Promise<void>;
	argv?: string[];
	env?: Record<string, string>;
	exit?: (code: number) => void;
}
