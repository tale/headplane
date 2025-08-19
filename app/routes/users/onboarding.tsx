import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { GrApple } from 'react-icons/gr';
import { ImFinder } from 'react-icons/im';
import { MdAndroid } from 'react-icons/md';
import { PiTerminalFill, PiWindowsLogoFill } from 'react-icons/pi';
import { LoaderFunctionArgs, NavLink, useLoaderData } from 'react-router';
import Button from '~/components/Button';
import Card from '~/components/Card';
import Link from '~/components/Link';
import Options from '~/components/Options';
import StatusCircle from '~/components/StatusCircle';
import { LoadContext } from '~/server';
import { Machine } from '~/types';
import cn from '~/utils/cn';
import { useLiveData } from '~/utils/live-data';
import log from '~/utils/log';
import toast from '~/utils/toast';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);

	// Try to determine the OS split between Linux, Windows, macOS, iOS, and Android
	// We need to convert this to a known value to return it to the client so we can
	// automatically tab to the correct download button.
	const userAgent = request.headers.get('user-agent');
	const os = userAgent?.match(/(Linux|Windows|Mac OS X|iPhone|iPad|Android)/);
	let osValue = 'linux';
	switch (os?.[0]) {
		case 'Windows':
			osValue = 'windows';
			break;
		case 'Mac OS X':
			osValue = 'macos';
			break;

		case 'iPhone':
		case 'iPad':
			osValue = 'ios';
			break;

		case 'Android':
			osValue = 'android';
			break;

		default:
			osValue = 'linux';
			break;
	}

	let firstMachine: Machine | undefined;
	try {
		const { nodes } = await context.client.get<{ nodes: Machine[] }>(
			'v1/node',
			session.api_key,
		);

		const node = nodes.find((n) => {
			if (n.user.provider !== 'oidc') {
				return false;
			}

			// For some reason, headscale makes providerID a url where the
			// last component is the subject, so we need to strip that out
			const subject = n.user.providerId?.split('/').pop();
			if (!subject) {
				return false;
			}

			if (subject !== session.user.subject) {
				return false;
			}

			return true;
		});

		firstMachine = node;
	} catch (e) {
		// If we cannot lookup nodes, we cannot proceed
		log.debug('api', 'Failed to lookup nodes %o', e);
	}

	return {
		user: session.user,
		osValue,
		firstMachine,
	};
}

