import type { LinksFunction, MetaFunction } from 'react-router';
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useNavigation,
} from 'react-router';
import '@fontsource-variable/inter';
import { ExternalScripts } from 'remix-utils/external-scripts';
import ProgressBar from '~/components/ProgressBar';
import ToastProvider from '~/components/ToastProvider';
import stylesheet from '~/tailwind.css?url';
import { LiveDataProvider } from '~/utils/live-data';
import { useToastQueue } from '~/utils/toast';
import type { Route } from './+types/root';
import { ErrorBanner } from './components/error-banner';

export const meta: MetaFunction = () => [
	{ title: 'Headplane' },
	{
		name: 'description',
		content: 'A frontend for the headscale coordination server',
	},
];

export const links: LinksFunction = () => [
	{ rel: 'stylesheet', href: stylesheet },
];

export function Layout({ children }: { readonly children: React.ReactNode }) {
	const toastQueue = useToastQueue();

	// LiveDataProvider is wrapped at the top level since dialogs and things
	// that control its state are usually open in portal containers which
	// are not a part of the normal React tree.
	return (
		<LiveDataProvider>
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta content="width=device-width, initial-scale=1" name="viewport" />
					<Meta />
					<Links />
					<link href="favicon.ico" rel="icon" />
				</head>
				<body className="overscroll-none overflow-x-hidden dark:bg-headplane-900 dark:text-headplane-50">
					{children}
					<ToastProvider queue={toastQueue} />
					<ScrollRestoration />
					<Scripts />
					<ExternalScripts />
				</body>
			</html>
		</LiveDataProvider>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return (
		<div className="w-screen h-screen flex items-center justify-center p-4">
			<ErrorBanner className="max-w-2xl" error={error} />
		</div>
	);
}

export default function App() {
	const nav = useNavigation();

	return (
		<>
			<ProgressBar isVisible={nav.state === 'loading'} />
			<Outlet />
		</>
	);
}
