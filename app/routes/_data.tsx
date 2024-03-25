import { CpuChipIcon, ServerStackIcon } from '@heroicons/react/24/outline'
import { type LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Outlet } from '@remix-run/react'

import TabLink from '~/components/TabLink'
import { getSession } from '~/utils/sessions'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	if (!session.has('hsApiKey')) {
		return redirect('/login')
	}

	// eslint-disable-next-line unicorn/no-null
	return null
}

export default function Layout() {
	return (
		<>
			<header className='bg-gray-800 text-white mb-16'>
				<nav className='container mx-auto'>
					<div className='flex items-center gap-x-2 mb-8 pt-4'>
						<CpuChipIcon className='w-8 h-8'/>
						<h1 className='text-2xl'>Headplane</h1>
					</div>
					<div className='flex items-center gap-x-4'>
						<TabLink to='/machines' name='Machines' icon={<ServerStackIcon className='w-4 h-4'/>}/>
					</div>
				</nav>
			</header>

			<main className='container mx-auto overscroll-contain'>
				<Outlet/>
			</main>

		</>
	)
}

