import { index, layout, prefix, route } from '@react-router/dev/routes';

export default [
	// Utility Routes
	index('routes/util/redirect.ts'),
	route('/healthz', 'routes/util/healthz.ts'),

	// Authentication Routes
	route('/login', 'routes/auth/login.tsx'),
	route('/logout', 'routes/auth/logout.ts'),
	route('/oidc/callback', 'routes/auth/oidc-callback.ts'),

	// All the main logged-in dashboard routes
	layout('layouts/dashboard.tsx', [
		...prefix('/machines', [
			index('routes/machines/overview.tsx'),
			route('/:id', 'routes/machines/machine.tsx'),
		]),

		route('/users', 'routes/users/overview.tsx'),
		route('/acls', 'routes/acls/editor.tsx'),
		route('/dns', 'routes/dns/overview.tsx'),

		...prefix('/settings', [
			index('routes/settings/overview.tsx'),
			route('/auth-keys', 'routes/settings/auth-keys.tsx'),
		]),
	]),
];
