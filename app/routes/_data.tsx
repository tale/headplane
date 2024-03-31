import { Cog8ToothIcon, CpuChipIcon, GlobeAltIcon, LockClosedIcon, ServerStackIcon, UserCircleIcon, UsersIcon } from '@heroicons/react/24/outline'
import { type LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Form, Outlet, useLoaderData, useRouteError } from '@remix-run/react'

import Dropdown from '~/components/Dropdown'
import { ErrorPopup } from '~/components/Error'
import TabLink from '~/components/TabLink'
import { getContext } from '~/utils/config'
import { HeadscaleError, pull } from '~/utils/headscale'
import { destroySession, getSession } from '~/utils/sessions'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	if (!session.has('hsApiKey')) {
		return redirect('/login')
	}

	try {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		await pull('v1/apikey', session.get('hsApiKey')!)
	} catch (error) {
		if (error instanceof HeadscaleError) {
			console.error(error)
			// Safest to just redirect to login if we can't pull
			return redirect('/login', {
				headers: {
					// eslint-disable-next-line @typescript-eslint/naming-convention
					'Set-Cookie': await destroySession(session)
				}
			})
		}

		// Otherwise propagate to boundary
		throw error
	}

	const context = await getContext()
	return {
		...context,
		user: session.get('user')
	}
}

export default function Layout() {
	const data = useLoaderData<typeof loader>()
	return (
		<>
			<header className='mb-16 bg-gray-800 text-white dark:bg-gray-700'>
				<nav className='container mx-auto'>
					<div className='flex items-center justify-between mb-8 pt-4'>
						<div className='flex items-center gap-x-2'>
							<CpuChipIcon className='w-8 h-8'/>
							<h1 className='text-2xl'>Headplane</h1>
						</div>
						<div className='flex items-center gap-x-4'>
							<a href='https://tailscale.com/download' target='_blank' rel='noreferrer' className='text-gray-300 hover:text-white'>
								Download
							</a>
							<a href='https://github.com/tale/headplane' target='_blank' rel='noreferrer' className='text-gray-300 hover:text-white'>
								GitHub
							</a>
							<a href='https://github.com/juanfont/headscale' target='_blank' rel='noreferrer' className='text-gray-300 hover:text-white'>
								Headscale
							</a>
							<Dropdown
								button={<UserCircleIcon className='w-8 h-8'/>}
							>
								<Dropdown.Item variant='static'>
									<p className='font-bold'>{data.user?.name}</p>
									<p>{data.user?.email}</p>
								</Dropdown.Item>
								<Dropdown.Item className='text-red-700 cursor-pointer'>
									<Form method='POST' action='/logout'>
										<button type='submit'>
											Logout
										</button>
									</Form>
								</Dropdown.Item>
							</Dropdown>
						</div>
					</div>
					<div className='flex items-center gap-x-4'>
						<TabLink to='/machines' name='Machines' icon={<ServerStackIcon className='w-5 h-5'/>}/>
						<TabLink to='/users' name='Users' icon={<UsersIcon className='w-5 h-5'/>}/>
						{data.hasAcl ? <TabLink to='/acls' name='Access Control' icon={<LockClosedIcon className='w-5 h-5'/>}/> : undefined}
						{data.hasConfig ? (
							<>
								<TabLink to='/dns' name='DNS' icon={<GlobeAltIcon className='w-5 h-5'/>}/>
								<TabLink to='/settings' name='Settings' icon={<Cog8ToothIcon className='w-5 h-5'/>}/>
							</>
						) : undefined}
					</div>
				</nav>
			</header>

			<main className='container mx-auto overscroll-contain mb-24'>
				<Outlet/>
			</main>
		</>
	)
}

export function ErrorBoundary() {
	const data = useLoaderData<typeof loader>()
	const error = useRouteError()
	if (!data) {
		throw error
	}

	return (
		<>
			<header className='mb-16 bg-gray-800 text-white dark:bg-gray-700'>
				<nav className='container mx-auto'>
					<div className='flex items-center gap-x-2 mb-8 pt-4'>
						<CpuChipIcon className='w-8 h-8'/>
						<h1 className='text-2xl'>Headplane</h1>
					</div>
					<div className='flex items-center gap-x-4'>
						<TabLink to='/machines' name='Machines' icon={<ServerStackIcon className='w-5 h-5'/>}/>
						<TabLink to='/users' name='Users' icon={<UsersIcon className='w-5 h-5'/>}/>
						{data.hasAcl ? <TabLink to='/acls' name='Access Control' icon={<LockClosedIcon className='w-5 h-5'/>}/> : undefined}
						{data.hasConfig ? (
							<>
								<TabLink to='/dns' name='DNS' icon={<GlobeAltIcon className='w-5 h-5'/>}/>
								<TabLink to='/settings' name='Settings' icon={<Cog8ToothIcon className='w-5 h-5'/>}/>
							</>
						) : undefined}
					</div>
				</nav>
			</header>
			<ErrorPopup type='embedded'/>
		</>
	)
}
