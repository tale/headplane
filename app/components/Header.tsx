import {
	CircleUser,
	Globe2,
	Lock,
	PlaneTakeoff,
	Server,
	Settings,
	Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useSubmit } from 'react-router';
import Menu from '~/components/Menu';
import { AuthSession } from '~/server/web/sessions';
import cn from '~/utils/cn';

interface Props {
	configAvailable: boolean;
	onboarding: boolean;
	user?: AuthSession['user'];
	access: {
		ui: boolean;
		machines: boolean;
		dns: boolean;
		users: boolean;
		policy: boolean;
		settings: boolean;
	};
}

interface LinkProps {
	href: string;
	text: string;
}

interface TabLinkProps {
	name: string;
	to: string;
	icon: ReactNode;
}

function TabLink({ name, to, icon }: TabLinkProps) {
	return (
		<div className="relative py-2">
			<NavLink
				to={to}
				prefetch="intent"
				className={({ isActive }) =>
					cn(
						'px-3 py-2 flex items-center rounded-md text-nowrap gap-x-2.5',
						'after:absolute after:bottom-0 after:left-3 after:right-3',
						'after:h-0.5 after:bg-headplane-900 dark:after:bg-headplane-200',
						'hover:bg-headplane-200 dark:hover:bg-headplane-900',
						'focus:outline-hidden focus:ring-3',
						isActive ? 'after:visible' : 'after:invisible',
					)
				}
			>
				{icon} {name}
			</NavLink>
		</div>
	);
}

function Link({ href, text }: LinkProps) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className={cn(
				'hidden sm:block hover:underline text-sm',
				'focus:outline-hidden focus:ring-3 rounded-md',
			)}
		>
			{text}
		</a>
	);
}

export default function Header(data: Props) {
	const submit = useSubmit();

	return (
		<header
			className={cn(
				'bg-headplane-100 dark:bg-headplane-950',
				'text-headplane-800 dark:text-headplane-200',
				'dark:border-b dark:border-headplane-800',
				'shadow-inner',
			)}
		>
			<div className="container flex items-center justify-between py-4">
				<div className="flex items-center gap-x-2">
					<PlaneTakeoff />
					<h1 className="text-2xl font-semibold">headplane</h1>
				</div>
				<div className="flex items-center gap-x-4">
					<Link href="https://tailscale.com/download" text="Download" />
					<Link href="https://github.com/tale/headplane" text="GitHub" />
					<Link href="https://github.com/juanfont/headscale" text="Headscale" />
					{data.user ? (
						<Menu>
							<Menu.IconButton
								label="User"
								className={cn(data.user.picture ? 'p-0' : '')}
							>
								{data.user.picture ? (
									<img
										src={data.user.picture}
										alt={data.user.name}
										className="w-8 h-8 rounded-full"
									/>
								) : (
									<CircleUser />
								)}
							</Menu.IconButton>
							<Menu.Panel
								onAction={(key) => {
									if (key === 'logout') {
										submit(
											{},
											{
												method: 'POST',
												action: '/logout',
											},
										);
									}
								}}
								disabledKeys={['profile']}
							>
								<Menu.Section>
									<Menu.Item key="profile" textValue="Profile">
										<div className="text-black dark:text-headplane-50">
											<p className="font-bold">{data.user.name}</p>
											<p>{data.user.email}</p>
										</div>
									</Menu.Item>
									<Menu.Item key="logout" textValue="Logout">
										<p className="text-red-500 dark:text-red-400">Logout</p>
									</Menu.Item>
								</Menu.Section>
							</Menu.Panel>
						</Menu>
					) : undefined}
				</div>
			</div>
			{data.access.ui && !data.onboarding ? (
				<nav className="container flex items-center gap-x-4 overflow-x-auto font-semibold">
					{data.access.machines ? (
						<TabLink
							to="/machines"
							name="Machines"
							icon={<Server className="w-5" />}
						/>
					) : undefined}
					{data.access.users ? (
						<TabLink
							to="/users"
							name="Users"
							icon={<Users className="w-5" />}
						/>
					) : undefined}
					{data.access.policy ? (
						<TabLink
							to="/acls"
							name="Access Control"
							icon={<Lock className="w-5" />}
						/>
					) : undefined}
					{data.configAvailable ? (
						<>
							{data.access.dns ? (
								<TabLink
									to="/dns"
									name="DNS"
									icon={<Globe2 className="w-5" />}
								/>
							) : undefined}
							{data.access.settings ? (
								<TabLink
									to="/settings"
									name="Settings"
									icon={<Settings className="w-5" />}
								/>
							) : undefined}
						</>
					) : undefined}
				</nav>
			) : undefined}
		</header>
	);
}
