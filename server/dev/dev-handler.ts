import { createRequestHandler } from 'react-router';

export default createRequestHandler(
	// @ts-expect-error: React Router Vite plugin
	() => import('virtual:react-router/server-build'),
	'development',
);