export default function Page() {
	const { user, osValue, firstMachine } = useLoaderData<typeof loader>();
	const { pause, resume } = useLiveData();
	useEffect(() => {
		if (firstMachine) {
			pause();
		} else {
			resume();
		}
	}, [firstMachine]);

	const subject = user.email ? (
		<>
			as <strong>{user.email}</strong>
		</>
	) : (
		'with your OIDC provider'
	);

	return (
		<div className="fixed w-full h-screen flex items-center px-4">
			<div className="w-fit mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 mb-24">
				<Card className="max-w-lg" variant="flat">
					<Card.Title className="mb-8">
						Welcome!
						<br />
						Let's get set up
					</Card.Title>
					<Card.Text>
						Install Tailscale and sign in {subject}. Once you sign in on a
						device, it will be automatically added to your Headscale network.
					</Card.Text>

					<Options
						className="my-4"
						defaultSelectedKey={osValue}
						label="Download Selector"
					>
						<Options.Item
							key="linux"
							title={
								<div className="flex items-center gap-1">
									<PiTerminalFill className="ml-1 w-4" />
									<span>Linux</span>
								</div>
							}
						>
							<Button
								className="flex text-md font-mono"
								onPress={async () => {
									await navigator.clipboard.writeText(
										'curl -fsSL https://tailscale.com/install.sh | sh',
									);

									toast('Copied to clipboard');
								}}
							>
								curl -fsSL https://tailscale.com/install.sh | sh
							</Button>
							<p className="text-xs mt-1 text-headplane-600 dark:text-headplane-300 text-center">
								Click this button to copy the command.{' '}
								<Link
									name="Linux installation script"
									to="https://github.com/tailscale/tailscale/blob/main/scripts/installer.sh"
								>
									View script source
								</Link>
							</p>
						</Options.Item>
						<Options.Item
							key="windows"
							title={
								<div className="flex items-center gap-1">
									<PiWindowsLogoFill className="ml-1 w-4" />
									<span>Windows</span>
								</div>
							}
						>
							<a
								aria-label="Download for Windows"
								href="https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
								rel="noreferrer"
								target="_blank"
							>
								<Button className="my-4 w-full" variant="heavy">
									Download for Windows
								</Button>
							</a>
							<p className="text-sm text-headplane-600 dark:text-headplane-300 text-center">
								Requires Windows 10 or later.
							</p>
						</Options.Item>
						<Options.Item
							key="macos"
							title={
								<div className="flex items-center gap-1">
									<ImFinder className="ml-1 w-4" />
									<span>macOS</span>
								</div>
							}
						>
							<a
								aria-label="Download for macOS"
								href="https://pkgs.tailscale.com/stable/Tailscale-latest-macos.pkg"
								rel="noreferrer"
								target="_blank"
							>
								<Button className="my-4 w-full" variant="heavy">
									Download for macOS
								</Button>
							</a>
							<p className="text-sm text-headplane-600 dark:text-headplane-300 text-center">
								Requires macOS Big Sur 11.0 or later.
								<br />
								You can also download Tailscale on the{' '}
								<Link
									name="macOS App Store"
									to="https://apps.apple.com/ca/app/tailscale/id1475387142"
								>
									macOS App Store
								</Link>
								{'.'}
							</p>
						</Options.Item>
						<Options.Item
							key="ios"
							title={
								<div className="flex items-center gap-1">
									<GrApple className="ml-1 w-4" />
									<span>iOS</span>
								</div>
							}
						>
							<a
								aria-label="Download for iOS"
								href="https://apps.apple.com/us/app/tailscale/id1470499037"
								rel="noreferrer"
								target="_blank"
							>
								<Button className="my-4 w-full" variant="heavy">
									Download for iOS
								</Button>
							</a>
							<p className="text-sm text-headplane-600 dark:text-headplane-300 text-center">
								Requires iOS 15 or later.
							</p>
						</Options.Item>
						<Options.Item
							key="android"
							title={
								<div className="flex items-center gap-1">
									<MdAndroid className="ml-1 w-4" />
									<span>Android</span>
								</div>
							}
						>
							<a
								aria-label="Download for Android"
								href="https://play.google.com/store/apps/details?id=com.tailscale.ipn"
								rel="noreferrer"
								target="_blank"
							>
								<Button className="my-4 w-full" variant="heavy">
									Download for Android
								</Button>
							</a>
							<p className="text-sm text-headplane-600 dark:text-headplane-300 text-center">
								Requires Android 8 or later.
							</p>
						</Options.Item>
					</Options>
				</Card>
				<Card variant="flat">
					{firstMachine ? (
						<div className="flex flex-col justify-between h-full">
							<Card.Title className="mb-8">
								Success!
								<br />
								We found your first device
							</Card.Title>
							<div className="border border-headplane-100 dark:border-headplane-800 rounded-xl p-4">
								<div className="flex items-start gap-4">
									<StatusCircle
										className="size-6 mt-3"
										isOnline={firstMachine.online}
									/>
									<div>
										<p className="font-semibold leading-snug">
											{firstMachine.givenName}
										</p>
										<p className="text-sm font-mono opacity-50">
											{firstMachine.name}
										</p>
										<div className="mt-6">
											<p className="text-sm font-semibold">IP Addresses</p>
											{firstMachine.ipAddresses.map((ip) => (
												<p className="text-xs font-mono opacity-50" key={ip}>
													{ip}
												</p>
											))}
										</div>
									</div>
								</div>
							</div>
							<NavLink to="/onboarding/skip">
								<Button className="w-full" variant="heavy">
									Continue
								</Button>
							</NavLink>
						</div>
					) : (
						<div className="flex flex-col items-center justify-center gap-4 h-full">
							<span className="relative flex size-4">
								<span
									className={cn(
										'absolute inline-flex h-full w-full',
										'rounded-full opacity-75 animate-ping',
										'bg-headplane-500',
									)}
								/>
								<span
									className={cn(
										'relative inline-flex size-4 rounded-full',
										'bg-headplane-400',
									)}
								/>
							</span>
							<p className="font-lg">Waiting for your first device...</p>
						</div>
					)}
				</Card>
				<NavLink className="col-span-2 w-max mx-auto" to="/onboarding/skip">
					<Button className="flex items-center gap-1">
						I already know what I'm doing
						<ArrowRight className="p-1" />
					</Button>
				</NavLink>
			</div>
		</div>
	);
}
