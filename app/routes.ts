//import { flatRoutes } from '@remix-run/fs-routes'
import { index, layout, prefix, route } from '@remix-run/route-config'

export default [
	// Utility Routes
	index('routes/_index.tsx'),
	route('/healthz', 'routes/healthz.tsx'),

	// Authentication Routes
	route('/login', 'routes/auth/login.tsx'),
	route('/logout', 'routes/auth/logout.ts'),
	route('/oidc/callback', 'routes/auth/oidc-callback.ts'),

	// All the main logged-in dashboard routes
	layout('layouts/dashboard.tsx', [
		...prefix('/machines', [
			index('routes/_data.machines._index/route.tsx'),
			route('/:id', 'routes/_data.machines.$id/route.tsx'),
		]),
		...prefix('/users', [
			index('routes/_data.users._index/route.tsx'),
		]),
		...prefix('/dns', [
			index('routes/_data.dns._index/route.tsx'),
		]),
		...prefix('/acls', [
			index('routes/_data.acls._index/route.tsx'),
		]),
		...prefix('/settings', [
			index('routes/_data.settings._index/route.tsx'),
			route('/auth-keys', 'routes/_data.settings.auth-keys._index/route.tsx'),
		]),
	])
]

