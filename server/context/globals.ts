import { HeadplaneConfig } from './parser';

declare global {
	const __cookie_context: {
		cookie_secret: string;
		cookie_secure: boolean;
	};

	const __hs_context: {
		url: string;
		config_path?: string;
		config_strict?: boolean;
	};

	const __oidc_context: {
		valid: boolean;
		secret: string;
	};

	let __integration_context: HeadplaneConfig['integration'];
}
