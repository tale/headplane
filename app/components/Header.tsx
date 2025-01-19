import {
	GearIcon,
	GlobeIcon,
	LockIcon,
	PeopleIcon,
	PersonIcon,
	ServerIcon,
} from '@primer/octicons-react';
import { CircleUser, PlaneTakeoff } from 'lucide-react';
import { Form, NavLink } from 'react-router';
import type { ReactNode } from 'react';

import { cn } from '~/utils/cn';
import type { HeadplaneContext } from '~/utils/config/headplane';
import type { SessionData } from '~/utils/sessions.server';

import Menu from './Menu';

interface Props {
	config: HeadplaneContext['config'];
	user?: SessionData['user'];
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
						'px-3 py-2 flex items-center rounded-md text-nowrap gap-x-2',
						'after:absolute after:bottom-0 after:left-3 after:right-3',
						'after:h-0.5 after:bg-headplane-900 dark:after:bg-headplane-200',
						'hover:bg-headplane-200 dark:hover:bg-headplane-900',
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
			className="hidden sm:block hover:underline text-sm"
		>
			{text}
		</a>
	);
}

export default function Header(data: Props) {
	return (
		<header className={cn(
			'bg-headplane-100 dark:bg-headplane-950',
			'text-headplane-800 dark:text-headplane-200',
			'dark:border-b dark:border-headplane-800',
			'shadow-inner',
		)}>
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
							<Menu.IconButton className="p-0">
								<CircleUser />
							</Menu.IconButton>
							<Menu.Items>
								<Menu.Item className="text-right">
									<p className="font-bold">{data.user.name}</p>
									<p>{data.user.email}</p>
								</Menu.Item>
								<Menu.Item className="text-right sm:hidden">
									<Link
										isMenu
										href="https://tailscale.com/download"
										text="Download"
									/>
								</Menu.Item>
								<Menu.Item className="text-right sm:hidden">
									<Link
										isMenu
										href="https://github.com/tale/headplane"
										text="GitHub"
									/>
								</Menu.Item>
								<Menu.Item className="text-right sm:hidden">
									<Link
										isMenu
										href="https://github.com/juanfont/headscale"
										text="Headscale"
									/>
								</Menu.Item>
								<Menu.Item className="text-red-500 dark:text-red-400">
									<Form method="POST" action="/logout">
										<button type="submit" className="w-full text-right">
											Logout
										</button>
									</Form>
								</Menu.Item>
							</Menu.Items>
						</Menu>
					) : undefined}
				</div>
			</div>
			<nav className="container flex items-center gap-x-4 overflow-x-auto font-semibold">
				<TabLink
					to="/machines"
					name="Machines"
					icon={<ServerIcon className="w-4 h-4" />}
				/>
				<TabLink
					to="/users"
					name="Users"
					icon={<PeopleIcon className="w-4 h-4" />}
				/>
				<TabLink
					to="/acls"
					name="Access Control"
					icon={<LockIcon className="w-4 h-4" />}
				/>
				{data.config.read ? (
					<>
						<TabLink
							to="/dns"
							name="DNS"
							icon={<GlobeIcon className="w-4 h-4" />}
						/>
						<TabLink
							to="/settings"
							name="Settings"
							icon={<GearIcon className="w-4 h-4" />}
						/>
					</>
				) : undefined}
			</nav>
		</header>
	);
}
