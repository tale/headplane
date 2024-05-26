import { GearIcon, GlobeIcon, LockIcon, PaperAirplaneIcon, PeopleIcon, PersonIcon, ServerIcon } from '@primer/octicons-react'
import { Form } from '@remix-run/react'

import { cn } from '~/utils/cn'
import { HeadplaneContext } from '~/utils/config/headplane'
import { type SessionData } from '~/utils/sessions'

import Menu from './Menu'
import TabLink from './TabLink'

interface Properties {
	readonly data?: {
		acl: HeadplaneContext['acl']
		config: HeadplaneContext['config']
		user?: SessionData['user']
	}
}

interface LinkProperties {
	readonly href: string
	readonly text: string
	readonly isMenu?: boolean
}

function Link({ href, text, isMenu }: LinkProperties) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className={cn(
				!isMenu && 'text-ui-300 hover:text-ui-50 hover:underline hidden sm:block',
			)}
		>
			{text}
		</a>
	)
}

export default function Header({ data }: Properties) {
	return (
		<header className="bg-main-700 dark:bg-main-800 text-ui-50">
			<div className="container flex items-center justify-between py-4">
				<div className="flex items-center gap-x-2">
					<PaperAirplaneIcon className="w-6 h-6" />
					<h1 className="text-2xl">Headplane</h1>
				</div>
				<div className="flex items-center gap-x-4">
					<Link href="https://tailscale.com/download" text="Download" />
					<Link href="https://github.com/tale/headplane" text="GitHub" />
					<Link href="https://github.com/juanfont/headscale" text="Headscale" />
					{data?.user
						? (
							<Menu>
								<Menu.Button className={cn(
									'rounded-full h-9 w-9',
									'border border-main-600 dark:border-main-700',
									'hover:bg-main-600 dark:hover:bg-main-700',
								)}
								>
									<PersonIcon className="h-5 w-5 mt-0.5" />
								</Menu.Button>
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
							)
						: undefined}
				</div>
			</div>
			<nav className="container flex items-center gap-x-4 overflow-x-auto">
				<TabLink to="/machines" name="Machines" icon={<ServerIcon className="w-4 h-4" />} />
				<TabLink to="/users" name="Users" icon={<PeopleIcon className="w-4 h-4" />} />
				{data?.acl.read
					? (
						<TabLink to="/acls" name="Access Control" icon={<LockIcon className="w-4 h-4" />} />
						)
					: undefined}
				{data?.config.read
					? (
						<>
							<TabLink to="/dns" name="DNS" icon={<GlobeIcon className="w-4 h-4" />} />
							<TabLink to="/settings" name="Settings" icon={<GearIcon className="w-4 h-4" />} />
						</>
						)
					: undefined}
			</nav>
		</header>
	)
}
