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
import { ErrorPopup } from '~/components/Error';
import ProgressBar from '~/components/ProgressBar';
import ToastProvider from '~/components/ToastProvider';
import stylesheet from '~/tailwind.css?url';
import { LiveDataProvider } from '~/utils/live-data';
import { useToastQueue } from '~/utils/toast';

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
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<Meta />
					<Links />
				</head>
				<body className="overscroll-none dark:bg-headplane-900 dark:text-headplane-50">
					{children}
					<ToastProvider queue={toastQueue} />
					<ScrollRestoration />
					<Scripts />
				</body>
			</html>
		</LiveDataProvider>
	);
}

export function ErrorBoundary() {
	return <ErrorPopup />;
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
